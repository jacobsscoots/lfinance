import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface GroceryOrder {
  id: string;
  user_id: string;
  order_date: string;
  retailer: string;
  order_reference: string | null;
  subtotal: number;
  delivery_cost: number | null;
  total_amount: number;
  dispatch_date: string | null;
  estimated_delivery: string | null;
  actual_delivery: string | null;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  transaction?: {
    id: string;
    description: string;
    amount: number;
    transaction_date: string;
  };
}

export interface GroceryOrderFormData {
  order_date: string;
  retailer: string;
  order_reference?: string | null;
  subtotal: number;
  delivery_cost?: number | null;
  total_amount: number;
  dispatch_date?: string | null;
  estimated_delivery?: string | null;
  actual_delivery?: string | null;
  transaction_id?: string | null;
  notes?: string | null;
}

export function useGroceryOrders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ["grocery-orders", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("grocery_orders")
        .select(`
          *,
          transaction:transactions(id, description, amount, transaction_date)
        `)
        .eq("user_id", user.id)
        .order("order_date", { ascending: false });
      
      if (error) throw error;
      return data as GroceryOrder[];
    },
    enabled: !!user,
  });

  const createOrder = useMutation({
    mutationFn: async (formData: GroceryOrderFormData) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("grocery_orders")
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
      queryClient.invalidateQueries({ queryKey: ["grocery-orders"] });
      toast.success("Order created");
    },
    onError: (error) => {
      toast.error("Failed to create order: " + error.message);
    },
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, ...formData }: GroceryOrderFormData & { id: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("grocery_orders")
        .update(formData)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grocery-orders"] });
      toast.success("Order updated");
    },
    onError: (error) => {
      toast.error("Failed to update order: " + error.message);
    },
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("grocery_orders")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grocery-orders"] });
      toast.success("Order deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete order: " + error.message);
    },
  });

  return {
    orders,
    isLoading,
    error,
    createOrder,
    updateOrder,
    deleteOrder,
  };
}
