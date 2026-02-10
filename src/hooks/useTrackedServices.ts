import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface TrackedService {
  id: string;
  user_id: string;
  service_type: string;
  provider: string;
  plan_name: string | null;
  monthly_cost: number;
  contract_start_date: string | null;
  contract_end_date: string | null;
  is_tracking_enabled: boolean;
  last_scan_date: string | null;
  last_recommendation: string | null;
  last_recommendation_reason: string | null;
  estimated_savings_annual: number;
  exit_fee: number;
  notes: string | null;
  status: string;
  current_speed_mbps: number | null;
  preferred_contract_months: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateServiceData {
  service_type: string;
  provider: string;
  plan_name?: string;
  monthly_cost: number;
  contract_start_date?: string;
  contract_end_date?: string;
  exit_fee?: number;
  notes?: string;
  current_speed_mbps?: number;
  preferred_contract_months?: number;
}

export function useTrackedServices() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: services = [], isLoading, error } = useQuery({
    queryKey: ["tracked-services", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("tracked_services")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TrackedService[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateServiceData) => {
      if (!user) throw new Error("Not authenticated");

      const { data: service, error } = await supabase
        .from("tracked_services")
        .insert({
          user_id: user.id,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;
      return service;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracked-services"] });
      toast.success("Service added successfully");
    },
    onError: (error) => {
      toast.error(`Failed to add service: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<TrackedService> & { id: string }) => {
      const { data: updated, error } = await supabase
        .from("tracked_services")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracked-services"] });
      toast.success("Service updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update service: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tracked_services")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracked-services"] });
      toast.success("Service removed successfully");
    },
    onError: (error) => {
      toast.error(`Failed to remove service: ${error.message}`);
    },
  });

  return {
    services,
    isLoading,
    error,
    createService: createMutation.mutate,
    updateService: updateMutation.mutate,
    deleteService: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
