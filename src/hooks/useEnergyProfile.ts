import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface EnergyProfile {
  id: string;
  user_id: string;
  // Appliance habits
  eco_mode_dishwasher: boolean;
  eco_mode_washer: boolean;
  low_temp_washing: boolean;
  tumble_dryer_rare: boolean;
  dishwasher_runs_per_week: number;
  washer_runs_per_week: number;
  dryer_runs_per_week: number;
  // Heating & hot water
  heating_type: string | null;
  thermostat_temp_c: number | null;
  smart_thermostat: boolean;
  shower_minutes_avg: number | null;
  // Home details
  home_type: string | null;
  occupants: number;
  work_from_home_days: number;
  // Energy setup
  smart_meter: boolean;
  has_ev: boolean;
  has_solar: boolean;
  tariff_type: string | null;
  peak_time_avoidance: boolean;
  // Custom notes
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PROFILE: Partial<EnergyProfile> = {
  eco_mode_dishwasher: false,
  eco_mode_washer: false,
  low_temp_washing: false,
  tumble_dryer_rare: false,
  dishwasher_runs_per_week: 0,
  washer_runs_per_week: 0,
  dryer_runs_per_week: 0,
  smart_thermostat: false,
  occupants: 1,
  work_from_home_days: 0,
  smart_meter: false,
  has_ev: false,
  has_solar: false,
  peak_time_avoidance: false,
};

export function useEnergyProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["energy-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("energy_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as EnergyProfile | null;
    },
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<EnergyProfile>) => {
      if (!user) throw new Error("Not authenticated");

      const { data: updated, error } = await supabase
        .from("energy_profiles")
        .upsert(
          {
            user_id: user.id,
            ...DEFAULT_PROFILE,
            ...profile,
            ...data,
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["energy-profile"] });
      toast.success("Energy profile saved");
    },
    onError: (error) => {
      toast.error(`Failed to save profile: ${error.message}`);
    },
  });

  // Memoize merged profile to prevent unnecessary re-renders / useEffect triggers
  const mergedProfile = useMemo(() => ({
    ...DEFAULT_PROFILE,
    ...profile,
  } as EnergyProfile), [profile]);

  return {
    profile: mergedProfile,
    isLoading,
    error,
    updateProfile: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
