import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface UsageLog {
  id: string;
  user_id: string;
  toiletry_item_id: string;
  logged_date: string;
  amount_used: number;
  notes: string | null;
  created_at: string;
}

export function useToiletryUsageLogs(toiletryItemId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const logsQuery = useQuery({
    queryKey: ["toiletry-usage-logs", user?.id, toiletryItemId],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from("toiletry_usage_logs")
        .select("*")
        .order("logged_date", { ascending: false });

      if (toiletryItemId) {
        query = query.eq("toiletry_item_id", toiletryItemId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as UsageLog[];
    },
    enabled: !!user?.id,
  });

  const logUsage = useMutation({
    mutationFn: async ({
      toiletry_item_id,
      logged_date,
      amount_used,
      notes,
    }: {
      toiletry_item_id: string;
      logged_date: string;
      amount_used: number;
      notes?: string | null;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Upsert: if same item+date exists, add to existing amount
      const { data: existing } = await supabase
        .from("toiletry_usage_logs")
        .select("id, amount_used")
        .eq("toiletry_item_id", toiletry_item_id)
        .eq("logged_date", logged_date)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("toiletry_usage_logs")
          .update({
            amount_used: existing.amount_used + amount_used,
            notes: notes || null,
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from("toiletry_usage_logs")
        .insert({
          user_id: user.id,
          toiletry_item_id,
          logged_date,
          amount_used,
          notes: notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["toiletry-usage-logs"] });
      queryClient.invalidateQueries({ queryKey: ["toiletries"] });
      toast({ title: "Usage logged" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("toiletry_usage_logs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["toiletry-usage-logs"] });
      toast({ title: "Log deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return {
    logs: logsQuery.data ?? [],
    isLoading: logsQuery.isLoading,
    logUsage,
    deleteLog,
  };
}
