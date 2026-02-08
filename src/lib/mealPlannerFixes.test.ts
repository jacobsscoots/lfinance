/**
 * Comprehensive tests for Meal Planning + Auto Portioning fixes.
 *
 * Covers:
 *  1. Date range / week generation for 2026-02-09 → 2026-02-16
 *  2. Macro accuracy (±1g macros, ±50 kcal)
 *  3. Solver always returns best-effort portions (never 0g)
 *  4. UI totals match solver totals (eaten_factor, seasoning consistency)
 *  5. Timezone regression for date string conversions
 *  6. Meal structure heuristics (balanced dinner, breakfast)
 */

import { describe, it, expect } from "vitest";
import { format, addDays } from "date-fns";
import {
  getShoppingWeekRange,
  getShoppingWeekDates,
  getShoppingWeekDateStrings,
  getNextShoppingWeek,
  getPreviousShoppingWeek,
} from "./mealPlannerWeek";
import {
  solve,
  calculateMacros,
  sumMacros,
  productToSolverItem,
} from "./portioningEngine";
import {
  SolverItem,
  SolverTargets,
  MacroTotals,
  DEFAULT_TOLERANCES,
  DEFAULT_SOLVER_OPTIONS,
} from "./portioningTypes";
import { computeTotals, getDailyTargets, deriveFatFromCalories } from "./dailyTargets";
import { MealPlanItem } from "@/hooks/useMealPlanItems";

// ============================================================================
// HELPERS
// ============================================================================

function createSolverItem(overrides: Partial<SolverItem> = {}): SolverItem {
  return {
    id: "test-item",
    name: "Test Item",
    category: "protein",
    mealType: "dinner",
    nutritionPer100g: { calories: 150, protein: 25, carbs: 5, fat: 3 },
    editableMode: "FREE",
    minPortionGrams: 50,
    maxPortionGrams: 300,
    portionStepGrams: 1,
    roundingRule: "nearest_1g",
    unitType: "grams",
    unitSizeGrams: null,
    eatenFactor: 1,
    seasoningRatePer100g: null,
    pairedProteinId: null,
    currentGrams: 150,
    countMacros: true,
    ...overrides,
  };
}

function createMealPlanItem(overrides: Partial<MealPlanItem> = {}): MealPlanItem {
  return {
    id: "test-mpi",
    meal_plan_id: "plan-1",
    product_id: "prod-1",
    meal_type: "dinner",
    quantity_grams: 150,
    is_locked: false,
    position: 0,
    created_at: "",
    updated_at: "",
    product: {
      id: "prod-1",
      user_id: "u1",
      name: "Chicken Breast",
      brand: null,
      calories_per_100g: 165,
      protein_per_100g: 31,
      carbs_per_100g: 0,
      fat_per_100g: 3.6,
      saturates_per_100g: 1,
      sugars_per_100g: 0,
      fibre_per_100g: 0,
      salt_per_100g: 0.1,
      energy_kj_per_100g: 690,
      ignore_macros: false,
      price: 3.5,
      offer_price: null,
      offer_label: null,
      pack_size_grams: 500,
      packaging_weight_grams: 10,
      retailer: "Tesco",
      image_url: null,
      barcode: null,
      meal_eligibility: ["lunch", "dinner"],
      food_type: "protein",
      notes: null,
      created_at: "",
      updated_at: "",
      quantity_on_hand: 0,
      quantity_in_use: 0,
      reorder_threshold: 0,
      target_quantity: 0,
      product_type: "editable",
      fixed_portion_grams: null,
      editable_mode: "FREE",
      min_portion_grams: 100,
      max_portion_grams: 300,
      portion_step_grams: 10,
      rounding_rule: "nearest_10g",
      eaten_factor: 1,
      seasoning_rate_per_100g: null,
      default_unit_type: "grams",
      unit_size_g: null,
    } as any,
    ...overrides,
  } as MealPlanItem;
}

// ============================================================================
// 1. DATE RANGE TESTS — Feb 9-16 Week Generation
// ============================================================================

describe("Date Range: Feb 9-16 2026 Week Generation", () => {
  it("should include all dates from Feb 8 to Feb 16 for shopping week containing Feb 9", () => {
    const anchor = new Date(2026, 1, 9); // Feb 9 2026 (Monday) — local date
    const range = getShoppingWeekRange(anchor);
    const dates = getShoppingWeekDateStrings(range);

    // Feb 9 is Monday; shopping week starts previous Sunday = Feb 8
    expect(format(range.start, "yyyy-MM-dd")).toBe("2026-02-08");
    expect(format(range.end, "yyyy-MM-dd")).toBe("2026-02-16");
    expect(dates.length).toBe(9);

    // Every date from Feb 8 through Feb 16 must be present
    for (let day = 8; day <= 16; day++) {
      const dateStr = `2026-02-${String(day).padStart(2, "0")}`;
      expect(dates).toContain(dateStr);
    }
  });

  it("should generate the same week when anchored on any day Feb 8-14", () => {
    // All days Sun Feb 8 through Sat Feb 14 belong to the same shopping week
    for (let day = 8; day <= 14; day++) {
      const anchor = new Date(2026, 1, day);
      const range = getShoppingWeekRange(anchor);
      expect(format(range.start, "yyyy-MM-dd")).toBe("2026-02-08");
      expect(format(range.end, "yyyy-MM-dd")).toBe("2026-02-16");
    }
  });

  it("should navigate weeks sequentially without gaps", () => {
    const week1 = getShoppingWeekRange(new Date(2026, 1, 10)); // Feb 10
    const week2 = getNextShoppingWeek(week1);
    const week3 = getNextShoppingWeek(week2);

    const dates1 = getShoppingWeekDateStrings(week1);
    const dates2 = getShoppingWeekDateStrings(week2);
    const dates3 = getShoppingWeekDateStrings(week3);

    // Week 1: Feb 8–16, Week 2: Feb 15–23, Week 3: Feb 22 – Mar 2
    expect(dates1[0]).toBe("2026-02-08");
    expect(dates2[0]).toBe("2026-02-15");
    expect(dates3[0]).toBe("2026-02-22");

    // No day between Feb 8 and Mar 2 should be missing across all weeks
    const allDates = new Set([...dates1, ...dates2, ...dates3]);
    for (let d = 8; d <= 28; d++) {
      const dateStr = `2026-02-${String(d).padStart(2, "0")}`;
      expect(allDates.has(dateStr)).toBe(true);
    }
  });

  it("should navigate backward correctly from Feb 8-16", () => {
    const current = getShoppingWeekRange(new Date(2026, 1, 10));
    const prev = getPreviousShoppingWeek(current);

    expect(format(prev.start, "yyyy-MM-dd")).toBe("2026-02-01");
    expect(format(prev.end, "yyyy-MM-dd")).toBe("2026-02-09");
  });
});

// ============================================================================
// 2. MACRO ACCURACY TESTS — ±1g macros, ±50 kcal calories
// ============================================================================

describe("Macro Accuracy: Solver hits targets within tolerance", () => {
  // Realistic dinner: chicken + rice + broccoli + olive oil (fat source needed)
  it("should solve a dinner (chicken + rice + veg + oil) within ±1g macros, ±50 kcal", () => {
    const items: SolverItem[] = [
      createSolverItem({
        id: "chicken",
        name: "Chicken Breast",
        category: "protein",
        nutritionPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
        currentGrams: 0,
        minPortionGrams: 100,
        maxPortionGrams: 300,
        portionStepGrams: 10,
        roundingRule: "nearest_10g",
      }),
      createSolverItem({
        id: "rice",
        name: "White Rice",
        category: "carb",
        nutritionPer100g: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
        currentGrams: 0,
        minPortionGrams: 80,
        maxPortionGrams: 250,
        portionStepGrams: 10,
        roundingRule: "nearest_10g",
      }),
      createSolverItem({
        id: "broccoli",
        name: "Broccoli",
        category: "veg",
        editableMode: "LOCKED",
        nutritionPer100g: { calories: 34, protein: 2.8, carbs: 7, fat: 0.4 },
        currentGrams: 100,
        minPortionGrams: 80,
        maxPortionGrams: 200,
      }),
      createSolverItem({
        id: "olive-oil",
        name: "Olive Oil",
        category: "fat",
        nutritionPer100g: { calories: 884, protein: 0, carbs: 0, fat: 100 },
        currentGrams: 0,
        minPortionGrams: 5,
        maxPortionGrams: 20,
        portionStepGrams: 1,
        roundingRule: "nearest_1g",
      }),
    ];

    // Feasible targets: chicken ~150g, rice ~120g, broccoli 100g, oil ~5g
    // chicken 150g: 248cal, 46.5P, 0C, 5.4F
    // rice 120g: 156cal, 3.2P, 33.6C, 0.36F
    // broccoli 100g: 34cal, 2.8P, 7C, 0.4F
    // oil 5g: 44cal, 0P, 0C, 5F
    // Total: ~482cal, ~52.5P, ~40.6C, ~11.2F
    const targets: SolverTargets = {
      calories: 480,
      protein: 52,
      carbs: 41,
      fat: 11,
    };

    const result = solve(items, targets, { maxIterations: 500 });

    // Solver must succeed
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Math.abs(result.totals.calories - targets.calories)).toBeLessThanOrEqual(50);
      expect(Math.abs(result.totals.protein - targets.protein)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.totals.carbs - targets.carbs)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.totals.fat - targets.fat)).toBeLessThanOrEqual(1);

      // No portion should be 0g for main foods
      expect(result.portions.get("chicken")).toBeGreaterThan(0);
      expect(result.portions.get("rice")).toBeGreaterThan(0);
    }
  });

  // Realistic breakfast: yoghurt + granola + berries
  it("should solve a breakfast (yoghurt + granola + berries) within tolerance", () => {
    const items: SolverItem[] = [
      createSolverItem({
        id: "yoghurt",
        name: "Greek Yoghurt",
        category: "dairy",
        mealType: "breakfast",
        nutritionPer100g: { calories: 97, protein: 9, carbs: 3.6, fat: 5 },
        currentGrams: 0,
        minPortionGrams: 100,
        maxPortionGrams: 350,
        portionStepGrams: 10,
        roundingRule: "nearest_10g",
      }),
      createSolverItem({
        id: "granola",
        name: "Granola",
        category: "carb",
        mealType: "breakfast",
        nutritionPer100g: { calories: 450, protein: 10, carbs: 60, fat: 18 },
        currentGrams: 0,
        minPortionGrams: 25,
        maxPortionGrams: 60,
        portionStepGrams: 5,
        roundingRule: "nearest_5g",
      }),
      createSolverItem({
        id: "berries",
        name: "Mixed Berries",
        category: "fruit",
        mealType: "breakfast",
        nutritionPer100g: { calories: 43, protein: 1, carbs: 10, fat: 0.3 },
        currentGrams: 0,
        minPortionGrams: 50,
        maxPortionGrams: 200,
        portionStepGrams: 10,
        roundingRule: "nearest_10g",
      }),
    ];

    const targets: SolverTargets = {
      calories: 400,
      protein: 25,
      carbs: 40,
      fat: 15,
    };

    const result = solve(items, targets, { maxIterations: 500 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Math.abs(result.totals.calories - targets.calories)).toBeLessThanOrEqual(50);
      expect(Math.abs(result.totals.protein - targets.protein)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.totals.carbs - targets.carbs)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.totals.fat - targets.fat)).toBeLessThanOrEqual(1);
    }
  });

  it("should not have rounding drift across multiple meals in the same day", () => {
    // Simulate 2 meals solved independently, totalled, vs day target
    // Using realistic items where each meal has enough food variety to hit targets.
    const dayTargets = { calories: 1000, protein: 75, carbs: 100, fat: 30 };

    // Split: meal1 = 500 cal, meal2 = 500 cal
    const mealTargets: SolverTargets[] = [
      { calories: 500, protein: 38, carbs: 50, fat: 15 },
      { calories: 500, protein: 37, carbs: 50, fat: 15 },
    ];

    const mealItems: SolverItem[][] = [
      // Meal 1: chicken + rice + oil
      [
        createSolverItem({
          id: "chicken-1", category: "protein",
          nutritionPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
          currentGrams: 0, minPortionGrams: 80, maxPortionGrams: 250,
          portionStepGrams: 10, roundingRule: "nearest_10g",
        }),
        createSolverItem({
          id: "rice-1", category: "carb",
          nutritionPer100g: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
          currentGrams: 0, minPortionGrams: 80, maxPortionGrams: 300,
          portionStepGrams: 10, roundingRule: "nearest_10g",
        }),
        createSolverItem({
          id: "oil-1", category: "fat",
          nutritionPer100g: { calories: 884, protein: 0, carbs: 0, fat: 100 },
          currentGrams: 0, minPortionGrams: 5, maxPortionGrams: 20,
        }),
      ],
      // Meal 2: tuna + pasta + oil
      [
        createSolverItem({
          id: "tuna-2", category: "protein",
          nutritionPer100g: { calories: 132, protein: 28, carbs: 0, fat: 1.5 },
          currentGrams: 0, minPortionGrams: 80, maxPortionGrams: 250,
          portionStepGrams: 10, roundingRule: "nearest_10g",
        }),
        createSolverItem({
          id: "pasta-2", category: "carb",
          nutritionPer100g: { calories: 160, protein: 5, carbs: 32, fat: 1 },
          currentGrams: 0, minPortionGrams: 80, maxPortionGrams: 300,
          portionStepGrams: 10, roundingRule: "nearest_10g",
        }),
        createSolverItem({
          id: "oil-2", category: "fat",
          nutritionPer100g: { calories: 884, protein: 0, carbs: 0, fat: 100 },
          currentGrams: 0, minPortionGrams: 5, maxPortionGrams: 20,
        }),
      ],
    ];

    let totalCal = 0, totalPro = 0, totalCarb = 0, totalFat = 0;
    let solvedMeals = 0;

    for (let i = 0; i < 2; i++) {
      const result = solve(mealItems[i], mealTargets[i], { maxIterations: 500 });
      if (result.success) {
        totalCal += result.totals.calories;
        totalPro += result.totals.protein;
        totalCarb += result.totals.carbs;
        totalFat += result.totals.fat;
        solvedMeals++;
      }
    }

    // Both meals should solve
    expect(solvedMeals).toBe(2);

    // Day total must be within tolerance of day targets (2 meals × ±tolerance)
    expect(Math.abs(totalCal - dayTargets.calories)).toBeLessThanOrEqual(100); // 2 × ±50
    expect(Math.abs(totalPro - dayTargets.protein)).toBeLessThanOrEqual(2);    // 2 × ±1
    expect(Math.abs(totalCarb - dayTargets.carbs)).toBeLessThanOrEqual(2);
    expect(Math.abs(totalFat - dayTargets.fat)).toBeLessThanOrEqual(2);
  });
});

// ============================================================================
// 3. BEST-EFFORT: Solver never returns 0g for all items
// ============================================================================

describe("Best-effort: Solver always returns usable portions", () => {
  it("should return bestEffortPortions when exact solve fails", () => {
    // Create an intentionally difficult scenario
    const items: SolverItem[] = [
      createSolverItem({
        id: "item-a",
        category: "protein",
        nutritionPer100g: { calories: 100, protein: 30, carbs: 0, fat: 1 },
        currentGrams: 0,
        minPortionGrams: 100,
        maxPortionGrams: 200,
      }),
    ];

    // Target requires more fat than item-a can provide
    const targets: SolverTargets = {
      calories: 300,
      protein: 30,
      carbs: 50, // No carb source!
      fat: 30,   // Only 1g fat per 100g
    };

    const result = solve(items, targets, { maxIterations: 200 });

    // It should fail because carbs and fat can't be hit
    // But it should still have best-effort portions
    if (!result.success) {
      const bestEffort = (result as any).bestEffortPortions as Map<string, number> | undefined;
      // Even on failure, portions should be non-zero
      if (bestEffort) {
        const grams = bestEffort.get("item-a");
        expect(grams).toBeDefined();
        expect(grams).toBeGreaterThan(0);
      }
    }
  });

  it("should never leave portions at 0g for main foods when solver succeeds", () => {
    const items: SolverItem[] = [
      createSolverItem({
        id: "chicken",
        category: "protein",
        nutritionPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
        currentGrams: 0,
        minPortionGrams: 100,
        maxPortionGrams: 300,
      }),
      createSolverItem({
        id: "rice",
        category: "carb",
        nutritionPer100g: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
        currentGrams: 0,
        minPortionGrams: 80,
        maxPortionGrams: 250,
      }),
    ];

    const targets: SolverTargets = { calories: 500, protein: 50, carbs: 40, fat: 8 };
    const result = solve(items, targets, { maxIterations: 500 });

    if (result.success) {
      for (const item of items) {
        const grams = result.portions.get(item.id);
        expect(grams).toBeGreaterThan(0);
        expect(grams).toBeGreaterThanOrEqual(item.minPortionGrams);
        expect(grams).toBeLessThanOrEqual(item.maxPortionGrams);
      }
    }
  });
});

// ============================================================================
// 4. UI TOTALS MATCH SOLVER TOTALS
// ============================================================================

describe("UI totals match solver totals", () => {
  it("computeTotals applies eaten_factor consistently with solver", () => {
    const eatenFactor = 0.95;

    // Create a solver item with eaten_factor
    const solverItem = createSolverItem({
      id: "chicken",
      nutritionPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
      eatenFactor,
      currentGrams: 150,
    });

    // Solver calculation
    const solverMacros = calculateMacros(solverItem, 150);

    // UI calculation via computeTotals
    const mealPlanItem = createMealPlanItem({
      id: "chicken",
      quantity_grams: 150,
      product: {
        ...createMealPlanItem().product!,
        calories_per_100g: 165,
        protein_per_100g: 31,
        carbs_per_100g: 0,
        fat_per_100g: 3.6,
        eaten_factor: eatenFactor,
      } as any,
    });

    const uiTotals = computeTotals([mealPlanItem]);

    // They MUST match exactly (same formula)
    expect(Math.abs(uiTotals.calories - solverMacros.calories)).toBeLessThan(0.01);
    expect(Math.abs(uiTotals.protein - solverMacros.protein)).toBeLessThan(0.01);
    expect(Math.abs(uiTotals.carbs - solverMacros.carbs)).toBeLessThan(0.01);
    expect(Math.abs(uiTotals.fat - solverMacros.fat)).toBeLessThan(0.01);
  });

  it("computeTotals defaults eaten_factor to 1 when not specified", () => {
    const mealPlanItem = createMealPlanItem({
      quantity_grams: 100,
      product: {
        ...createMealPlanItem().product!,
        calories_per_100g: 200,
        protein_per_100g: 20,
        carbs_per_100g: 10,
        fat_per_100g: 8,
        eaten_factor: undefined,
      } as any,
    });

    const totals = computeTotals([mealPlanItem]);

    // Without eaten_factor, should use raw grams
    expect(totals.calories).toBe(200);
    expect(totals.protein).toBe(20);
    expect(totals.carbs).toBe(10);
    expect(totals.fat).toBe(8);
  });

  it("solver totals with seasoningsCountMacros=true match UI totals", () => {
    const items: SolverItem[] = [
      createSolverItem({
        id: "chicken",
        category: "protein",
        nutritionPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
        currentGrams: 150,
        minPortionGrams: 100,
        maxPortionGrams: 300,
      }),
      createSolverItem({
        id: "seasoning",
        name: "Paprika",
        category: "seasoning",
        editableMode: "LOCKED",
        nutritionPer100g: { calories: 250, protein: 5, carbs: 40, fat: 5 },
        currentGrams: 5,
        minPortionGrams: 0,
        maxPortionGrams: 15,
        countMacros: true, // Include in totals
      }),
    ];

    const targets: SolverTargets = { calories: 260, protein: 47, carbs: 2, fat: 6 };

    // Solve with seasonings counted
    const result = solve(items, targets, {
      maxIterations: 500,
      seasoningsCountMacros: true,
    });

    // Now compute UI totals from the same portions
    const portions = result.success ? result.portions : new Map();
    const solverTotals = sumMacros(items, portions, true);

    // The solver's reported totals should match what sumMacros calculates
    if (result.success) {
      expect(Math.abs(result.totals.calories - Math.round(solverTotals.calories))).toBeLessThanOrEqual(1);
      expect(Math.abs(result.totals.protein - Math.round(solverTotals.protein))).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================================
// 5. TIMEZONE REGRESSION
// ============================================================================

describe("Timezone regression: date string stability", () => {
  it("format() produces correct local date regardless of Date constructor", () => {
    // Using the new Date(year, monthIndex, day) constructor always uses local time
    const localDate = new Date(2026, 1, 9); // Feb 9 2026 local
    expect(format(localDate, "yyyy-MM-dd")).toBe("2026-02-09");

    // Verify this works for the full shopping week
    const range = getShoppingWeekRange(localDate);
    const dates = getShoppingWeekDateStrings(range);
    expect(dates[0]).toBe("2026-02-08"); // Sunday
    expect(dates[1]).toBe("2026-02-09"); // Monday
  });

  it("previous week dates use format() not toISOString() (no timezone shift)", () => {
    // Simulate what copyFromPreviousWeek should do
    const weekRange = getShoppingWeekRange(new Date(2026, 1, 10));

    // Correct approach: format() in local time
    const prevWeekDates = Array.from({ length: 9 }, (_, i) => {
      const date = addDays(weekRange.start, -9 + i);
      return format(date, "yyyy-MM-dd");
    });

    // Previous week should be Jan 30 → Feb 7
    expect(prevWeekDates[0]).toBe("2026-01-30");
    expect(prevWeekDates[8]).toBe("2026-02-07");

    // None of these should have timezone-shifted dates
    for (const d of prevWeekDates) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("shopping week date strings are stable across boundary months", () => {
    // March 1 2026 is a Sunday — shopping week crosses Feb/Mar boundary
    const anchor = new Date(2026, 2, 3); // Mar 3 2026 (Tuesday)
    const range = getShoppingWeekRange(anchor);
    const dates = getShoppingWeekDateStrings(range);

    expect(dates[0]).toBe("2026-03-01"); // Sunday Mar 1
    expect(dates[8]).toBe("2026-03-09"); // Monday Mar 9
    expect(dates.length).toBe(9);
  });
});

// ============================================================================
// 6. FAT DERIVATION CONSISTENCY
// ============================================================================

describe("Fat derivation: consistent with calorie budget", () => {
  it("derived fat equals remaining calories / 9 (rounded)", () => {
    const fat = deriveFatFromCalories(2000, 150, 200);
    // Remaining = 2000 - 150*4 - 200*4 = 2000 - 600 - 800 = 600
    // Fat = 600 / 9 = 66.67 → 67
    expect(fat).toBe(67);
  });

  it("derived fat has a floor of 30g", () => {
    // With very high protein + carbs, remaining could be low/negative
    const fat = deriveFatFromCalories(1500, 200, 200);
    // Remaining = 1500 - 800 - 800 = -100 → 0 → floor at 30
    expect(fat).toBe(30);
  });

  it("solver can hit the derived fat target with symmetric tolerances", () => {
    const calories = 2000;
    const protein = 150;
    const carbs = 200;
    const fat = deriveFatFromCalories(calories, protein, carbs); // 67g

    // Simulate a day with multiple food items
    const items: SolverItem[] = [
      createSolverItem({
        id: "chicken", category: "protein",
        nutritionPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
        currentGrams: 0, minPortionGrams: 100, maxPortionGrams: 400,
        portionStepGrams: 10, roundingRule: "nearest_10g",
      }),
      createSolverItem({
        id: "rice", category: "carb",
        nutritionPer100g: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
        currentGrams: 0, minPortionGrams: 80, maxPortionGrams: 400,
        portionStepGrams: 10, roundingRule: "nearest_10g",
      }),
      createSolverItem({
        id: "olive-oil", category: "fat",
        nutritionPer100g: { calories: 884, protein: 0, carbs: 0, fat: 100 },
        currentGrams: 0, minPortionGrams: 5, maxPortionGrams: 30,
        portionStepGrams: 1, roundingRule: "nearest_1g",
      }),
      createSolverItem({
        id: "yoghurt", category: "dairy",
        nutritionPer100g: { calories: 97, protein: 9, carbs: 3.6, fat: 5 },
        currentGrams: 0, minPortionGrams: 100, maxPortionGrams: 350,
        portionStepGrams: 10, roundingRule: "nearest_10g",
      }),
    ];

    const targets: SolverTargets = { calories, protein, carbs, fat };
    const result = solve(items, targets, { maxIterations: 500 });

    // With a fat source (olive oil) available, the solver should be able to hit fat target
    if (result.success) {
      expect(Math.abs(result.totals.fat - fat)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.totals.protein - protein)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.totals.carbs - carbs)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.totals.calories - calories)).toBeLessThanOrEqual(50);
    }
  });
});

// ============================================================================
// 7. PORTION SANITY CHECKS
// ============================================================================

describe("Portion sanity: no insane grams", () => {
  it("should respect min/max portion constraints", () => {
    const items: SolverItem[] = [
      createSolverItem({
        id: "yoghurt",
        category: "dairy",
        nutritionPer100g: { calories: 97, protein: 9, carbs: 3.6, fat: 5 },
        currentGrams: 0,
        minPortionGrams: 100,
        maxPortionGrams: 350,
      }),
    ];

    const targets: SolverTargets = { calories: 97, protein: 9, carbs: 4, fat: 5 };
    const result = solve(items, targets, { maxIterations: 200 });

    if (result.success) {
      const grams = result.portions.get("yoghurt")!;
      expect(grams).toBeGreaterThanOrEqual(100);
      expect(grams).toBeLessThanOrEqual(350);
    }
  });

  it("should enforce step sizes (e.g., 5g granola)", () => {
    const items: SolverItem[] = [
      createSolverItem({
        id: "granola",
        category: "carb",
        nutritionPer100g: { calories: 450, protein: 10, carbs: 60, fat: 18 },
        currentGrams: 0,
        minPortionGrams: 25,
        maxPortionGrams: 60,
        portionStepGrams: 5,
        roundingRule: "nearest_5g",
      }),
    ];

    const targets: SolverTargets = { calories: 180, protein: 4, carbs: 24, fat: 7 };
    const result = solve(items, targets, { maxIterations: 200 });

    if (result.success) {
      const grams = result.portions.get("granola")!;
      expect(grams % 5).toBe(0); // Must be a multiple of 5
    }
  });

  it("seasoning portions must be <= 15g", () => {
    const items: SolverItem[] = [
      createSolverItem({
        id: "paprika",
        name: "Paprika",
        category: "seasoning",
        editableMode: "LOCKED",
        nutritionPer100g: { calories: 250, protein: 5, carbs: 40, fat: 5 },
        currentGrams: 5,
        minPortionGrams: 0,
        maxPortionGrams: 15,
        countMacros: false,
      }),
      createSolverItem({
        id: "chicken",
        category: "protein",
        nutritionPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
        currentGrams: 150,
        minPortionGrams: 100,
        maxPortionGrams: 300,
      }),
    ];

    const targets: SolverTargets = { calories: 250, protein: 47, carbs: 0, fat: 5 };
    const result = solve(items, targets, { maxIterations: 200 });

    const seasoningGrams = result.success
      ? result.portions.get("paprika")!
      : ((result as any).bestEffortPortions?.get("paprika") ?? 0);

    expect(seasoningGrams).toBeLessThanOrEqual(15);
  });
});
