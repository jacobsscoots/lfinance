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
  fat?: number | null;
}

/**
 * Get the authoritative daily targets for a specific date.
 *
 * Macro resolution order:
 * 1. If weekend + globalSettings.weekend_targets_enabled → use weekend macros from globalSettings
 * 2. Else if weeklyOverride has explicit macros → use those
 * 3. Else → fall back to globalSettings weekday macros
 *
 * Fat is used from the explicit setting when available, NOT derived.
 * Derivation only happens as a last-resort fallback when no fat target is set.
 *
 * @param date - The date to get targets for (as Date object)
 * @param globalSettings - User's global nutrition settings
 * @param weeklyOverride - Optional weekly targets override for current week
 * @param previousWeekOverride - Optional override from the previous week (for carry-forward)
 * @returns MacroTotals with calories, protein, carbs, and fat
 */
export function getDailyTargets(
  date: Date,
  globalSettings: NutritionSettings | null | undefined,
  weeklyOverride?: WeeklyTargetsOverride | null,
  previousWeekOverride?: WeeklyTargetsOverride | null
): MacroTotals {
  // Default fallback values
  const defaults: MacroTotals = { calories: 2000, protein: 150, carbs: 200, fat: 65 };
  
  if (!globalSettings) {
    return defaults;
  }

  const dayOfWeek = getDay(date); // 0=Sun, 6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let targetCalories: number;
  let targetProtein: number;
  let targetCarbs: number;
  let targetFat: number;

  // Check if weekly override applies to this date
  if (weeklyOverride) {
    const dateWeekStart = getWeekStartMonday(date);
    const dateWeekStartStr = format(dateWeekStart, "yyyy-MM-dd");

    if (dateWeekStartStr === weeklyOverride.weekStartDate) {
      // Use weekly override schedule for calories
      targetCalories = getCaloriesForDate(date, weeklyOverride.schedule);

      // Weekend-specific macros from globalSettings take priority
      if (isWeekend && globalSettings.weekend_targets_enabled) {
        targetProtein = globalSettings.weekend_protein_target_grams ?? globalSettings.protein_target_grams ?? 150;
        targetCarbs = globalSettings.weekend_carbs_target_grams ?? globalSettings.carbs_target_grams ?? 200;
        targetFat = globalSettings.weekend_fat_target_grams ?? globalSettings.fat_target_grams ?? 65;
      } else {
        // Weekday: use weekly override macros if set, else global weekday macros
        targetProtein = weeklyOverride.protein ?? globalSettings.protein_target_grams ?? 150;
        targetCarbs = weeklyOverride.carbs ?? globalSettings.carbs_target_grams ?? 200;
        targetFat = weeklyOverride.fat ?? globalSettings.fat_target_grams ?? 65;
      }

      return {
        calories: targetCalories,
        protein: targetProtein,
        carbs: targetCarbs,
        fat: targetFat,
      };
    }
  }

  // ── Carry-forward from previous week ──
  // When no weekly override exists for the current week, use the previous
  // week's Mon-Fri calorie average for weekday targets so that week-to-week
  // continuity is maintained without the user having to manually re-enter.
  if (previousWeekOverride) {
    const s = previousWeekOverride.schedule;

    if (isWeekend) {
      targetCalories = dayOfWeek === 6 ? s.saturday : s.sunday;
    } else {
      const weekdayAvg = Math.round(
        (s.monday + s.tuesday + s.wednesday + s.thursday + s.friday) / 5
      );
      targetCalories = weekdayAvg;
    }

    // Use weekend-specific macros if applicable
    if (isWeekend && globalSettings.weekend_targets_enabled) {
      targetProtein = globalSettings.weekend_protein_target_grams ?? globalSettings.protein_target_grams ?? 150;
      targetCarbs = globalSettings.weekend_carbs_target_grams ?? globalSettings.carbs_target_grams ?? 200;
      targetFat = globalSettings.weekend_fat_target_grams ?? globalSettings.fat_target_grams ?? 65;
    } else {
      targetProtein = previousWeekOverride.protein ?? globalSettings.protein_target_grams ?? 150;
      targetCarbs = previousWeekOverride.carbs ?? globalSettings.carbs_target_grams ?? 200;
      targetFat = previousWeekOverride.fat ?? globalSettings.fat_target_grams ?? 65;
    }

    return { calories: targetCalories, protein: targetProtein, carbs: targetCarbs, fat: targetFat };
  }

  // Fall back to global settings with weekday/weekend logic
  if (isWeekend && globalSettings.weekend_targets_enabled) {
    targetCalories = globalSettings.weekend_calorie_target ?? globalSettings.daily_calorie_target ?? 2000;
    targetProtein = globalSettings.weekend_protein_target_grams ?? globalSettings.protein_target_grams ?? 150;
    targetCarbs = globalSettings.weekend_carbs_target_grams ?? globalSettings.carbs_target_grams ?? 200;
    targetFat = globalSettings.weekend_fat_target_grams ?? globalSettings.fat_target_grams ?? 65;
  } else {
    targetCalories = globalSettings.daily_calorie_target ?? 2000;
    targetProtein = globalSettings.protein_target_grams ?? 150;
    targetCarbs = globalSettings.carbs_target_grams ?? 200;
    targetFat = globalSettings.fat_target_grams ?? 65;
  }

  return { calories: targetCalories, protein: targetProtein, carbs: targetCarbs, fat: targetFat };
}

/**
 * Parse a date string and get daily targets.
 * Convenience wrapper that handles YYYY-MM-DD strings.
 */
export function getDailyTargetsFromDateString(
  dateString: string,
  globalSettings: NutritionSettings | null | undefined,
  weeklyOverride?: WeeklyTargetsOverride | null,
  previousWeekOverride?: WeeklyTargetsOverride | null
): MacroTotals {
  const date = parse(dateString, "yyyy-MM-dd", new Date());
  return getDailyTargets(date, globalSettings, weeklyOverride, previousWeekOverride);
}

/**
 * Derive fat grams from remaining calories after protein and carbs.
 * 
 * Formula:
 *   remainingCalories = targetCalories - (protein × 4) - (carbs × 4)
 *   fatGrams = remainingCalories / 9
 * 
 * IMPORTANT: Enforces a minimum of 30g fat to ensure feasibility.
 * Real foods (chicken, yogurt, eggs, etc.) contain unavoidable fat.
 * Targets below 30g are physically impossible to hit with whole foods.
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
  const calculatedFat = Math.max(0, Math.round(remainingCalories / 9));
  
  // Enforce minimum 30g fat floor for feasibility
  // Real foods contain unavoidable fat that the algorithm cannot remove
  const MIN_FAT_FLOOR = 30;
  return Math.max(calculatedFat, MIN_FAT_FLOOR);
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

    // Apply eaten_factor so UI totals match what the solver calculated.
    // Without this, items with eaten_factor < 1 show higher macros in the
    // UI than what the solver targeted, causing apparent drift.
    const eatenFactor = product.eaten_factor ?? 1;
    const effectiveGrams = grams * eatenFactor;
    const multiplier = effectiveGrams / 100;
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
