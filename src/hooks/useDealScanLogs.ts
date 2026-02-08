import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface DealScanLog {
  id: string;
  user_id: string;
  source_id: string | null;
  started_at: string;
  ended_at: string | null;
  status: "running" | "success" | "fail" | "partial" | null;
  deals_found: number;
  deals_inserted: number;
  deals_updated: number;
  error_message: string | null;
  request_time_ms: number | null;
  created_at: string;
  deal_sources?: { name: string } | null;
}

export function useDealScanLogs() {
  const { user } = useAuth();

  const { data: logs = [], isLoading, error } = useQuery({
    queryKey: ["deal-scan-logs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("deal_scan_logs")
        .select("*, deal_sources(name)")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as DealScanLog[];
    },
    enabled: !!user,
    refetchInterval: 10000, // Refresh every 10s to show running scans
  });

  return { logs, isLoading, error };
}
