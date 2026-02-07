import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Bill = Tables<"bills"> & {
  category?: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  } | null;
  account_id?: string | null;
  due_date_rule?: string;
};

export type BillInsert = Omit<TablesInsert<"bills">, "user_id">;
export type BillUpdate = TablesUpdate<"bills">;

export function useBills() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const billsQuery = useQuery({
    queryKey: ["bills", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("bills")
        .select(`
          *,
          category:categories(id, name, color, icon),
          account:bank_accounts(id, name)
        `)
        .eq("user_id", user.id)
        .order("due_day", { ascending: true });

      if (error) throw error;
      return data as Bill[];
    },
    enabled: !!user,
  });

  const createBill = useMutation({
    mutationFn: async (bill: BillInsert) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("bills")
        .insert({ ...bill, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-bills"] });
      toast({ title: "Bill created", description: "Your bill has been added successfully." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateBill = useMutation({
    mutationFn: async ({ id, ...updates }: BillUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("bills")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-bills"] });
      toast({ title: "Bill updated", description: "Your bill has been updated successfully." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteBill = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bills").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-bills"] });
      toast({ title: "Bill deleted", description: "Your bill has been removed." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return {
    bills: billsQuery.data || [],
    isLoading: billsQuery.isLoading,
    error: billsQuery.error,
    createBill,
    updateBill,
    deleteBill,
  };
}
