import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface EnergyReading {
  id: string;
  user_id: string;
  reading_date: string;
  fuel_type: string;
  consumption_kwh: number;
  cost_estimate: number | null;
  source: string;
  created_at: string;
}

export interface CreateReadingData {
  reading_date: string;
  fuel_type: string;
  consumption_kwh: number;
  cost_estimate?: number;
  source?: string;
}

export function useEnergyReadings(fuelType?: string, days: number = 30) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: readings = [], isLoading, error } = useQuery({
    queryKey: ["energy-readings", user?.id, fuelType, days],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("energy_readings")
        .select("*")
        .eq("user_id", user.id)
        .gte("reading_date", startDate.toISOString().split("T")[0])
        .order("reading_date", { ascending: false });

      if (fuelType) {
        query = query.eq("fuel_type", fuelType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as EnergyReading[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateReadingData) => {
      if (!user) throw new Error("Not authenticated");

      const { data: reading, error } = await supabase
        .from("energy_readings")
        .upsert(
          {
            user_id: user.id,
            ...data,
          },
          {
            onConflict: "user_id,reading_date,fuel_type",
          }
        )
        .select()
        .single();

      if (error) throw error;
      return reading;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["energy-readings"] });
      toast.success("Reading saved successfully");
    },
    onError: (error) => {
      toast.error(`Failed to save reading: ${error.message}`);
    },
  });

  const createManyMutation = useMutation({
    mutationFn: async (items: CreateReadingData[]) => {
      if (!user) throw new Error("Not authenticated");

      const insertData = items.map((data) => ({
        user_id: user.id,
        ...data,
      }));

      const { data, error } = await supabase
        .from("energy_readings")
        .upsert(insertData, {
          onConflict: "user_id,reading_date,fuel_type",
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["energy-readings"] });
      toast.success(`Imported ${data.length} readings`);
    },
    onError: (error) => {
      toast.error(`Failed to import readings: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("energy_readings")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["energy-readings"] });
      toast.success("Reading deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete reading: ${error.message}`);
    },
  });

  // Calculate aggregates
  const totalKwh = readings.reduce((sum, r) => sum + Number(r.consumption_kwh), 0);
  const totalCost = readings.reduce((sum, r) => sum + (r.cost_estimate || 0), 0);
  const averageDaily = readings.length > 0 ? totalKwh / readings.length : 0;

  return {
    readings,
    isLoading,
    error,
    createReading: createMutation.mutate,
    createManyReadings: createManyMutation.mutate,
    deleteReading: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isImporting: createManyMutation.isPending,
    isDeleting: deleteMutation.isPending,
    // Aggregates
    totalKwh,
    totalCost,
    averageDaily,
  };
}
