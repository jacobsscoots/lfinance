import { describe, it, expect } from "vitest";
import {
  getDailyTargets,
  getDailyTargetsFromDateString,
  deriveFatFromCalories,
  computeTotals,
  isWithinTolerance,
  getMacroDifferences,
  MacroTotals,
  WeeklyTargetsOverride,
} from "./dailyTargets";
import { NutritionSettings } from "@/hooks/useNutritionSettings";
import { MealPlanItem } from "@/hooks/useMealPlanItems";
import { Product } from "@/hooks/useProducts";

// Helper to create mock nutrition settings
function createSettings(overrides: Partial<NutritionSettings> = {}): NutritionSettings {
  return {
    id: "test-id",
    user_id: "user-1",
    mode: "target_based",
    daily_calorie_target: 2000,
    protein_target_grams: 150,
    carbs_target_grams: 200,
    fat_target_grams: null, // Fat should be derived
    weekend_targets_enabled: false,
    weekend_calorie_target: null,
    weekend_protein_target_grams: null,
    weekend_carbs_target_grams: null,
    weekend_fat_target_grams: null,
    protein_per_kg: null,
    fat_per_kg: null,
    min_grams_per_item: null,
    max_grams_per_item: null,
    portion_rounding: null,
    target_tolerance_percent: null,
    formula: null,
    goal_type: null,
    activity_level: null,
    weight_kg: null,
    height_cm: null,
    age: null,
    sex: null,
    body_fat_percent: null,
    last_calculated_at: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

// Helper to create mock meal plan item
function createItem(
  id: string,
  grams: number,
  macrosPer100g: { cal: number; pro: number; carb: number; fat: number },
  options: { ignoreMacros?: boolean } = {}
): MealPlanItem {
  return {
    id,
    user_id: "user-1",
    meal_plan_id: "plan-1",
    product_id: `product-${id}`,
    meal_type: "lunch",
    quantity_grams: grams,
    is_locked: false,
    created_at: "",
    updated_at: "",
    product: {
      id: `product-${id}`,
      user_id: "user-1",
      name: `Product ${id}`,
      price: 1,
      product_type: "editable",
      serving_basis: "per_100g",
      calories_per_100g: macrosPer100g.cal,
      protein_per_100g: macrosPer100g.pro,
      carbs_per_100g: macrosPer100g.carb,
      fat_per_100g: macrosPer100g.fat,
      ignore_macros: options.ignoreMacros ?? false,
      created_at: "",
      updated_at: "",
    } as Product,
  };
}

describe("deriveFatFromCalories", () => {
  it("derives fat from remaining calories correctly", () => {
    // 2000 cal, 150g protein (600 cal), 200g carbs (800 cal)
    // Remaining = 2000 - 600 - 800 = 600 cal
    // Fat = 600 / 9 = 66.67 → 67g
    const fat = deriveFatFromCalories(2000, 150, 200);
    expect(fat).toBe(67);
  });

  it("handles zigzag lower calories", () => {
    // 1800 cal, 150g protein (600 cal), 200g carbs (800 cal)
    // Remaining = 1800 - 600 - 800 = 400 cal
    // Fat = 400 / 9 = 44.44 → 44g
    const fat = deriveFatFromCalories(1800, 150, 200);
    expect(fat).toBe(44);
  });

  it("enforces minimum 30g fat floor when calculated fat would be too low", () => {
    // 1000 cal, 150g protein (600 cal), 200g carbs (800 cal)
    // Remaining = 1000 - 600 - 800 = -400 cal → calculated fat = 0
    // But minimum 30g floor enforced for feasibility
    const fat = deriveFatFromCalories(1000, 150, 200);
    expect(fat).toBe(30); // Minimum floor
  });

  it("enforces minimum 30g fat floor when exactly zero remaining", () => {
    // 1400 cal, 150g protein (600 cal), 200g carbs (800 cal)
    // Remaining = 1400 - 600 - 800 = 0 cal → calculated fat = 0
    // But minimum 30g floor enforced for feasibility
    const fat = deriveFatFromCalories(1400, 150, 200);
    expect(fat).toBe(30); // Minimum floor
  });
});

describe("getDailyTargets", () => {
  it("returns defaults when no settings", () => {
    const date = new Date("2026-02-10"); // Tuesday
    const targets = getDailyTargets(date, null);
    
    expect(targets).toEqual({
      calories: 2000,
      protein: 150,
      carbs: 200,
      fat: 65, // default fat
    });
  });

  it("derives fat from remaining calories (not stored value)", () => {
    const date = new Date("2026-02-10"); // Tuesday
    const settings = createSettings({
      daily_calorie_target: 2000,
      protein_target_grams: 150,
      carbs_target_grams: 200,
      fat_target_grams: 999, // This should be IGNORED
    });
    
    const targets = getDailyTargets(date, settings);
    
    // Fat should be derived: (2000 - 600 - 800) / 9 = 67
    expect(targets.fat).toBe(67);
    expect(targets.fat).not.toBe(999);
  });

  it("handles weekend targets when enabled", () => {
    const saturday = new Date("2026-02-14"); // Saturday
    const settings = createSettings({
      daily_calorie_target: 2000,
      protein_target_grams: 150,
      carbs_target_grams: 200,
      weekend_targets_enabled: true,
      weekend_calorie_target: 2200,
      weekend_protein_target_grams: 160,
      weekend_carbs_target_grams: 220,
    });
    
    const targets = getDailyTargets(saturday, settings);
    
    expect(targets.calories).toBe(2200);
    expect(targets.protein).toBe(160);
    expect(targets.carbs).toBe(220);
    // Fat derived: (2200 - 640 - 880) / 9 = 75.5 → 76
    expect(targets.fat).toBe(76);
  });

  it("uses weekday targets on weekdays even when weekend enabled", () => {
    const wednesday = new Date("2026-02-11"); // Wednesday
    const settings = createSettings({
      daily_calorie_target: 2000,
      protein_target_grams: 150,
      carbs_target_grams: 200,
      weekend_targets_enabled: true,
      weekend_calorie_target: 2200,
    });
    
    const targets = getDailyTargets(wednesday, settings);
    
    expect(targets.calories).toBe(2000);
  });

  it("applies weekly override when week matches", () => {
    // Feb 9, 2026 is a Monday (week start)
    const date = new Date("2026-02-09");
    const settings = createSettings({
      daily_calorie_target: 2000,
      protein_target_grams: 150,
      carbs_target_grams: 200,
    });
    
    const weeklyOverride: WeeklyTargetsOverride = {
      weekStartDate: "2026-02-09", // Monday
      schedule: {
        monday: 1800,
        tuesday: 1900,
        wednesday: 1850,
        thursday: 1900,
        friday: 2000,
        saturday: 2200,
        sunday: 2100,
      },
      protein: 145,
      carbs: 190,
      fat: 999, // Should be ignored
    };
    
    const targets = getDailyTargets(date, settings, weeklyOverride);
    
    expect(targets.calories).toBe(1800); // Monday from schedule
    expect(targets.protein).toBe(145);
    expect(targets.carbs).toBe(190);
    // Fat derived: (1800 - 580 - 760) / 9 = 51.1 → 51
    expect(targets.fat).toBe(51);
  });

  it("ignores weekly override when week does not match", () => {
    // Monday Feb 16, 2026 (different week)
    const date = new Date("2026-02-16");
    const settings = createSettings({
      daily_calorie_target: 2000,
      protein_target_grams: 150,
      carbs_target_grams: 200,
    });
    
    const weeklyOverride: WeeklyTargetsOverride = {
      weekStartDate: "2026-02-09", // Previous Monday
      schedule: {
        monday: 1800,
        tuesday: 1900,
        wednesday: 1850,
        thursday: 1900,
        friday: 2000,
        saturday: 2200,
        sunday: 2100,
      },
      protein: 145,
      carbs: 190,
    };
    
    const targets = getDailyTargets(date, settings, weeklyOverride);
    
    // Should use global settings, not override
    expect(targets.calories).toBe(2000);
    expect(targets.protein).toBe(150);
    expect(targets.carbs).toBe(200);
  });
});

describe("getDailyTargetsFromDateString", () => {
  it("parses date string correctly", () => {
    const settings = createSettings({
      daily_calorie_target: 2100,
      protein_target_grams: 160,
      carbs_target_grams: 210,
    });
    
    const targets = getDailyTargetsFromDateString("2026-02-10", settings);
    
    expect(targets.calories).toBe(2100);
    expect(targets.protein).toBe(160);
    expect(targets.carbs).toBe(210);
  });
});

describe("computeTotals", () => {
  it("sums macros correctly from items", () => {
    const items = [
      createItem("1", 100, { cal: 150, pro: 25, carb: 5, fat: 5 }),
      createItem("2", 200, { cal: 100, pro: 2, carb: 20, fat: 1 }),
    ];
    
    const totals = computeTotals(items);
    
    // Item 1: 100g → 150 cal, 25g pro, 5g carb, 5g fat
    // Item 2: 200g → 200 cal, 4g pro, 40g carb, 2g fat
    // Total: 350 cal, 29g pro, 45g carb, 7g fat
    expect(totals.calories).toBeCloseTo(350, 1);
    expect(totals.protein).toBeCloseTo(29, 1);
    expect(totals.carbs).toBeCloseTo(45, 1);
    expect(totals.fat).toBeCloseTo(7, 1);
  });

  it("uses gramsOverride when provided", () => {
    const items = [
      createItem("1", 100, { cal: 100, pro: 20, carb: 0, fat: 2 }),
    ];
    
    const override = new Map([["1", 200]]);
    const totals = computeTotals(items, override);
    
    // Should use 200g from override, not 100g from item
    expect(totals.calories).toBeCloseTo(200, 1);
    expect(totals.protein).toBeCloseTo(40, 1);
  });

  it("skips items with ignore_macros", () => {
    const items = [
      createItem("1", 100, { cal: 100, pro: 20, carb: 0, fat: 2 }),
      createItem("2", 50, { cal: 50, pro: 0, carb: 10, fat: 1 }, { ignoreMacros: true }),
    ];
    
    const totals = computeTotals(items);
    
    // Item 2 should be ignored
    expect(totals.calories).toBeCloseTo(100, 1);
    expect(totals.protein).toBeCloseTo(20, 1);
  });

  it("skips items with zero grams", () => {
    const items = [
      createItem("1", 100, { cal: 100, pro: 20, carb: 0, fat: 2 }),
      createItem("2", 0, { cal: 200, pro: 30, carb: 10, fat: 5 }),
    ];
    
    const totals = computeTotals(items);
    
    expect(totals.calories).toBeCloseTo(100, 1);
    expect(totals.protein).toBeCloseTo(20, 1);
  });

  it("handles empty items array", () => {
    const totals = computeTotals([]);
    
    expect(totals).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe("isWithinTolerance", () => {
  it("returns true when all macros within tolerance", () => {
    const achieved: MacroTotals = { calories: 2002, protein: 150.5, carbs: 199, fat: 66 };
    const targets: MacroTotals = { calories: 2000, protein: 150, carbs: 200, fat: 67 };
    
    expect(isWithinTolerance(achieved, targets)).toBe(true);
  });

  it("returns false when calories exceed tolerance", () => {
    const achieved: MacroTotals = { calories: 2010, protein: 150, carbs: 200, fat: 67 };
    const targets: MacroTotals = { calories: 2000, protein: 150, carbs: 200, fat: 67 };
    
    expect(isWithinTolerance(achieved, targets)).toBe(false);
  });

  it("returns false when fat exceeds tolerance", () => {
    const achieved: MacroTotals = { calories: 2000, protein: 150, carbs: 200, fat: 45 };
    const targets: MacroTotals = { calories: 2000, protein: 150, carbs: 200, fat: 67 };
    
    expect(isWithinTolerance(achieved, targets)).toBe(false);
  });
});

describe("getMacroDifferences", () => {
  it("returns empty array when all within tolerance", () => {
    const achieved: MacroTotals = { calories: 2002, protein: 150, carbs: 200, fat: 67 };
    const targets: MacroTotals = { calories: 2000, protein: 150, carbs: 200, fat: 67 };
    
    const diffs = getMacroDifferences(achieved, targets);
    
    expect(diffs.length).toBe(0);
  });

  it("returns differences for out-of-tolerance macros", () => {
    const achieved: MacroTotals = { calories: 2234, protein: 150, carbs: 200, fat: 46 };
    const targets: MacroTotals = { calories: 2000, protein: 150, carbs: 200, fat: 67 };
    
    const diffs = getMacroDifferences(achieved, targets);
    
    expect(diffs).toContainEqual({ macro: "Calories", diff: 234, unit: "" });
    expect(diffs).toContainEqual({ macro: "Fat", diff: -21, unit: "g" });
  });
});

describe("regression: +200cal/-20g fat scenario cannot happen", () => {
  it("targets are always calorie-consistent when fat is derived", () => {
    const settings = createSettings({
      daily_calorie_target: 2000,
      protein_target_grams: 150,
      carbs_target_grams: 200,
    });
    
    const targets = getDailyTargets(new Date("2026-02-10"), settings);
    
    // Verify internal consistency:
    // calories = protein×4 + carbs×4 + fat×9
    const calculatedCalories = 
      targets.protein * 4 + 
      targets.carbs * 4 + 
      targets.fat * 9;
    
    // Should match within rounding error (max 8 kcal due to fat rounding)
    expect(Math.abs(targets.calories - calculatedCalories)).toBeLessThanOrEqual(8);
  });

  it("weekly override calories are consistent with derived macros", () => {
    const settings = createSettings({
      daily_calorie_target: 2000,
      protein_target_grams: 150,
      carbs_target_grams: 200,
    });
    
    const weeklyOverride: WeeklyTargetsOverride = {
      weekStartDate: "2026-02-09", // Monday
      schedule: {
        monday: 1800, // Lower than base
        tuesday: 1900,
        wednesday: 1850,
        thursday: 1900,
        friday: 2000,
        saturday: 2200, // Higher than base
        sunday: 2100,
      },
      protein: 150,
      carbs: 200,
    };
    
    // Check Monday (lower calories) - Feb 9, 2026 is Monday
    const mondayTargets = getDailyTargets(
      new Date("2026-02-09"), 
      settings, 
      weeklyOverride
    );
    
    const mondayCalc = 
      mondayTargets.protein * 4 + 
      mondayTargets.carbs * 4 + 
      mondayTargets.fat * 9;
    
    expect(Math.abs(mondayTargets.calories - mondayCalc)).toBeLessThanOrEqual(8);
    
    // Check Saturday (higher calories) - Feb 14, 2026 is Saturday
    const saturdayTargets = getDailyTargets(
      new Date("2026-02-14"),
      settings,
      weeklyOverride
    );
    
    const saturdayCalc = 
      saturdayTargets.protein * 4 + 
      saturdayTargets.carbs * 4 + 
      saturdayTargets.fat * 9;
    
    expect(Math.abs(saturdayTargets.calories - saturdayCalc)).toBeLessThanOrEqual(8);
  });
});
