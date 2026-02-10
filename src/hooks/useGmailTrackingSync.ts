import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface EmailTrackingExtraction {
  id: string;
  user_id: string;
  provider_message_id: string;
  received_at: string | null;
  from_email: string | null;
  subject: string | null;
  raw_excerpt: string | null;
  extracted_tracking_number: string | null;
  extracted_carrier_code: string | null;
  parse_confidence: number | null;
  created_shipment_id: string | null;
  created_at: string;
}

export function useGmailTrackingSync() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const extractionsQuery = useQuery({
    queryKey: ["email-tracking-extractions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("email_tracking_extractions")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as EmailTrackingExtraction[];
    },
    enabled: !!user?.id,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("gmail-tracking-sync", {
        body: {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["email-tracking-extractions"] });
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["shipment-events"] });
      queryClient.invalidateQueries({ queryKey: ["gmail-connection"] });
      const msg = data?.shipments_created
        ? `Found ${data.extracted} tracking numbers, created ${data.shipments_created} shipments`
        : `Scanned emails — ${data?.extracted || 0} tracking numbers found`;
      toast({ title: "Email sync complete", description: msg });
    },
    onError: (error: Error) => {
      toast({ title: "Email sync failed", description: error.message, variant: "destructive" });
    },
  });

  return {
    extractions: extractionsQuery.data ?? [],
    isLoading: extractionsQuery.isLoading,
    syncTracking: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
  };
}
