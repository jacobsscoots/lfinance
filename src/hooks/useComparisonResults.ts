import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface ComparisonResult {
  id: string;
  user_id: string;
  tracked_service_id: string | null;
  service_type: string;
  provider: string;
  plan_name: string | null;
  monthly_cost: number;
  annual_cost: number | null;
  features: Record<string, any> | null;
  source: string;
  scanned_at: string;
  is_best_offer: boolean;
  created_at: string;
}

export interface CreateComparisonData {
  tracked_service_id?: string;
  service_type: string;
  provider: string;
  plan_name?: string;
  monthly_cost: number;
  annual_cost?: number;
  features?: Record<string, any>;
  source?: string;
  is_best_offer?: boolean;
}

export function useComparisonResults(serviceType?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: results = [], isLoading, error } = useQuery({
    queryKey: ["comparison-results", user?.id, serviceType],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("comparison_results")
        .select("*")
        .eq("user_id", user.id)
        .order("scanned_at", { ascending: false })
        .limit(50);

      if (serviceType) {
        query = query.eq("service_type", serviceType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ComparisonResult[];
    },
    enabled: !!user,
  });

  const bestOffers = results.filter((r) => r.is_best_offer);

  const createMutation = useMutation({
    mutationFn: async (data: CreateComparisonData) => {
      if (!user) throw new Error("Not authenticated");

      const { data: result, error } = await supabase
        .from("comparison_results")
        .insert({
          user_id: user.id,
          scanned_at: new Date().toISOString(),
          ...data,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comparison-results"] });
      toast.success("Comparison result saved");
    },
    onError: (error) => {
      toast.error(`Failed to save result: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("comparison_results")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comparison-results"] });
    },
    onError: (error) => {
      toast.error(`Failed to delete result: ${error.message}`);
    },
  });

  return {
    results,
    bestOffers,
    isLoading,
    error,
    createResult: createMutation.mutate,
    deleteResult: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
