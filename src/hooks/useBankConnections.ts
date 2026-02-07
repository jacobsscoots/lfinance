import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface BankConnection {
  id: string;
  user_id: string;
  provider: string;
  status: string;
  last_synced_at: string | null;
  created_at: string;
}

// Helper to extract meaningful error messages from Supabase function errors
function normalizeError(error: unknown, functionName: string): string {
  if (!error) return "Unknown error";

  // Handle FunctionsHttpError or similar
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;

    // Check for context.body which contains the actual error response
    if (err.context && typeof err.context === "object") {
      const ctx = err.context as Record<string, unknown>;
      if (ctx.body && typeof ctx.body === "string") {
        try {
          const parsed = JSON.parse(ctx.body);
          if (parsed.error) {
            const stage = parsed.stage ? ` [${parsed.stage}]` : "";
            return `${functionName}${stage}: ${parsed.error}`;
          }
        } catch {
          // Not JSON, use as-is
          return `${functionName}: ${ctx.body}`;
        }
      }
    }

    // Direct error message
    if (err.message && typeof err.message === "string") {
      return `${functionName}: ${err.message}`;
    }
  }

  if (typeof error === "string") {
    return `${functionName}: ${error}`;
  }

  return `${functionName}: Connection failed`;
}

export function useBankConnections() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const connectionsQuery = useQuery({
    queryKey: ["bank-connections", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("bank_connections")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as BankConnection[];
    },
    enabled: !!user,
  });

  const startConnection = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const redirectUri = `${window.location.origin}/accounts?truelayer_callback=true`;

      // Create a pending connection record
      const { data: connection, error: connError } = await supabase
        .from("bank_connections")
        .insert({
          user_id: user.id,
          provider: "truelayer",
          status: "pending",
        })
        .select()
        .single();

      if (connError) throw connError;

      try {
        // Get auth URL from edge function - explicitly pass action in body
        const { data, error } = await supabase.functions.invoke("truelayer-auth", {
          body: { action: "auth-url", redirectUri },
        });

        if (error) throw error;
        if (!data?.authUrl) throw new Error("No auth URL returned from server");

        // Store connection ID for callback
        localStorage.setItem("pending_bank_connection_id", connection.id);

        return { authUrl: data.authUrl, connectionId: connection.id };
      } catch (invokeError) {
        // Clean up pending connection if auth URL fetch fails
        await supabase
          .from("bank_connections")
          .delete()
          .eq("id", connection.id);
        
        throw invokeError;
      }
    },
    onSuccess: ({ authUrl }) => {
      // Redirect to TrueLayer
      window.location.href = authUrl;
    },
    onError: (error) => {
      const message = normalizeError(error, "truelayer-auth");
      toast({
        title: "Connection failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const completeConnection = useMutation({
    mutationFn: async ({ code, connectionId }: { code: string; connectionId: string }) => {
      const redirectUri = `${window.location.origin}/accounts?truelayer_callback=true`;

      // Exchange code for tokens - explicitly pass action
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
        "truelayer-auth",
        {
          body: { action: "exchange-code", code, redirectUri },
        }
      );

      if (tokenError) throw tokenError;
      if (!tokenData?.access_token) throw new Error("No access token returned");

      // Update connection with tokens
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

      const { error: updateError } = await supabase
        .from("bank_connections")
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          status: "connected",
        })
        .eq("id", connectionId);

      if (updateError) throw updateError;

      // Sync accounts and transactions
      const session = await supabase.auth.getSession();
      const { error: syncError } = await supabase.functions.invoke("truelayer-sync", {
        body: {
          connectionId,
          accessToken: tokenData.access_token,
        },
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
      });

      if (syncError) throw syncError;

      return { success: true };
    },
    onSuccess: () => {
      localStorage.removeItem("pending_bank_connection_id");
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
      toast({
        title: "Bank connected!",
        description: "Your accounts and transactions have been synced.",
      });
    },
    onError: (error) => {
      const message = normalizeError(error, "truelayer-auth");
      toast({
        title: "Connection failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const syncConnection = useMutation({
    mutationFn: async (connectionId: string) => {
      // Get connection details
      const { data: connection, error: connError } = await supabase
        .from("bank_connections")
        .select("*")
        .eq("id", connectionId)
        .single();

      if (connError) throw connError;

      let accessToken = connection.access_token;

      // Check if token needs refresh
      if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
        const { data: tokenData, error: refreshError } = await supabase.functions.invoke(
          "truelayer-auth",
          {
            body: { action: "refresh-token", refreshToken: connection.refresh_token },
          }
        );

        if (refreshError) throw refreshError;

        // Update tokens
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

        await supabase
          .from("bank_connections")
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expires_at: expiresAt.toISOString(),
          })
          .eq("id", connectionId);

        accessToken = tokenData.access_token;
      }

      // Sync accounts and transactions
      const session = await supabase.auth.getSession();
      const { error: syncError } = await supabase.functions.invoke("truelayer-sync", {
        body: {
          connectionId,
          accessToken,
        },
        headers: {
          Authorization: `Bearer ${session.data.session?.access_token}`,
        },
      });

      if (syncError) throw syncError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
      toast({
        title: "Sync complete",
        description: "Your accounts and transactions are up to date.",
      });
    },
    onError: (error) => {
      const message = normalizeError(error, "truelayer-sync");
      toast({
        title: "Sync failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (connectionId: string) => {
      const { error } = await supabase
        .from("bank_connections")
        .delete()
        .eq("id", connectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      toast({
        title: "Connection removed",
        description: "Your bank connection has been disconnected.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  return {
    connections: connectionsQuery.data || [],
    isLoading: connectionsQuery.isLoading,
    startConnection,
    completeConnection,
    syncConnection,
    deleteConnection,
  };
}
