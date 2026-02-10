import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface Shipment {
  id: string;
  user_id: string;
  order_id: string | null;
  carrier_code: string | null;
  tracking_number: string;
  trackingmore_id: string | null;
  status: string;
  last_event_at: string | null;
  last_synced_at: string | null;
  delivered_at: string | null;
  raw_latest: any;
  created_at: string;
  updated_at: string;
}

export interface ShipmentEvent {
  id: string;
  shipment_id: string;
  event_time: string;
  location: string | null;
  message: string | null;
  status: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  exception: "Exception",
  unknown: "Unknown",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_transit: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  out_for_delivery: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  exception: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  unknown: "bg-muted text-muted-foreground",
};

export function getStatusLabel(status: string) {
  return STATUS_LABELS[status] || status;
}

export function getStatusColor(status: string) {
  return STATUS_COLORS[status] || STATUS_COLORS.unknown;
}

export function useShipments(orderId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const shipmentsQuery = useQuery({
    queryKey: ["shipments", user?.id, orderId],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from("shipments")
        .select("*")
        .order("created_at", { ascending: false });
      if (orderId) query = query.eq("order_id", orderId);
      const { data, error } = await query;
      if (error) throw error;
      return data as Shipment[];
    },
    enabled: !!user?.id,
  });

  const eventsQuery = useQuery({
    queryKey: ["shipment-events", user?.id, orderId],
    queryFn: async () => {
      if (!user?.id) return [];
      // Get shipment ids first
      const shipmentIds = shipmentsQuery.data?.map((s) => s.id) || [];
      if (shipmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("shipment_events")
        .select("*")
        .in("shipment_id", shipmentIds)
        .order("event_time", { ascending: false });
      if (error) throw error;
      return data as ShipmentEvent[];
    },
    enabled: !!user?.id && (shipmentsQuery.data?.length ?? 0) > 0,
  });

  const registerTracking = useMutation({
    mutationFn: async (params: { tracking_number: string; carrier_code?: string; order_id?: string }) => {
      const { data, error } = await supabase.functions.invoke("trackingmore-register", {
        body: params,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["shipment-events"] });
      if (data?.registration_error) {
        toast({
          title: "Tracking registered locally",
          description: `Warning: ${data.registration_error}`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Tracking registered", description: "Auto-updates enabled" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed to register tracking", description: error.message, variant: "destructive" });
    },
  });

  const deleteShipment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shipments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["shipment-events"] });
      toast({ title: "Tracking removed" });
    },
  });

  return {
    shipments: shipmentsQuery.data ?? [],
    events: eventsQuery.data ?? [],
    isLoading: shipmentsQuery.isLoading,
    registerTracking,
    deleteShipment,
    refetch: () => {
      shipmentsQuery.refetch();
      eventsQuery.refetch();
    },
  };
}
