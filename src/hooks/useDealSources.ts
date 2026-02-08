import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface DealSource {
  id: string;
  user_id: string;
  name: string;
  type: "rss" | "api" | "html" | "manual";
  base_url: string;
  scan_url: string;
  enabled: boolean;
  scan_frequency_minutes: number;
  last_scan_at: string | null;
  last_scan_status: "success" | "fail" | "pending" | null;
  last_error: string | null;
  etag: string | null;
  last_modified: string | null;
  rate_limit_ms: number;
  max_pages: number;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

type DealSourceInsert = {
  name: string;
  type: string;
  base_url: string;
  scan_url: string;
  enabled?: boolean;
  scan_frequency_minutes?: number;
  rate_limit_ms?: number;
  max_pages?: number;
  config?: Record<string, unknown> | null;
};

export function useDealSources() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: sources = [], isLoading, error } = useQuery({
    queryKey: ["deal-sources", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("deal_sources")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DealSource[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (source: DealSourceInsert) => {
      if (!user) throw new Error("Not authenticated");
      const insertData = {
        name: source.name,
        type: source.type,
        base_url: source.base_url,
        scan_url: source.scan_url,
        enabled: source.enabled ?? true,
        scan_frequency_minutes: source.scan_frequency_minutes ?? 60,
        rate_limit_ms: source.rate_limit_ms ?? 1000,
        max_pages: source.max_pages ?? 5,
        config: source.config ? JSON.parse(JSON.stringify(source.config)) : {},
        user_id: user.id,
      };
      const { data, error } = await supabase
        .from("deal_sources")
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-sources"] });
      toast.success("Deal source added");
    },
    onError: (error) => toast.error(`Failed to add source: ${error.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, config, ...updates }: Partial<DealSource> & { id: string }) => {
      const updateData = {
        ...updates,
        ...(config !== undefined ? { config: JSON.parse(JSON.stringify(config)) } : {}),
      };
      const { data, error } = await supabase
        .from("deal_sources")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-sources"] });
      toast.success("Source updated");
    },
    onError: (error) => toast.error(`Failed to update source: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deal_sources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-sources"] });
      toast.success("Source deleted");
    },
    onError: (error) => toast.error(`Failed to delete source: ${error.message}`),
  });

  const scanMutation = useMutation({
    mutationFn: async (sourceId?: string) => {
      const { data, error } = await supabase.functions.invoke("scan-deals", {
        body: { sourceId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["deal-sources"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deal-scan-logs"] });
      queryClient.invalidateQueries({ queryKey: ["deal-notifications"] });
      toast.success(`Scan complete: ${data.newDeals} new deals found`);
    },
    onError: (error) => toast.error(`Scan failed: ${error.message}`),
  });

  return {
    sources,
    isLoading,
    error,
    createSource: createMutation.mutate,
    updateSource: updateMutation.mutate,
    deleteSource: deleteMutation.mutate,
    scanDeals: scanMutation.mutate,
    isScanning: scanMutation.isPending,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
