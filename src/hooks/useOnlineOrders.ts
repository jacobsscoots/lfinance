import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface OnlineOrder {
  id: string;
  user_id: string;
  retailer_name: string;
  order_number: string | null;
  order_date: string;
  status: string;
  source: string;
  source_message_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderShipment {
  id: string;
  user_id: string;
  order_id: string;
  tracking_number: string;
  carrier: string | null;
  tracking_provider: string;
  status: string;
  last_event_at: string | null;
  last_payload: any;
  created_at: string;
  updated_at: string;
}

export function useOnlineOrders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ["online-orders", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("online_orders")
        .select("*")
        .order("order_date", { ascending: false });
      if (error) throw error;
      return data as OnlineOrder[];
    },
    enabled: !!user?.id,
  });

  const shipmentsQuery = useQuery({
    queryKey: ["order-shipments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("order_shipments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as OrderShipment[];
    },
    enabled: !!user?.id,
  });

  const createOrder = useMutation({
    mutationFn: async (order: {
      retailer_name: string;
      order_number?: string | null;
      order_date: string;
      status?: string;
      source?: string;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("online_orders")
        .insert({ ...order, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["online-orders"] });
      toast({ title: "Order created" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OnlineOrder> & { id: string }) => {
      const { data, error } = await supabase
        .from("online_orders")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["online-orders"] });
      toast({ title: "Order updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("online_orders")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["online-orders"] });
      toast({ title: "Order deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return {
    orders: ordersQuery.data ?? [],
    shipments: shipmentsQuery.data ?? [],
    isLoading: ordersQuery.isLoading || shipmentsQuery.isLoading,
    createOrder,
    updateOrder,
    deleteOrder,
  };
}
