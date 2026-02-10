import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface InvestmentTransaction {
  id: string;
  user_id: string;
  investment_account_id: string;
  transaction_date: string;
  type: 'deposit' | 'withdrawal' | 'fee' | 'dividend';
  amount: number;
  units: number | null;
  is_recurring: boolean;
  recurring_frequency: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionData {
  investment_account_id: string;
  transaction_date: string;
  type: 'deposit' | 'withdrawal' | 'fee' | 'dividend';
  amount: number;
  units?: number;
  is_recurring?: boolean;
  recurring_frequency?: string;
  notes?: string;
}

export function useInvestmentTransactions(investmentAccountId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading, error } = useQuery({
    queryKey: ["investment-transactions", investmentAccountId, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from("investment_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("transaction_date", { ascending: false });

      if (investmentAccountId) {
        query = query.eq("investment_account_id", investmentAccountId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as InvestmentTransaction[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateTransactionData) => {
      if (!user) throw new Error("Not authenticated");

      const { data: transaction, error } = await supabase
        .from("investment_transactions")
        .insert({
          user_id: user.id,
          investment_account_id: data.investment_account_id,
          transaction_date: data.transaction_date,
          type: data.type,
          amount: Math.abs(data.amount),
          units: data.units || null,
          is_recurring: data.is_recurring || false,
          recurring_frequency: data.recurring_frequency || null,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investment-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      toast.success("Contribution added successfully");
    },
    onError: (error) => {
      toast.error(`Failed to add contribution: ${error.message}`);
    },
  });

  const createManyMutation = useMutation({
    mutationFn: async (items: CreateTransactionData[]) => {
      if (!user) throw new Error("Not authenticated");

      const insertData = items.map(data => ({
        user_id: user.id,
        investment_account_id: data.investment_account_id,
        transaction_date: data.transaction_date,
        type: data.type,
        amount: Math.abs(data.amount),
        units: data.units || null,
        is_recurring: data.is_recurring || false,
        recurring_frequency: data.recurring_frequency || null,
        notes: data.notes || null,
      }));

      const { data, error } = await supabase
        .from("investment_transactions")
        .insert(insertData)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["investment-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      toast.success(`Imported ${data.length} contributions`);
    },
    onError: (error) => {
      toast.error(`Failed to import contributions: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<InvestmentTransaction> & { id: string }) => {
      const { data: updated, error } = await supabase
        .from("investment_transactions")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investment-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      toast.success("Contribution updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update contribution: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("investment_transactions")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investment-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["investments"] });
      toast.success("Contribution deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete contribution: ${error.message}`);
    },
  });

  return {
    transactions,
    isLoading,
    error,
    createTransaction: createMutation.mutate,
    createManyTransactions: createManyMutation.mutate,
    updateTransaction: updateMutation.mutate,
    deleteTransaction: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isImporting: createManyMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
