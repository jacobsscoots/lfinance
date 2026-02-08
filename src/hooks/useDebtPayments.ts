import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type PaymentCategory = 'normal' | 'extra' | 'fee' | 'refund' | 'adjustment';

export interface DebtPayment {
  id: string;
  user_id: string;
  debt_id: string;
  payment_date: string;
  amount: number;
  category: PaymentCategory;
  principal_amount: number | null;
  interest_amount: number | null;
  fee_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DebtPaymentWithDebt extends DebtPayment {
  debts?: {
    creditor_name: string;
    debt_type: string;
  };
}

export interface DebtPaymentInsert {
  debt_id: string;
  payment_date: string;
  amount: number;
  category?: PaymentCategory;
  principal_amount?: number | null;
  interest_amount?: number | null;
  fee_amount?: number | null;
  notes?: string | null;
}

export interface DebtPaymentUpdate extends Partial<DebtPaymentInsert> {
  id: string;
}

export function useDebtPayments(debtId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const paymentsQuery = useQuery({
    queryKey: ["debt-payments", user?.id, debtId],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from("debt_payments")
        .select(`
          *,
          debts (
            creditor_name,
            debt_type
          )
        `)
        .eq("user_id", user.id)
        .order("payment_date", { ascending: false });
      
      if (debtId) {
        query = query.eq("debt_id", debtId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as DebtPaymentWithDebt[];
    },
    enabled: !!user?.id,
  });

  const createPayment = useMutation({
    mutationFn: async (payment: DebtPaymentInsert) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("debt_payments")
        .insert({ ...payment, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["debt-payments"] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-snapshots"] });
      toast.success("Payment logged successfully");
    },
    onError: (error) => {
      toast.error("Failed to log payment: " + error.message);
    },
  });

  const updatePayment = useMutation({
    mutationFn: async ({ id, ...updates }: DebtPaymentUpdate) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("debt_payments")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debt-payments"] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      toast.success("Payment updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update payment: " + error.message);
    },
  });

  const deletePayment = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("debt_payments")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debt-payments"] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      toast.success("Payment deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete payment: " + error.message);
    },
  });

  return {
    payments: paymentsQuery.data ?? [],
    isLoading: paymentsQuery.isLoading,
    error: paymentsQuery.error,
    createPayment,
    updatePayment,
    deletePayment,
  };
}
