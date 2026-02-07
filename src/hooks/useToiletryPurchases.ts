import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface ToiletryPurchase {
  id: string;
  user_id: string;
  toiletry_item_id: string;
  transaction_id: string | null;
  order_id: string | null;
  purchase_date: string;
  quantity: number;
  unit_price: number;
  discount_type: string;
  discount_amount: number;
  final_price: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

type PurchaseInsert = Omit<ToiletryPurchase, "id" | "user_id" | "created_at" | "updated_at"> & {
  order_id?: string | null;
};
type PurchaseUpdate = Partial<Omit<ToiletryPurchase, "id" | "user_id" | "created_at" | "updated_at">>;

export function useToiletryPurchases(toiletryItemId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: purchases = [], isLoading, error } = useQuery({
    queryKey: ["toiletry-purchases", user?.id, toiletryItemId],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from("toiletry_purchases")
        .select("*")
        .order("purchase_date", { ascending: false });
      
      if (toiletryItemId) {
        query = query.eq("toiletry_item_id", toiletryItemId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as ToiletryPurchase[];
    },
    enabled: !!user?.id,
  });

  const createPurchase = useMutation({
    mutationFn: async (purchase: PurchaseInsert) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("toiletry_purchases")
        .insert({ ...purchase, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["toiletry-purchases"] });
      toast({ title: "Purchase recorded", description: "Purchase has been linked to the item." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updatePurchase = useMutation({
    mutationFn: async ({ id, ...updates }: PurchaseUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("toiletry_purchases")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["toiletry-purchases"] });
      toast({ title: "Purchase updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deletePurchase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("toiletry_purchases")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["toiletry-purchases"] });
      toast({ title: "Purchase removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return {
    purchases,
    isLoading,
    error,
    createPurchase,
    updatePurchase,
    deletePurchase,
  };
}
