import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { DiscountType } from "@/lib/discounts";

export interface GroceryPurchase {
  id: string;
  user_id: string;
  product_id: string;
  transaction_id: string | null;
  order_id: string | null;
  purchase_date: string;
  quantity: number;
  unit_price: number | null;
  gross_cost: number | null;
  discount_type: DiscountType | null;
  discount_amount: number | null;
  final_cost: number | null;
  grams_purchased: number | null;
  retailer: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  product?: {
    id: string;
    name: string;
    brand: string | null;
    price: number;
    pack_size_grams: number | null;
  };
  transaction?: {
    id: string;
    description: string;
    amount: number;
    transaction_date: string;
  };
}

export interface GroceryPurchaseFormData {
  product_id: string;
  transaction_id?: string | null;
  order_id?: string | null;
  purchase_date: string;
  quantity: number;
  unit_price?: number | null;
  gross_cost?: number | null;
  discount_type?: DiscountType | null;
  discount_amount?: number | null;
  final_cost?: number | null;
  grams_purchased?: number | null;
  retailer?: string | null;
  notes?: string | null;
}

export function useGroceryPurchases() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: purchases = [], isLoading, error } = useQuery({
    queryKey: ["grocery-purchases", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("grocery_purchases")
        .select(`
          *,
          product:products(id, name, brand, price, pack_size_grams),
          transaction:transactions(id, description, amount, transaction_date)
        `)
        .eq("user_id", user.id)
        .order("purchase_date", { ascending: false });
      
      if (error) throw error;
      return data as GroceryPurchase[];
    },
    enabled: !!user,
  });

  const createPurchase = useMutation({
    mutationFn: async (formData: GroceryPurchaseFormData) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("grocery_purchases")
        .insert({
          ...formData,
          user_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grocery-purchases"] });
      toast.success("Purchase recorded");
    },
    onError: (error) => {
      toast.error("Failed to record purchase: " + error.message);
    },
  });

  const createMultiplePurchases = useMutation({
    mutationFn: async (formDataList: GroceryPurchaseFormData[]) => {
      if (!user) throw new Error("Not authenticated");
      
      const purchases = formDataList.map(formData => ({
        ...formData,
        user_id: user.id,
      }));
      
      const { data, error } = await supabase
        .from("grocery_purchases")
        .insert(purchases)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grocery-purchases"] });
      toast.success("Purchases recorded");
    },
    onError: (error) => {
      toast.error("Failed to record purchases: " + error.message);
    },
  });

  const updatePurchase = useMutation({
    mutationFn: async ({ id, ...formData }: GroceryPurchaseFormData & { id: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("grocery_purchases")
        .update(formData)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grocery-purchases"] });
      toast.success("Purchase updated");
    },
    onError: (error) => {
      toast.error("Failed to update purchase: " + error.message);
    },
  });

  const deletePurchase = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("grocery_purchases")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grocery-purchases"] });
      toast.success("Purchase deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete purchase: " + error.message);
    },
  });

  return {
    purchases,
    isLoading,
    error,
    createPurchase,
    createMultiplePurchases,
    updatePurchase,
    deletePurchase,
  };
}
