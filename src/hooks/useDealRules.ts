import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface DealRule {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  keywords_include: string[];
  keywords_exclude: string[];
  category: string | null;
  min_price: number | null;
  max_price: number | null;
  min_discount_percent: number | null;
  store_whitelist: string[];
  store_blacklist: string[];
  shipping_filter: string | null;
  location_filter: string | null;
  notify_email: boolean;
  notify_in_app: boolean;
  alert_cooldown_minutes: number;
  last_notified_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useDealRules() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading, error } = useQuery({
    queryKey: ["deal-rules", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("deal_rules")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DealRule[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (rule: {
      name: string;
      enabled?: boolean;
      keywords_include?: string[];
      keywords_exclude?: string[];
      category?: string | null;
      min_price?: number | null;
      max_price?: number | null;
      min_discount_percent?: number | null;
      store_whitelist?: string[];
      store_blacklist?: string[];
      shipping_filter?: string | null;
      location_filter?: string | null;
      notify_email?: boolean;
      notify_in_app?: boolean;
      alert_cooldown_minutes?: number;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("deal_rules")
        .insert({ 
          ...rule, 
          user_id: user.id,
          shipping_filter: rule.shipping_filter ?? null,
          location_filter: rule.location_filter ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-rules"] });
      toast.success("Deal rule created");
    },
    onError: (error) => toast.error(`Failed to create rule: ${error.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DealRule> & { id: string }) => {
      const { data, error } = await supabase
        .from("deal_rules")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-rules"] });
      toast.success("Rule updated");
    },
    onError: (error) => toast.error(`Failed to update rule: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deal_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-rules"] });
      toast.success("Rule deleted");
    },
    onError: (error) => toast.error(`Failed to delete rule: ${error.message}`),
  });

  return {
    rules,
    isLoading,
    error,
    createRule: createMutation.mutate,
    updateRule: updateMutation.mutate,
    deleteRule: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
