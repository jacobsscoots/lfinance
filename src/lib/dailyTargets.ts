/**
 * Single Source of Truth for Daily Nutrition Targets.
 * 
 * This module provides THE authoritative functions for:
 * 1. getDailyTargets() - Returns calorie/macro targets for any date
 * 2. computeTotals() - Calculates achieved macros from items + grams
 * 
 * ALL target resolution and totals computation MUST go through these functions.
 * This ensures UI and Solver always use identical values.
 */

import { parse, getDay } from "date-fns";
import { NutritionSettings } from "@/hooks/useNutritionSettings";
import { MealPlanItem } from "@/hooks/useMealPlanItems";
import { getCaloriesForDate, getWeekStartMonday, WeeklyCalorieSchedule } from "@/lib/weekTargets";
import { format } from "date-fns";

// Re-export MacroTotals for convenience
export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Weekly targets override from the weekly_nutrition_targets table
export interface WeeklyTargetsOverride {
  weekStartDate: string; // YYYY-MM-DD format (Monday)
  schedule: WeeklyCalorieSchedule;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null; // Stored but IGNORED - fat is always derived
}

/**
 * Get the authoritative daily targets for a specific date.
 * 
 * CRITICAL: Fat is ALWAYS derived from remaining calories:
 *   fatGrams = (targetCalories - protein×4 - carbs×4) / 9
 * 
 * This ensures calorie/macro consistency and eliminates drift.
 * 
 * @param date - The date to get targets for (as Date object)
 * @param globalSettings - User's global nutrition settings
 * @param weeklyOverride - Optional weekly targets override
 * @returns MacroTotals with calories, protein, carbs, and DERIVED fat
 */
export function getDailyTargets(
  date: Date,
  globalSettings: NutritionSettings | null | undefined,
  weeklyOverride?: WeeklyTargetsOverride | null
): MacroTotals {
  // Default fallback values
  const defaults: MacroTotals = { calories: 2000, protein: 150, carbs: 200, fat: 65 };
  
  if (!globalSettings) {
    return defaults;
  }

  let targetCalories: number;
  let targetProtein: number;
  let targetCarbs: number;

  // Check if weekly override applies to this date
  if (weeklyOverride) {
    const dateWeekStart = getWeekStartMonday(date);
    const dateWeekStartStr = format(dateWeekStart, "yyyy-MM-dd");
    
    if (dateWeekStartStr === weeklyOverride.weekStartDate) {
      // Use weekly override schedule for calories
      targetCalories = getCaloriesForDate(date, weeklyOverride.schedule);
      
      // Protein and carbs from weekly override, fall back to global
      targetProtein = weeklyOverride.protein ?? globalSettings.protein_target_grams ?? 150;
      targetCarbs = weeklyOverride.carbs ?? globalSettings.carbs_target_grams ?? 200;
      
      // DERIVE fat from remaining calories (ignore stored fat value)
      const derivedFat = deriveFatFromCalories(targetCalories, targetProtein, targetCarbs);
      
      return {
        calories: targetCalories,
        protein: targetProtein,
        carbs: targetCarbs,
        fat: derivedFat,
      };
    }
  }

  // Fall back to global settings with weekday/weekend logic
  const dayOfWeek = getDay(date); // 0 = Sunday, 6 = Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  if (isWeekend && globalSettings.weekend_targets_enabled) {
    targetCalories = globalSettings.weekend_calorie_target ?? globalSettings.daily_calorie_target ?? 2000;
    targetProtein = globalSettings.weekend_protein_target_grams ?? globalSettings.protein_target_grams ?? 150;
    targetCarbs = globalSettings.weekend_carbs_target_grams ?? globalSettings.carbs_target_grams ?? 200;
  } else {
    targetCalories = globalSettings.daily_calorie_target ?? 2000;
    targetProtein = globalSettings.protein_target_grams ?? 150;
    targetCarbs = globalSettings.carbs_target_grams ?? 200;
  }

  // DERIVE fat from remaining calories
  const derivedFat = deriveFatFromCalories(targetCalories, targetProtein, targetCarbs);

  return {
    calories: targetCalories,
    protein: targetProtein,
    carbs: targetCarbs,
    fat: derivedFat,
  };
}

/**
 * Parse a date string and get daily targets.
 * Convenience wrapper that handles YYYY-MM-DD strings.
 */
export function getDailyTargetsFromDateString(
  dateString: string,
  globalSettings: NutritionSettings | null | undefined,
  weeklyOverride?: WeeklyTargetsOverride | null
): MacroTotals {
  const date = parse(dateString, "yyyy-MM-dd", new Date());
  return getDailyTargets(date, globalSettings, weeklyOverride);
}

/**
 * Derive fat grams from remaining calories after protein and carbs.
 * 
 * Formula:
 *   remainingCalories = targetCalories - (protein × 4) - (carbs × 4)
 *   fatGrams = remainingCalories / 9
 * 
 * Clamps to minimum 0g if calories are too low.
 */
export function deriveFatFromCalories(
  targetCalories: number,
  proteinGrams: number,
  carbsGrams: number
): number {
  const proteinCalories = proteinGrams * 4;
  const carbsCalories = carbsGrams * 4;
  const remainingCalories = targetCalories - proteinCalories - carbsCalories;
  
  // Fat = remaining calories / 9
  const fatGrams = Math.max(0, Math.round(remainingCalories / 9));
  
  return fatGrams;
}

/**
 * Compute total macros from a list of meal plan items.
 * 
 * This is THE single function for totals calculation.
 * Both solver success check and UI display must use this.
 * 
 * @param items - Array of MealPlanItem with product data
 * @param gramsOverride - Optional Map to override quantity_grams (e.g., from solver)
 * @returns MacroTotals for the items
 */
export function computeTotals(
  items: MealPlanItem[],
  gramsOverride?: Map<string, number>
): MacroTotals {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;

  for (const item of items) {
    const product = item.product;
    
    // Skip items without product data or with ignore_macros
    if (!product || product.ignore_macros) {
      continue;
    }

    // Use override grams if provided, otherwise use item's stored grams
    const grams = gramsOverride?.get(item.id) ?? item.quantity_grams;
    
    if (grams <= 0) {
      continue;
    }

    const multiplier = grams / 100;
    calories += product.calories_per_100g * multiplier;
    protein += product.protein_per_100g * multiplier;
    carbs += product.carbs_per_100g * multiplier;
    fat += product.fat_per_100g * multiplier;
  }

  return {
    calories,
    protein,
    carbs,
    fat,
  };
}

/**
 * Check if achieved macros are within tolerance of targets.
 * 
 * @param achieved - Computed macro totals
 * @param targets - Target macro totals
 * @param tolerances - Optional custom tolerances (defaults: cal=5, macros=1g)
 * @returns true if all macros within tolerance
 */
export function isWithinTolerance(
  achieved: MacroTotals,
  targets: MacroTotals,
  tolerances: { calories?: number; protein?: number; carbs?: number; fat?: number } = {}
): boolean {
  const calTol = tolerances.calories ?? 5;
  const proTol = tolerances.protein ?? 1;
  const carbTol = tolerances.carbs ?? 1;
  const fatTol = tolerances.fat ?? 1;

  const calDiff = Math.abs(achieved.calories - targets.calories);
  const proDiff = Math.abs(achieved.protein - targets.protein);
  const carbDiff = Math.abs(achieved.carbs - targets.carbs);
  const fatDiff = Math.abs(achieved.fat - targets.fat);

  return calDiff <= calTol && proDiff <= proTol && carbDiff <= carbTol && fatDiff <= fatTol;
}

/**
 * Get detailed difference report between achieved and target macros.
 */
export function getMacroDifferences(
  achieved: MacroTotals,
  targets: MacroTotals
): { macro: string; diff: number; unit: string }[] {
  const diffs: { macro: string; diff: number; unit: string }[] = [];
  
  const calDiff = Math.round(achieved.calories - targets.calories);
  const proDiff = Math.round(achieved.protein - targets.protein);
  const carbDiff = Math.round(achieved.carbs - targets.carbs);
  const fatDiff = Math.round(achieved.fat - targets.fat);

  if (Math.abs(calDiff) >= 5) {
    diffs.push({ macro: "Calories", diff: calDiff, unit: "" });
  }
  if (Math.abs(proDiff) > 1) {
    diffs.push({ macro: "Protein", diff: proDiff, unit: "g" });
  }
  if (Math.abs(carbDiff) > 1) {
    diffs.push({ macro: "Carbs", diff: carbDiff, unit: "g" });
  }
  if (Math.abs(fatDiff) > 1) {
    diffs.push({ macro: "Fat", diff: fatDiff, unit: "g" });
  }

  return diffs;
}
