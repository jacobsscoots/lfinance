import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type AdjustmentRule = 
  | "previous_working_day" 
  | "next_working_day" 
  | "closest_working_day" 
  | "no_adjustment";

export interface PaydaySettings {
  id: string;
  user_id: string;
  payday_date: number;
  adjustment_rule: AdjustmentRule;
  daily_budget: number;
  created_at: string;
  updated_at: string;
}

export interface PaydaySettingsInput {
  payday_date: number;
  adjustment_rule: AdjustmentRule;
  daily_budget?: number;
}

const DEFAULT_SETTINGS: Omit<PaydaySettings, "id" | "user_id" | "created_at" | "updated_at"> = {
  payday_date: 19,
  adjustment_rule: "previous_working_day",
  daily_budget: 15,
};

export function usePaydaySettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["payday-settings", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("user_payday_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as PaydaySettings | null;
    },
    enabled: !!user?.id,
  });

  const saveSettings = useMutation({
    mutationFn: async (input: PaydaySettingsInput) => {
      if (!user?.id) throw new Error("Not authenticated");

      const upsertData: any = {
        user_id: user.id,
        payday_date: input.payday_date,
        adjustment_rule: input.adjustment_rule,
      };
      if (input.daily_budget !== undefined) {
        upsertData.daily_budget = input.daily_budget;
      }

      const { data, error } = await supabase
        .from("user_payday_settings")
        .upsert(upsertData, { onConflict: "user_id" })
        .select()
        .single();

      if (error) throw error;
      return data as PaydaySettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payday-settings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Payday settings saved");
    },
    onError: (error) => {
      console.error("Failed to save payday settings:", error);
      toast.error("Failed to save settings");
    },
  });

  // Return effective settings (user settings or defaults)
  const effectiveSettings: PaydaySettingsInput & { daily_budget: number } = settings 
    ? { payday_date: settings.payday_date, adjustment_rule: settings.adjustment_rule as AdjustmentRule, daily_budget: Number(settings.daily_budget) || 15 }
    : { ...DEFAULT_SETTINGS };

  return {
    settings,
    effectiveSettings,
    isLoading,
    saveSettings: saveSettings.mutate,
    isSaving: saveSettings.isPending,
  };
}
