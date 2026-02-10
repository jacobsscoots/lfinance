import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface InvestmentValuation {
  id: string;
  user_id: string;
  investment_account_id: string;
  valuation_date: string;
  value: number;
  source: 'manual' | 'estimated' | 'live';
  created_at: string;
}

export interface CreateValuationData {
  investment_account_id: string;
  valuation_date: string;
  value: number;
  source?: 'manual' | 'estimated' | 'live';
}

export function useInvestmentValuations(investmentAccountId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: valuations = [], isLoading, error } = useQuery({
    queryKey: ["investment-valuations", investmentAccountId, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from("investment_valuations")
        .select("*")
        .eq("user_id", user.id)
        .order("valuation_date", { ascending: false });

      if (investmentAccountId) {
        query = query.eq("investment_account_id", investmentAccountId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as InvestmentValuation[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateValuationData) => {
      if (!user) throw new Error("Not authenticated");

      const { data: valuation, error } = await supabase
        .from("investment_valuations")
        .upsert({
          user_id: user.id,
          investment_account_id: data.investment_account_id,
          valuation_date: data.valuation_date,
          value: data.value,
          source: data.source || 'manual',
        }, {
          onConflict: 'investment_account_id,valuation_date',
        })
        .select()
        .single();

      if (error) throw error;
      return valuation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investment-valuations"] });
      toast.success("Valuation saved successfully");
    },
    onError: (error) => {
      toast.error(`Failed to save valuation: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("investment_valuations")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investment-valuations"] });
      toast.success("Valuation deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete valuation: ${error.message}`);
    },
  });

  const fetchLivePriceMutation = useMutation({
    mutationFn: async ({ ticker, investment_account_id }: { ticker: string; investment_account_id: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-etf-price`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ ticker, investment_account_id }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Failed to fetch price');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investment-valuations"] });
    },
  });

  return {
    valuations,
    isLoading,
    error,
    createValuation: createMutation.mutate,
    deleteValuation: deleteMutation.mutate,
    fetchLivePrice: fetchLivePriceMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isFetchingPrice: fetchLivePriceMutation.isPending,
  };
}
