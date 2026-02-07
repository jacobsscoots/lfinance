import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Transaction = Tables<"transactions"> & {
  category?: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  } | null;
  account?: {
    id: string;
    name: string;
  } | null;
  bill?: {
    id: string;
    name: string;
  } | null;
  // Receipt fields (added for attachment support)
  receipt_path?: string | null;
  receipt_uploaded_at?: string | null;
  receipt_source?: string | null;
};

export type TransactionInsert = Omit<TablesInsert<"transactions">, "id" | "created_at" | "updated_at">;
export type TransactionUpdate = TablesUpdate<"transactions">;

export interface TransactionFilters {
  dateFrom?: Date;
  dateTo?: Date;
  categoryId?: string;
  type?: "income" | "expense";
  accountId?: string;
  search?: string;
}

export function useTransactions(filters?: TransactionFilters) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Default to current month if no dates specified
  const dateFrom = filters?.dateFrom || startOfMonth(new Date());
  const dateTo = filters?.dateTo || endOfMonth(new Date());

  const transactionsQuery = useQuery({
    queryKey: ["transactions", user?.id, filters],
    queryFn: async () => {
      if (!user) return [];

      // First get user's account IDs
      const { data: accounts, error: accountsError } = await supabase
        .from("bank_accounts")
        .select("id")
        .eq("user_id", user.id);

      if (accountsError) throw accountsError;
      if (!accounts || accounts.length === 0) return [];

      const accountIds = accounts.map((a) => a.id);

      let query = supabase
        .from("transactions")
        .select(`
          *,
          category:categories(id, name, color, icon),
          account:bank_accounts(id, name),
          bill:bills(id, name)
        `)
        .in("account_id", filters?.accountId ? [filters.accountId] : accountIds)
        .gte("transaction_date", format(dateFrom, "yyyy-MM-dd"))
        .lte("transaction_date", format(dateTo, "yyyy-MM-dd"))
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (filters?.categoryId) {
        query = query.eq("category_id", filters.categoryId);
      }

      if (filters?.type) {
        query = query.eq("type", filters.type);
      }

      if (filters?.search) {
        query = query.or(`description.ilike.%${filters.search}%,merchant.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user,
  });

  const createTransaction = useMutation({
    mutationFn: async (transaction: TransactionInsert) => {
      const { data, error } = await supabase
        .from("transactions")
        .insert(transaction)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["month-summary"] });
      queryClient.invalidateQueries({ queryKey: ["pay-cycle-summary"] });
      queryClient.invalidateQueries({ queryKey: ["total-balance"] });
      toast({ title: "Transaction added", description: "Your transaction has been recorded." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...updates }: TransactionUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("transactions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["month-summary"] });
      queryClient.invalidateQueries({ queryKey: ["pay-cycle-summary"] });
      toast({ title: "Transaction updated", description: "Your transaction has been updated." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["month-summary"] });
      queryClient.invalidateQueries({ queryKey: ["pay-cycle-summary"] });
      toast({ title: "Transaction deleted", description: "Your transaction has been removed." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return {
    transactions: transactionsQuery.data || [],
    isLoading: transactionsQuery.isLoading,
    error: transactionsQuery.error,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
