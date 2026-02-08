import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type DebtType = 'credit_card' | 'loan' | 'overdraft' | 'bnpl' | 'other';
export type DebtStatus = 'open' | 'closed';
export type InterestType = 'apr' | 'fixed' | 'none';

export interface Debt {
  id: string;
  user_id: string;
  creditor_name: string;
  debt_type: DebtType;
  starting_balance: number;
  current_balance: number;
  apr: number | null;
  interest_type: InterestType;
  promo_end_date: string | null;
  min_payment: number | null;
  due_day: number | null;
  status: DebtStatus;
  opened_date: string | null;
  closed_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DebtInsert {
  creditor_name: string;
  debt_type: DebtType;
  starting_balance: number;
  current_balance: number;
  apr?: number | null;
  interest_type?: InterestType;
  promo_end_date?: string | null;
  min_payment?: number | null;
  due_day?: number | null;
  status?: DebtStatus;
  opened_date?: string | null;
  notes?: string | null;
}

export interface DebtUpdate extends Partial<DebtInsert> {
  id: string;
  closed_date?: string | null;
}

export function useDebts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const debtsQuery = useQuery({
    queryKey: ["debts", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("debts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Debt[];
    },
    enabled: !!user?.id,
  });

  const createDebt = useMutation({
    mutationFn: async (debt: DebtInsert) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("debts")
        .insert({ ...debt, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      toast.success("Debt added successfully");
    },
    onError: (error) => {
      toast.error("Failed to add debt: " + error.message);
    },
  });

  const updateDebt = useMutation({
    mutationFn: async ({ id, ...updates }: DebtUpdate) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("debts")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      toast.success("Debt updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update debt: " + error.message);
    },
  });

  const deleteDebt = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("debts")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-payments"] });
      toast.success("Debt deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete debt: " + error.message);
    },
  });

  const updateDebtBalance = useMutation({
    mutationFn: async ({ id, newBalance }: { id: string; newBalance: number }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("debts")
        .update({ current_balance: newBalance })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
    },
  });

  return {
    debts: debtsQuery.data ?? [],
    isLoading: debtsQuery.isLoading,
    error: debtsQuery.error,
    createDebt,
    updateDebt,
    deleteDebt,
    updateDebtBalance,
  };
}
