import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ImportLog {
  id: string;
  user_id: string;
  imported_at: string;
  file_name: string;
  settings_sheet_name: string | null;
  layout_detected: string | null;
  bills_added: number;
  bills_updated: number;
  bills_skipped: number;
  subs_added: number;
  subs_updated: number;
  subs_skipped: number;
  debts_added: number;
  debts_updated: number;
  debts_skipped: number;
  details: any;
}

export interface ImportLogInsert {
  file_name: string;
  settings_sheet_name?: string | null;
  layout_detected?: string | null;
  mapping_signature?: string | null;
  bills_added?: number;
  bills_updated?: number;
  bills_skipped?: number;
  subs_added?: number;
  subs_updated?: number;
  subs_skipped?: number;
  debts_added?: number;
  debts_updated?: number;
  debts_skipped?: number;
  details?: any;
}

export function useImportLogs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const logsQuery = useQuery({
    queryKey: ["import-logs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("import_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("imported_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as ImportLog[];
    },
    enabled: !!user,
  });

  const createLog = useMutation({
    mutationFn: async (log: ImportLogInsert) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("import_logs")
        .insert({ ...log, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-logs"] });
    },
  });

  return {
    logs: logsQuery.data ?? [],
    isLoading: logsQuery.isLoading,
    createLog,
  };
}
