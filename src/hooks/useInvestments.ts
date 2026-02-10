import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface InvestmentAccount {
  id: string;
  user_id: string;
  name: string;
  provider: string | null;
  fund_type: string | null;
  start_date: string;
  expected_annual_return: number;
  compounding_method: string | null;
  risk_preset: string | null;
  notes: string | null;
  status: string;
  monthly_contribution: number | null;
  ticker_symbol: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInvestmentData {
  name: string;
  provider?: string;
  fund_type?: string;
  ticker_symbol?: string;
  start_date: string;
  expected_annual_return?: number;
  compounding_method?: string;
  risk_preset?: string;
  notes?: string;
  initialDeposit?: number;
  recurringAmount?: number;
  recurringFrequency?: string;
}

export function useInvestments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: investments = [], isLoading, error } = useQuery({
    queryKey: ["investments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("investment_accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as InvestmentAccount[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateInvestmentData) => {
      if (!user) throw new Error("Not authenticated");

      // Create the investment account
      const { data: account, error: accountError } = await supabase
        .from("investment_accounts")
        .insert({
          user_id: user.id,
          name: data.name,
          provider: data.provider || null,
          fund_type: data.fund_type || 'fund',
          ticker_symbol: data.ticker_symbol || null,
          start_date: data.start_date,
          expected_annual_return: data.expected_annual_return || 8,
          compounding_method: data.compounding_method || 'daily',
          risk_preset: data.risk_preset || 'medium',
          notes: data.notes || null,
        })
        .select()
        .single();

      if (accountError) throw accountError;

      // If there's an initial deposit, create a transaction
      if (data.initialDeposit && data.initialDeposit > 0) {
        const { error: txError } = await supabase
          .from("investment_transactions")
          .insert({
            user_id: user.id,
            investment_account_id: account.id,
            transaction_date: data.start_date,
            type: 'deposit',
            amount: data.initialDeposit,
            notes: 'Initial investment',
          });

        if (txError) throw txError;
      }

      return account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      toast.success("Investment created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create investment: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<InvestmentAccount> & { id: string }) => {
      const { data: updated, error } = await supabase
        .from("investment_accounts")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      toast.success("Investment updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update investment: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("investment_accounts")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      toast.success("Investment deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete investment: ${error.message}`);
    },
  });

  return {
    investments,
    isLoading,
    error,
    createInvestment: createMutation.mutate,
    updateInvestment: updateMutation.mutate,
    deleteInvestment: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
