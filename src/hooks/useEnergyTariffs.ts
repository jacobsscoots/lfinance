import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface EnergyTariff {
  id: string;
  user_id: string;
  tariff_name: string;
  provider: string;
  fuel_type: string;
  unit_rate_kwh: number;
  standing_charge_daily: number;
  is_fixed: boolean;
  fix_end_date: string | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTariffData {
  tariff_name: string;
  provider: string;
  fuel_type: string;
  unit_rate_kwh: number;
  standing_charge_daily?: number;
  is_fixed?: boolean;
  fix_end_date?: string;
}

export function useEnergyTariffs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tariffs = [], isLoading, error } = useQuery({
    queryKey: ["energy-tariffs", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("energy_tariffs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as EnergyTariff[];
    },
    enabled: !!user,
  });

  const currentTariffs = tariffs.filter((t) => t.is_current);
  const electricityTariff = currentTariffs.find((t) => t.fuel_type === "electricity");
  const gasTariff = currentTariffs.find((t) => t.fuel_type === "gas");

  const createMutation = useMutation({
    mutationFn: async (data: CreateTariffData) => {
      if (!user) throw new Error("Not authenticated");

      // Set any existing tariff for this fuel type to not current
      await supabase
        .from("energy_tariffs")
        .update({ is_current: false })
        .eq("user_id", user.id)
        .eq("fuel_type", data.fuel_type);

      const { data: tariff, error } = await supabase
        .from("energy_tariffs")
        .insert({
          user_id: user.id,
          is_current: true,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;
      return tariff;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["energy-tariffs"] });
      toast.success("Tariff saved successfully");
    },
    onError: (error) => {
      toast.error(`Failed to save tariff: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<EnergyTariff> & { id: string }) => {
      const { data: updated, error } = await supabase
        .from("energy_tariffs")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["energy-tariffs"] });
      toast.success("Tariff updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update tariff: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("energy_tariffs")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["energy-tariffs"] });
      toast.success("Tariff deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete tariff: ${error.message}`);
    },
  });

  return {
    tariffs,
    currentTariffs,
    electricityTariff,
    gasTariff,
    isLoading,
    error,
    createTariff: createMutation.mutate,
    updateTariff: updateMutation.mutate,
    deleteTariff: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
