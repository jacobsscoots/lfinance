import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface GmailConnection {
  id: string;
  user_id: string;
  email: string;
  last_synced_at: string | null;
  status: 'active' | 'error' | 'revoked';
  created_at: string;
  updated_at: string;
}

export interface GmailSyncSettings {
  id: string;
  user_id: string;
  auto_attach: boolean;
  scan_days: number;
  allowed_domains: string[] | null;
  created_at: string;
  updated_at: string;
}

export function useGmailConnection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: connection, isLoading: isLoadingConnection } = useQuery({
    queryKey: ["gmail-connection", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .rpc("get_gmail_connections_safe");

      if (error) throw error;
      const rows = data as GmailConnection[] | null;
      return rows && rows.length > 0 ? rows[0] : null;
    },
    enabled: !!user,
  });

  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["gmail-sync-settings", user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("gmail_sync_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as GmailSyncSettings | null;
    },
    enabled: !!user,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      // Call the gmail-oauth edge function to get the OAuth URL
      const { data, error } = await supabase.functions.invoke('gmail-oauth', {
        body: { action: 'get_auth_url', origin: window.location.origin },
      });

      if (error) throw error;
      
      if (data?.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
      }
      
      return data;
    },
    onError: (error) => {
      toast.error(`Failed to connect Gmail: ${error.message}`);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("gmail_connections")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmail-connection"] });
      toast.success("Gmail disconnected successfully");
    },
    onError: (error) => {
      toast.error(`Failed to disconnect Gmail: ${error.message}`);
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<GmailSyncSettings>) => {
      if (!user) throw new Error("Not authenticated");

      const { data: updated, error } = await supabase
        .from("gmail_sync_settings")
        .upsert({
          user_id: user.id,
          ...data,
        }, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gmail-sync-settings"] });
      toast.success("Settings updated");
    },
    onError: (error) => {
      toast.error(`Failed to update settings: ${error.message}`);
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('gmail-sync-receipts', {
        body: { action: 'sync' },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["gmail-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["gmail-connection"] });
      toast.success(`Synced ${data?.receiptsFound || 0} receipts`);
    },
    onError: (error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });

  return {
    connection,
    settings,
    isLoading: isLoadingConnection || isLoadingSettings,
    isConnected: !!connection && connection.status === 'active',
    connect: connectMutation.mutate,
    disconnect: disconnectMutation.mutate,
    updateSettings: updateSettingsMutation.mutate,
    sync: syncMutation.mutate,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    isSyncing: syncMutation.isPending,
  };
}
