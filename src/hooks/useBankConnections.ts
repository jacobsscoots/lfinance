import { useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface BankConnection {
  id: string;
  user_id: string;
  provider: string;
  status: string;
  last_synced_at: string | null;
  created_at: string;
}

// Known OAuth error messages for better UX
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  'invalid_grant': 'The authorization code has expired or was already used. Please try connecting again.',
  'invalid_request': 'The connection request was invalid. Please try again.',
  'access_denied': 'Access was denied. Please try connecting again and approve access.',
  'server_error': 'The bank connection service is temporarily unavailable. Please try again later.',
};

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
            // Check if this is a known OAuth error
            const knownMessage = OAUTH_ERROR_MESSAGES[parsed.error];
            if (knownMessage) {
              return knownMessage;
            }
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
      // Check for known OAuth errors in the message
      for (const [code, message] of Object.entries(OAUTH_ERROR_MESSAGES)) {
        if (err.message.includes(code)) {
          return message;
        }
      }
      return `${functionName}: ${err.message}`;
    }
  }

  if (typeof error === "string") {
    // Check for known OAuth errors
    for (const [code, message] of Object.entries(OAUTH_ERROR_MESSAGES)) {
      if (error.includes(code)) {
        return message;
      }
    }
    return `${functionName}: ${error}`;
  }

  return `${functionName}: Connection failed`;
}

export function useBankConnections() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query from secure view that excludes sensitive token columns
  // SECURITY: The base table SELECT is blocked by RLS for authenticated users
  // We MUST use the bank_connections_safe view which excludes tokens
  const connectionsQuery = useQuery({
    queryKey: ["bank-connections", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // CRITICAL: Use the secure view that excludes access_token/refresh_token
      // The base table blocks SELECT for authenticated users (service_role only)
      const { data, error } = await supabase
        .from("bank_connections_safe")
        .select("id, user_id, provider, status, last_synced_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as BankConnection[];
    },
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
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
        .select("id")
        .single();

      if (connError) throw connError;

      try {
        // Get auth URL from edge function - JWT is automatically included
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

      // Exchange code for tokens - tokens are stored server-side, never returned to client
      const { data: exchangeData, error: tokenError } = await supabase.functions.invoke(
        "truelayer-auth",
        {
          body: { action: "exchange-code", code, redirectUri, connectionId },
        }
      );

      if (tokenError) throw tokenError;
      if (!exchangeData?.success) throw new Error("Token exchange failed");

      // Sync accounts and transactions - tokens are fetched server-side
      const { error: syncError } = await supabase.functions.invoke("truelayer-sync", {
        body: { connectionId },
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
      // Simply call sync - all token handling happens server-side
      const { error: syncError } = await supabase.functions.invoke("truelayer-sync", {
        body: { connectionId },
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

  // Auto-sync all connected banks every 5 minutes
  const syncingRef = useRef(false);
  const connections = connectionsQuery.data || [];

  const autoSync = useCallback(async () => {
    if (syncingRef.current || !user) return;
    const connectedIds = connections
      .filter((c) => c.status === "connected")
      .map((c) => c.id);
    if (connectedIds.length === 0) return;

    syncingRef.current = true;
    try {
      for (const id of connectedIds) {
        await supabase.functions.invoke("truelayer-sync", {
          body: { connectionId: id },
        });
      }
      // Silently refresh queries — no toast for background sync
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
    } catch {
      // Background sync failures are silent — user can manually sync
    } finally {
      syncingRef.current = false;
    }
  }, [connections, user, queryClient]);

  useEffect(() => {
    if (!user || connections.length === 0) return;
    const intervalId = setInterval(autoSync, AUTO_SYNC_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [user, connections.length, autoSync]);

  return {
    connections,
    isLoading: connectionsQuery.isLoading,
    startConnection,
    completeConnection,
    syncConnection,
    deleteConnection,
  };
}
