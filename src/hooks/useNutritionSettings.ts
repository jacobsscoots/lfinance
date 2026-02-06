import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type NutritionMode = "target_based" | "manual";

export interface NutritionSettings {
  id: string;
  user_id: string;
  mode: NutritionMode;
  daily_calorie_target: number | null;
  protein_target_grams: number | null;
  carbs_target_grams: number | null;
  fat_target_grams: number | null;
  created_at: string;
  updated_at: string;
}

export interface NutritionSettingsFormData {
  mode: NutritionMode;
  daily_calorie_target?: number | null;
  protein_target_grams?: number | null;
  carbs_target_grams?: number | null;
  fat_target_grams?: number | null;
}

const DEFAULT_SETTINGS: Omit<NutritionSettings, "id" | "user_id" | "created_at" | "updated_at"> = {
  mode: "manual",
  daily_calorie_target: 2000,
  protein_target_grams: 150,
  carbs_target_grams: 200,
  fat_target_grams: 65,
};

export function useNutritionSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["nutrition-settings", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_nutrition_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      
      // Return default settings structure if none exists
      if (!data) {
        return {
          ...DEFAULT_SETTINGS,
          id: "",
          user_id: user.id,
          created_at: "",
          updated_at: "",
        } as NutritionSettings;
      }
      
      return data as NutritionSettings;
    },
    enabled: !!user,
  });

  const upsertSettings = useMutation({
    mutationFn: async (formData: NutritionSettingsFormData) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("user_nutrition_settings")
        .upsert({
          user_id: user.id,
          ...formData,
        }, {
          onConflict: "user_id",
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition-settings"] });
      toast.success("Settings saved");
    },
    onError: (error) => {
      toast.error("Failed to save settings: " + error.message);
    },
  });

  return {
    settings,
    isLoading,
    error,
    upsertSettings,
    isTargetMode: settings?.mode === "target_based",
  };
}
