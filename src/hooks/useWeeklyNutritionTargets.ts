import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { format, parseISO, startOfWeek, getDay } from "date-fns";
import { 
  PlanMode, 
  ZigzagSchedule, 
  WeeklyCalorieSchedule,
  getWeekStartMonday,
  getCaloriesForDate 
} from "@/lib/weekTargets";
import { useNutritionSettings, DayTargets } from "./useNutritionSettings";

export interface WeeklyNutritionTargets {
  id: string;
  user_id: string;
  week_start_date: string;
  plan_mode: PlanMode;
  zigzag_enabled: boolean;
  zigzag_schedule: ZigzagSchedule | null;
  monday_calories: number;
  tuesday_calories: number;
  wednesday_calories: number;
  thursday_calories: number;
  friday_calories: number;
  saturday_calories: number;
  sunday_calories: number;
  protein_target_grams: number | null;
  carbs_target_grams: number | null;
  fat_target_grams: number | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyTargetsInput {
  week_start_date: string;
  plan_mode: PlanMode;
  zigzag_enabled: boolean;
  zigzag_schedule?: ZigzagSchedule | null;
  schedule: WeeklyCalorieSchedule;
  protein_target_grams?: number | null;
  carbs_target_grams?: number | null;
  fat_target_grams?: number | null;
}

export function useWeeklyNutritionTargets(weekStartDate?: Date) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { settings: globalSettings, getTargetsForDate: getGlobalTargetsForDate } = useNutritionSettings();

  const weekStart = weekStartDate ? getWeekStartMonday(weekStartDate) : getWeekStartMonday(new Date());
  const weekStartStr = format(weekStart, "yyyy-MM-dd");

  const { data: weeklyTargets, isLoading } = useQuery({
    queryKey: ["weekly-nutrition-targets", user?.id, weekStartStr],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("weekly_nutrition_targets")
        .select("*")
        .eq("user_id", user.id)
        .eq("week_start_date", weekStartStr)
        .maybeSingle();

      if (error) throw error;
      return data as WeeklyNutritionTargets | null;
    },
    enabled: !!user,
  });

  const saveWeeklyTargets = useMutation({
    mutationFn: async (input: WeeklyTargetsInput) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("weekly_nutrition_targets")
        .upsert(
          {
            user_id: user.id,
            week_start_date: input.week_start_date,
            plan_mode: input.plan_mode,
            zigzag_enabled: input.zigzag_enabled,
            zigzag_schedule: input.zigzag_schedule,
            monday_calories: input.schedule.monday,
            tuesday_calories: input.schedule.tuesday,
            wednesday_calories: input.schedule.wednesday,
            thursday_calories: input.schedule.thursday,
            friday_calories: input.schedule.friday,
            saturday_calories: input.schedule.saturday,
            sunday_calories: input.schedule.sunday,
            protein_target_grams: input.protein_target_grams,
            carbs_target_grams: input.carbs_target_grams,
            fat_target_grams: input.fat_target_grams,
          },
          { onConflict: "user_id,week_start_date" }
        )
        .select()
        .single();

      if (error) throw error;
      return data as WeeklyNutritionTargets;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly-nutrition-targets"] });
      // Cross-invalidate meal plans so they re-render with new targets
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      toast.success("Weekly targets saved");
    },
    onError: (error) => {
      toast.error("Failed to save weekly targets: " + error.message);
    },
  });

  const deleteWeeklyTargets = useMutation({
    mutationFn: async (weekStartDate: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("weekly_nutrition_targets")
        .delete()
        .eq("user_id", user.id)
        .eq("week_start_date", weekStartDate);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly-nutrition-targets"] });
      toast.success("Weekly targets removed");
    },
    onError: (error) => {
      toast.error("Failed to remove weekly targets: " + error.message);
    },
  });

  /**
   * Resolves targets for a specific date.
   * First checks weekly targets, then falls back to global settings.
   */
  const resolveTargetsForDate = (date: Date): DayTargets => {
    if (weeklyTargets) {
      const schedule: WeeklyCalorieSchedule = {
        monday: weeklyTargets.monday_calories,
        tuesday: weeklyTargets.tuesday_calories,
        wednesday: weeklyTargets.wednesday_calories,
        thursday: weeklyTargets.thursday_calories,
        friday: weeklyTargets.friday_calories,
        saturday: weeklyTargets.saturday_calories,
        sunday: weeklyTargets.sunday_calories,
      };

      const dayCals = getCaloriesForDate(date, schedule);
      
      // If zigzag is enabled and we have global weekend targets, use day-appropriate macros
      const dayOfWeek = getDay(date); // 0=Sun, 6=Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (isWeekend && globalSettings?.weekend_targets_enabled) {
        return {
          calories: dayCals,
          protein: globalSettings.weekend_protein_target_grams ?? weeklyTargets.protein_target_grams ?? 150,
          carbs: globalSettings.weekend_carbs_target_grams ?? weeklyTargets.carbs_target_grams ?? 200,
          fat: globalSettings.weekend_fat_target_grams ?? weeklyTargets.fat_target_grams ?? 65,
        };
      }

      return {
        calories: dayCals,
        protein: weeklyTargets.protein_target_grams ?? globalSettings?.protein_target_grams ?? 150,
        carbs: weeklyTargets.carbs_target_grams ?? globalSettings?.carbs_target_grams ?? 200,
        fat: weeklyTargets.fat_target_grams ?? globalSettings?.fat_target_grams ?? 65,
      };
    }

    // Fall back to global settings
    return getGlobalTargetsForDate(date);
  };

  /**
   * Gets the calorie schedule as an array for display.
   */
  const getScheduleArray = (): { day: string; calories: number }[] => {
    if (!weeklyTargets) return [];

    return [
      { day: "Monday", calories: weeklyTargets.monday_calories },
      { day: "Tuesday", calories: weeklyTargets.tuesday_calories },
      { day: "Wednesday", calories: weeklyTargets.wednesday_calories },
      { day: "Thursday", calories: weeklyTargets.thursday_calories },
      { day: "Friday", calories: weeklyTargets.friday_calories },
      { day: "Saturday", calories: weeklyTargets.saturday_calories },
      { day: "Sunday", calories: weeklyTargets.sunday_calories },
    ];
  };

  return {
    weeklyTargets,
    isLoading,
    weekStart,
    weekStartStr,
    saveWeeklyTargets,
    deleteWeeklyTargets,
    resolveTargetsForDate,
    getScheduleArray,
    hasWeeklyTargets: !!weeklyTargets,
  };
}
