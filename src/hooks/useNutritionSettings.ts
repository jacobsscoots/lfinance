import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

import { 
  Sex, 
  ActivityLevel, 
  Formula, 
  GoalType 
} from "@/lib/nutritionTargets";

export type NutritionMode = "target_based" | "manual";

export interface NutritionSettings {
  id: string;
  user_id: string;
  mode: NutritionMode;
  // Weekday targets (Mon-Fri)
  daily_calorie_target: number | null;
  protein_target_grams: number | null;
  carbs_target_grams: number | null;
  fat_target_grams: number | null;
  // Weekend targets (Sat-Sun)
  weekend_calorie_target: number | null;
  weekend_protein_target_grams: number | null;
  weekend_carbs_target_grams: number | null;
  weekend_fat_target_grams: number | null;
  weekend_targets_enabled: boolean;
  // Portioning settings
  min_grams_per_item: number | null;
  max_grams_per_item: number | null;
  portion_rounding: number | null;
  target_tolerance_percent: number | null;
  // Calculator inputs
  age: number | null;
  sex: Sex | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_fat_percent: number | null;
  activity_level: ActivityLevel | null;
  formula: Formula | null;
  goal_type: GoalType | null;
  protein_per_kg: number | null;
  fat_per_kg: number | null;
  last_calculated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NutritionSettingsFormData {
  mode: NutritionMode;
  daily_calorie_target?: number | null;
  protein_target_grams?: number | null;
  carbs_target_grams?: number | null;
  fat_target_grams?: number | null;
  weekend_calorie_target?: number | null;
  weekend_protein_target_grams?: number | null;
  weekend_carbs_target_grams?: number | null;
  weekend_fat_target_grams?: number | null;
  weekend_targets_enabled?: boolean;
  // Portioning settings
  min_grams_per_item?: number | null;
  max_grams_per_item?: number | null;
  portion_rounding?: number | null;
  target_tolerance_percent?: number | null;
  // Calculator inputs
  age?: number | null;
  sex?: Sex | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  body_fat_percent?: number | null;
  activity_level?: ActivityLevel | null;
  formula?: Formula | null;
  goal_type?: GoalType | null;
  protein_per_kg?: number | null;
  fat_per_kg?: number | null;
  last_calculated_at?: string | null;
}

export interface DayTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const DEFAULT_SETTINGS: Omit<NutritionSettings, "id" | "user_id" | "created_at" | "updated_at"> = {
  mode: "manual",
  daily_calorie_target: 2000,
  protein_target_grams: 150,
  carbs_target_grams: 200,
  fat_target_grams: 65,
  weekend_calorie_target: null,
  weekend_protein_target_grams: null,
  weekend_carbs_target_grams: null,
  weekend_fat_target_grams: null,
  weekend_targets_enabled: false,
  min_grams_per_item: 10,
  max_grams_per_item: 500,
  portion_rounding: 5,
  target_tolerance_percent: 2,
  // Calculator defaults
  age: null,
  sex: null,
  height_cm: null,
  weight_kg: null,
  body_fat_percent: null,
  activity_level: null,
  formula: "mifflin_st_jeor",
  goal_type: "maintain",
  protein_per_kg: 2.2,
  fat_per_kg: 0.8,
  last_calculated_at: null,
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

  // Get targets for a specific date (weekday vs weekend)
  const getTargetsForDate = (date: Date): DayTargets => {
    if (!settings) {
      return {
        calories: DEFAULT_SETTINGS.daily_calorie_target || 2000,
        protein: DEFAULT_SETTINGS.protein_target_grams || 150,
        carbs: DEFAULT_SETTINGS.carbs_target_grams || 200,
        fat: DEFAULT_SETTINGS.fat_target_grams || 65,
      };
    }

    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend && settings.weekend_targets_enabled) {
      return {
        calories: settings.weekend_calorie_target ?? settings.daily_calorie_target ?? 2000,
        protein: settings.weekend_protein_target_grams ?? settings.protein_target_grams ?? 150,
        carbs: settings.weekend_carbs_target_grams ?? settings.carbs_target_grams ?? 200,
        fat: settings.weekend_fat_target_grams ?? settings.fat_target_grams ?? 65,
      };
    }

    return {
      calories: settings.daily_calorie_target ?? 2000,
      protein: settings.protein_target_grams ?? 150,
      carbs: settings.carbs_target_grams ?? 200,
      fat: settings.fat_target_grams ?? 65,
    };
  };

  return {
    settings,
    isLoading,
    error,
    upsertSettings,
    isTargetMode: settings?.mode === "target_based",
    getTargetsForDate,
  };
}
