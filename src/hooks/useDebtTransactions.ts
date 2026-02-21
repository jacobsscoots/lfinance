import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface DebtTransaction {
  id: string;
  user_id: string;
  transaction_date: string;
  amount: number;
  description: string;
  reference: string | null;
  account_name: string | null;
  created_at: string;
}

export interface DebtTransactionInsert {
  transaction_date: string;
  amount: number;
  description: string;
  reference?: string | null;
  account_name?: string | null;
}

export interface DebtTransactionUpdate extends Partial<DebtTransactionInsert> {
  id: string;
}

export interface PaymentTransactionLink {
  id: string;
  user_id: string;
  payment_id: string;
  transaction_id: string;
  created_at: string;
}

export function useDebtTransactions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const transactionsQuery = useQuery({
    queryKey: ["debt-transactions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .rpc("get_debt_transactions_decrypted");
      
      if (error) throw error;
      // Sort by date descending (RPC doesn't support order)
      const txns = (data || []) as DebtTransaction[];
      return txns.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
    },
    enabled: !!user?.id,
  });

  const linksQuery = useQuery({
    queryKey: ["debt-payment-transactions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("debt_payment_transactions")
        .select("*")
        .eq("user_id", user.id);
      
      if (error) throw error;
      return data as PaymentTransactionLink[];
    },
    enabled: !!user?.id,
  });

  const createTransaction = useMutation({
    mutationFn: async (transaction: DebtTransactionInsert) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("debt_transactions")
        .insert({ ...transaction, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debt-transactions"] });
      toast.success("Transaction added successfully");
    },
    onError: (error) => {
      toast.error("Failed to add transaction: " + error.message);
    },
  });

  const createTransactions = useMutation({
    mutationFn: async (transactions: DebtTransactionInsert[]) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("debt_transactions")
        .insert(transactions.map(t => ({ ...t, user_id: user.id })))
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["debt-transactions"] });
      toast.success(`${data.length} transactions imported successfully`);
    },
    onError: (error) => {
      toast.error("Failed to import transactions: " + error.message);
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...updates }: DebtTransactionUpdate) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("debt_transactions")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debt-transactions"] });
      toast.success("Transaction updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update transaction: " + error.message);
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("debt_transactions")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debt-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["debt-payment-transactions"] });
      toast.success("Transaction deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete transaction: " + error.message);
    },
  });

  const linkTransaction = useMutation({
    mutationFn: async ({ paymentId, transactionId }: { paymentId: string; transactionId: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("debt_payment_transactions")
        .insert({ 
          payment_id: paymentId, 
          transaction_id: transactionId, 
          user_id: user.id 
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debt-payment-transactions"] });
      toast.success("Transaction linked successfully");
    },
    onError: (error) => {
      toast.error("Failed to link transaction: " + error.message);
    },
  });

  const unlinkTransaction = useMutation({
    mutationFn: async ({ paymentId, transactionId }: { paymentId: string; transactionId: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("debt_payment_transactions")
        .delete()
        .eq("payment_id", paymentId)
        .eq("transaction_id", transactionId)
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debt-payment-transactions"] });
      toast.success("Transaction unlinked successfully");
    },
    onError: (error) => {
      toast.error("Failed to unlink transaction: " + error.message);
    },
  });

  // Helper to get linked transaction IDs for a payment
  const getLinkedTransactionIds = (paymentId: string): string[] => {
    return (linksQuery.data ?? [])
      .filter(link => link.payment_id === paymentId)
      .map(link => link.transaction_id);
  };

  // Helper to check if transaction is linked to any payment
  const isTransactionLinked = (transactionId: string): boolean => {
    return (linksQuery.data ?? []).some(link => link.transaction_id === transactionId);
  };

  return {
    transactions: transactionsQuery.data ?? [],
    links: linksQuery.data ?? [],
    isLoading: transactionsQuery.isLoading || linksQuery.isLoading,
    error: transactionsQuery.error || linksQuery.error,
    createTransaction,
    createTransactions,
    updateTransaction,
    deleteTransaction,
    linkTransaction,
    unlinkTransaction,
    getLinkedTransactionIds,
    isTransactionLinked,
  };
}
