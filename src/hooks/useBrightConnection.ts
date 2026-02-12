import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface BrightConnection {
  id: string;
  user_id: string;
  electricity_resource_id: string | null;
  gas_resource_id: string | null;
  last_synced_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useBrightConnection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: connection, isLoading } = useQuery({
    queryKey: ["bright-connection", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .rpc("get_bright_connections_safe");

      if (error) throw error;
      const rows = data as BrightConnection[] | null;
      return rows && rows.length > 0 ? rows[0] : null;
    },
    enabled: !!user,
  });

  const connectMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("bright-sync-readings", {
        body: { action: "connect", username, password },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bright-connection"] });
      toast.success("Smart meter connected successfully!", {
        description: `Found ${data.resources?.length || 0} resource(s)`,
      });
    },
    onError: (error) => {
      toast.error(`Connection failed: ${error.message}`);
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (params?: { from?: string; to?: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("bright-sync-readings", {
        body: { action: "sync", ...params },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bright-connection"] });
      queryClient.invalidateQueries({ queryKey: ["energy-readings"] });
      toast.success("Readings synced!", {
        description: `${data.syncedReadings.electricity} electricity, ${data.syncedReadings.gas} gas readings`,
      });
    },
    onError: (error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("bright-sync-readings", {
        body: { action: "disconnect" },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bright-connection"] });
      toast.success("Smart meter disconnected");
    },
    onError: (error) => {
      toast.error(`Disconnect failed: ${error.message}`);
    },
  });

  return {
    connection,
    isLoading,
    isConnected: connection?.status === "connected",
    isExpired: connection?.status === "expired",
    connect: connectMutation.mutate,
    isConnecting: connectMutation.isPending,
    sync: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
  };
}
