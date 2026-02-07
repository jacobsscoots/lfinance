import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface ToiletryOrder {
  id: string;
  user_id: string;
  order_date: string;
  retailer: string;
  order_reference: string | null;
  subtotal: number;
  delivery_cost: number;
  total_amount: number;
  dispatch_date: string | null;
  estimated_delivery: string | null;
  actual_delivery: string | null;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

type OrderInsert = Omit<ToiletryOrder, "id" | "user_id" | "created_at" | "updated_at">;
type OrderUpdate = Partial<Omit<ToiletryOrder, "id" | "user_id" | "created_at" | "updated_at">>;

export function useToiletryOrders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ["toiletry-orders", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("toiletry_orders")
        .select("*")
        .order("order_date", { ascending: false });
      
      if (error) throw error;
      return data as ToiletryOrder[];
    },
    enabled: !!user?.id,
  });

  const createOrder = useMutation({
    mutationFn: async (order: OrderInsert) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("toiletry_orders")
        .insert({ ...order, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["toiletry-orders"] });
      toast({ title: "Order created", description: "Online order has been recorded." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, ...updates }: OrderUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("toiletry_orders")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["toiletry-orders"] });
      toast({ title: "Order updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("toiletry_orders")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["toiletry-orders"] });
      toast({ title: "Order deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
