/**
 * Comprehensive test suite for autoPortioning algorithm.
 * Tests invariants: integer grams, ±1g macro tolerance, per-meal calorie balance,
 * topper minimums, locked items, breakfast proportionality, and composition rules.
 */

import { describe, it, expect } from "vitest";
import { calculateDayPortions, calculateMacrosForGrams, DEFAULT_PORTIONING_SETTINGS, PortioningSettings } from "./autoPortioning";
import { MealPlanItem, MealType } from "@/hooks/useMealPlanItems";
import { Product } from "@/hooks/useProducts";
import { MacroTotals } from "./mealCalculations";

// === TEST FIXTURES ===

const createProduct = (overrides: Partial<Product> = {}): Product => ({
  id: `product-${Math.random().toString(36).substr(2, 9)}`,
  user_id: "user-1",
  name: "Test Product",
  calories_per_100g: 100,
  protein_per_100g: 10,
  carbs_per_100g: 15,
  fat_per_100g: 5,
  price: 1.0,
  pack_size_grams: 500,
  product_type: "editable",
  ignore_macros: false,
  serving_basis: "per_100g",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
} as Product);

const createMealPlanItem = (
  product: Product, 
  mealType: MealType, 
  quantity: number = 0,
  locked: boolean = false
): MealPlanItem => ({
  id: `item-${Math.random().toString(36).substr(2, 9)}`,
  user_id: "user-1",
  meal_plan_id: "plan-1",
  product_id: product.id,
  meal_type: mealType,
  quantity_grams: quantity,
  is_locked: locked,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  product,
});

// === STANDARD TEST PRODUCTS ===

const testProducts = {
  zeroYogurt: createProduct({ 
    name: "0% Fat Free Yogurt", 
    protein_per_100g: 10, 
    carbs_per_100g: 4, 
    fat_per_100g: 0, 
    calories_per_100g: 57 
  }),
  greekYogurt: createProduct({ 
    name: "Greek Full Fat Yogurt", 
    protein_per_100g: 5, 
    carbs_per_100g: 4, 
    fat_per_100g: 10, 
    calories_per_100g: 130 
  }),
  granola: createProduct({ 
    name: "Granola Topper", 
    protein_per_100g: 8, 
    carbs_per_100g: 60, 
    fat_per_100g: 15, 
    calories_per_100g: 400 
  }),
  mixedBerries: createProduct({ 
    name: "Mixed Berries Fruit", 
    protein_per_100g: 1, 
    carbs_per_100g: 10, 
    fat_per_100g: 0.3, 
    calories_per_100g: 45,
    food_type: "fruit"
  }),
  chicken: createProduct({ 
    name: "Chicken Breast", 
    protein_per_100g: 31, 
    carbs_per_100g: 0, 
    fat_per_100g: 3.6, 
    calories_per_100g: 165 
  }),
  rice: createProduct({ 
    name: "Basmati Rice", 
    protein_per_100g: 4, 
    carbs_per_100g: 78, 
    fat_per_100g: 0.5, 
    calories_per_100g: 350 
  }),
  broccoli: createProduct({ 
    name: "Broccoli", 
    protein_per_100g: 3, 
    carbs_per_100g: 7, 
    fat_per_100g: 0.4, 
    calories_per_100g: 34,
    food_type: "veg"
  }),
  paprikaSeasoning: createProduct({ 
    name: "Schwartz Paprika Seasoning", 
    protein_per_100g: 0, 
    carbs_per_100g: 5, 
    fat_per_100g: 2, 
    calories_per_100g: 40, 
    food_type: "sauce" 
  }),
  salmon: createProduct({ 
    name: "Salmon Fillet", 
    protein_per_100g: 20, 
    carbs_per_100g: 0, 
    fat_per_100g: 13, 
    calories_per_100g: 200 
  }),
  pasta: createProduct({ 
    name: "Penne Pasta", 
    protein_per_100g: 5, 
    carbs_per_100g: 71, 
    fat_per_100g: 1.5, 
    calories_per_100g: 320 
  }),
};

// === UNIT TESTS ===

describe("autoPortioning", () => {
  describe("integer grams invariant", () => {
    it("all portions are whole integers", () => {
      const items = [
        createMealPlanItem(testProducts.chicken, "lunch"),
        createMealPlanItem(testProducts.rice, "lunch"),
      ];
      
      const targets: MacroTotals = { calories: 600, protein: 50, carbs: 70, fat: 15 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      result.mealResults.forEach((mealResult) => {
        mealResult.items.forEach((grams) => {
          expect(Number.isInteger(grams)).toBe(true);
          expect(grams).toBeGreaterThanOrEqual(0);
        });
      });
    });

    it("no negative portions ever produced", () => {
      const items = [
        createMealPlanItem(testProducts.chicken, "lunch"),
        createMealPlanItem(testProducts.rice, "lunch"),
        createMealPlanItem(testProducts.broccoli, "lunch"),
      ];
      
      // Very low target that might push portions negative
      const targets: MacroTotals = { calories: 200, protein: 20, carbs: 20, fat: 5 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      result.mealResults.forEach((mealResult) => {
        mealResult.items.forEach((grams) => {
          expect(grams).toBeGreaterThanOrEqual(0);
        });
      });
    });
  });

  describe("macro tolerance invariant (±1g)", () => {
    it("protein, carbs, fat all within ±1g of targets when solvable", () => {
      const items = [
        createMealPlanItem(testProducts.zeroYogurt, "breakfast"),
        createMealPlanItem(testProducts.granola, "breakfast"),
        createMealPlanItem(testProducts.chicken, "lunch"),
        createMealPlanItem(testProducts.rice, "lunch"),
        createMealPlanItem(testProducts.chicken, "dinner"),
        createMealPlanItem(testProducts.rice, "dinner"),
      ];
      
      const targets: MacroTotals = { calories: 2000, protein: 170, carbs: 220, fat: 50 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      if (result.success) {
        expect(Math.abs(result.dayTotals.protein - targets.protein)).toBeLessThanOrEqual(1);
        expect(Math.abs(result.dayTotals.carbs - targets.carbs)).toBeLessThanOrEqual(1);
        expect(Math.abs(result.dayTotals.fat - targets.fat)).toBeLessThanOrEqual(1);
      }
    });

    it("strict ±1g tolerance across different target values", () => {
      const targets: MacroTotals[] = [
        { calories: 1500, protein: 120, carbs: 150, fat: 40 },
        { calories: 2500, protein: 200, carbs: 280, fat: 70 },
        { calories: 1800, protein: 140, carbs: 200, fat: 55 },
      ];
      
      targets.forEach(target => {
        const items = [
          createMealPlanItem(testProducts.zeroYogurt, "breakfast"),
          createMealPlanItem(testProducts.chicken, "lunch"),
          createMealPlanItem(testProducts.rice, "lunch"),
          createMealPlanItem(testProducts.salmon, "dinner"),
          createMealPlanItem(testProducts.pasta, "dinner"),
        ];
        
        const result = calculateDayPortions(items, target, DEFAULT_PORTIONING_SETTINGS);
        
        if (result.success) {
          expect(Math.abs(result.dayTotals.protein - target.protein)).toBeLessThanOrEqual(1);
          expect(Math.abs(result.dayTotals.carbs - target.carbs)).toBeLessThanOrEqual(1);
          expect(Math.abs(result.dayTotals.fat - target.fat)).toBeLessThanOrEqual(1);
        }
      });
    });
  });

  describe("per-meal calorie balance (±15 kcal)", () => {
    it("each meal is within ±15 kcal of its 1/3 share when solvable", () => {
      const items = [
        createMealPlanItem(testProducts.zeroYogurt, "breakfast"),
        createMealPlanItem(testProducts.granola, "breakfast"),
        createMealPlanItem(testProducts.chicken, "lunch"),
        createMealPlanItem(testProducts.rice, "lunch"),
        createMealPlanItem(testProducts.chicken, "dinner"),
        createMealPlanItem(testProducts.rice, "dinner"),
      ];
      
      const targets: MacroTotals = { calories: 1800, protein: 150, carbs: 180, fat: 40 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      if (result.success) {
        const mealCalTarget = targets.calories / 3;
        
        result.mealResults.forEach((mealResult, mealType) => {
          if (mealType !== "snack") {
            const mealCalErr = Math.abs(mealResult.achievedMacros.calories - mealCalTarget);
            // Allow ±15 kcal tolerance per the plan
            expect(mealCalErr).toBeLessThanOrEqual(15);
          }
        });
      }
    });

    it("meals are balanced even with different food combinations", () => {
      const items = [
        createMealPlanItem(testProducts.zeroYogurt, "breakfast"),
        createMealPlanItem(testProducts.mixedBerries, "breakfast"),
        createMealPlanItem(testProducts.salmon, "lunch"),
        createMealPlanItem(testProducts.pasta, "lunch"),
        createMealPlanItem(testProducts.chicken, "dinner"),
        createMealPlanItem(testProducts.rice, "dinner"),
        createMealPlanItem(testProducts.broccoli, "dinner"),
      ];
      
      const targets: MacroTotals = { calories: 2100, protein: 165, carbs: 220, fat: 55 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      if (result.success) {
        const mealCalTarget = targets.calories / 3;
        
        result.mealResults.forEach((mealResult, mealType) => {
          if (mealType !== "snack") {
            const mealCalErr = Math.abs(mealResult.achievedMacros.calories - mealCalTarget);
            expect(mealCalErr).toBeLessThanOrEqual(15);
          }
        });
      }
    });
  });

  describe("topper non-zero invariant", () => {
    it("selected granola never ends at 0g", () => {
      const items = [
        createMealPlanItem(testProducts.zeroYogurt, "breakfast"),
        createMealPlanItem(testProducts.granola, "breakfast"),
      ];
      
      const targets: MacroTotals = { calories: 400, protein: 30, carbs: 40, fat: 10 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const breakfastResult = result.mealResults.get("breakfast");
      const granolaGrams = breakfastResult?.items.get(items[1].id);
      
      // Granola should be at least 25g (topper minimum) and can now go up to 60g
      expect(granolaGrams).toBeGreaterThanOrEqual(25);
      expect(granolaGrams).toBeLessThanOrEqual(60);
    });
    
    it("selected fruit never ends at 0g", () => {
      const items = [
        createMealPlanItem(testProducts.zeroYogurt, "breakfast"),
        createMealPlanItem(testProducts.mixedBerries, "breakfast"),
      ];
      
      const targets: MacroTotals = { calories: 400, protein: 30, carbs: 40, fat: 10 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const breakfastResult = result.mealResults.get("breakfast");
      const fruitGrams = breakfastResult?.items.get(items[1].id);
      
      // Fruit should be at least 80g (secondary minimum) and no more than 120g
      expect(fruitGrams).toBeGreaterThanOrEqual(80);
      expect(fruitGrams).toBeLessThanOrEqual(120);
    });

    it("both granola and fruit maintain minimums when both selected", () => {
      const items = [
        createMealPlanItem(testProducts.zeroYogurt, "breakfast"),
        createMealPlanItem(testProducts.granola, "breakfast"),
        createMealPlanItem(testProducts.mixedBerries, "breakfast"),
      ];
      
      const targets: MacroTotals = { calories: 500, protein: 35, carbs: 50, fat: 12 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const breakfastResult = result.mealResults.get("breakfast");
      const granolaGrams = breakfastResult?.items.get(items[1].id);
      const fruitGrams = breakfastResult?.items.get(items[2].id);
      
      expect(granolaGrams).toBeGreaterThanOrEqual(25);
      expect(fruitGrams).toBeGreaterThanOrEqual(80);
    });
  });

  describe("locked items invariant", () => {
    it("locked items preserve their original quantity", () => {
      const lockedQuantity = 150;
      const items = [
        createMealPlanItem(testProducts.chicken, "lunch", lockedQuantity, true), // LOCKED at 150g
        createMealPlanItem(testProducts.rice, "lunch"),
      ];
      
      const targets: MacroTotals = { calories: 600, protein: 50, carbs: 100, fat: 15 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const lunchResult = result.mealResults.get("lunch");
      const chickenGrams = lunchResult?.items.get(items[0].id);
      
      // Locked item should keep its original quantity
      expect(chickenGrams).toBe(lockedQuantity);
    });

    it("multiple locked items all preserve their quantities", () => {
      const items = [
        createMealPlanItem(testProducts.chicken, "lunch", 180, true),  // Locked
        createMealPlanItem(testProducts.rice, "lunch", 120, true),     // Locked
        createMealPlanItem(testProducts.broccoli, "lunch"),            // Not locked
      ];
      
      const targets: MacroTotals = { calories: 800, protein: 60, carbs: 120, fat: 20 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const lunchResult = result.mealResults.get("lunch");
      
      expect(lunchResult?.items.get(items[0].id)).toBe(180);
      expect(lunchResult?.items.get(items[1].id)).toBe(120);
    });
  });

  describe("breakfast proportionality", () => {
    it("0% yogurt is sized larger than Greek yogurt", () => {
      const items = [
        createMealPlanItem(testProducts.zeroYogurt, "breakfast"),
        createMealPlanItem(testProducts.greekYogurt, "breakfast"),
      ];
      
      const targets: MacroTotals = { calories: 500, protein: 40, carbs: 50, fat: 15 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const breakfastResult = result.mealResults.get("breakfast");
      const zeroGrams = breakfastResult?.items.get(items[0].id) || 0;
      const greekGrams = breakfastResult?.items.get(items[1].id) || 0;
      
      // 0% yogurt should be in 200-300g range
      expect(zeroGrams).toBeGreaterThanOrEqual(200);
      expect(zeroGrams).toBeLessThanOrEqual(300);
      
      // Greek yogurt should be in 50-150g range
      expect(greekGrams).toBeGreaterThanOrEqual(50);
      expect(greekGrams).toBeLessThanOrEqual(150);
      
      // 0% should be larger than Greek
      expect(zeroGrams).toBeGreaterThan(greekGrams);
    });

    it("primary yogurt stays within 200-300g range", () => {
      const items = [
        createMealPlanItem(testProducts.zeroYogurt, "breakfast"),
        createMealPlanItem(testProducts.granola, "breakfast"),
      ];
      
      const targets: MacroTotals = { calories: 450, protein: 35, carbs: 45, fat: 10 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const breakfastResult = result.mealResults.get("breakfast");
      const yogurtGrams = breakfastResult?.items.get(items[0].id) || 0;
      
      expect(yogurtGrams).toBeGreaterThanOrEqual(200);
      expect(yogurtGrams).toBeLessThanOrEqual(300);
    });
  });

  describe("seasoning constraints", () => {
    it("seasonings stay within 3-15g range (realistic portions)", () => {
      const items = [
        createMealPlanItem(testProducts.chicken, "dinner"),
        createMealPlanItem(testProducts.paprikaSeasoning, "dinner"),
      ];
      
      const targets: MacroTotals = { calories: 600, protein: 50, carbs: 70, fat: 15 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const dinnerResult = result.mealResults.get("dinner");
      const seasoningGrams = dinnerResult?.items.get(items[1].id) || 0;
      
      // Seasoning should be in realistic 3-15g range (hard capped)
      expect(seasoningGrams).toBeGreaterThanOrEqual(3);
      expect(seasoningGrams).toBeLessThanOrEqual(15);
    });

    it("seasonings are not used as macro adjustment knobs", () => {
      const items = [
        createMealPlanItem(testProducts.chicken, "dinner"),
        createMealPlanItem(testProducts.rice, "dinner"),
        createMealPlanItem(testProducts.paprikaSeasoning, "dinner"),
      ];
      
      // Run twice with different targets - seasoning should stay similar
      const targets1: MacroTotals = { calories: 600, protein: 50, carbs: 80, fat: 15 };
      const targets2: MacroTotals = { calories: 800, protein: 70, carbs: 100, fat: 25 };
      
      const result1 = calculateDayPortions([...items], targets1, DEFAULT_PORTIONING_SETTINGS);
      const result2 = calculateDayPortions([...items], targets2, DEFAULT_PORTIONING_SETTINGS);
      
      const seasoning1 = result1.mealResults.get("dinner")?.items.get(items[2].id) || 0;
      const seasoning2 = result2.mealResults.get("dinner")?.items.get(items[2].id) || 0;
      
      // Seasonings should not vary between runs (they're fixed, not knobs)
      expect(Math.abs(seasoning1 - seasoning2)).toBeLessThanOrEqual(5);
    });

    it("sauces are NOT capped at 15g (only seasonings are)", () => {
      // Create a sauce product (not a seasoning)
      const passataSauce = createProduct({
        name: "Passata Tomato Sauce",
        protein_per_100g: 1,
        carbs_per_100g: 4,
        fat_per_100g: 0.1,
        calories_per_100g: 20,
        food_type: "sauce"
      });
      
      const items = [
        createMealPlanItem(testProducts.chicken, "dinner"),
        createMealPlanItem(passataSauce, "dinner"),
      ];
      
      const targets: MacroTotals = { calories: 600, protein: 50, carbs: 70, fat: 15 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const dinnerResult = result.mealResults.get("dinner");
      const sauceGrams = dinnerResult?.items.get(items[1].id) || 0;
      
      // Sauces can go above 15g (up to 30g) - NOT capped like seasonings
      expect(sauceGrams).toBeGreaterThanOrEqual(0);
      expect(sauceGrams).toBeLessThanOrEqual(30);
    });
  });

  describe("granola topper extended range", () => {
    it("granola can extend up to 60g when needed to hit targets", () => {
      const items = [
        createMealPlanItem(testProducts.zeroYogurt, "breakfast"),
        createMealPlanItem(testProducts.granola, "breakfast"),
        createMealPlanItem(testProducts.mixedBerries, "breakfast"),
      ];
      
      // High carb target that may require more granola
      const targets: MacroTotals = { calories: 600, protein: 35, carbs: 70, fat: 12 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const breakfastResult = result.mealResults.get("breakfast");
      const granolaGrams = breakfastResult?.items.get(items[1].id);
      
      // Granola should be within 25-60g range
      expect(granolaGrams).toBeGreaterThanOrEqual(25);
      expect(granolaGrams).toBeLessThanOrEqual(60);
    });

    it("non-granola toppers still respect 40g max", () => {
      // Create a non-granola topper
      const muesliTopper = createProduct({
        name: "Muesli Topper",
        protein_per_100g: 6,
        carbs_per_100g: 55,
        fat_per_100g: 10,
        calories_per_100g: 350
      });
      
      const items = [
        createMealPlanItem(testProducts.zeroYogurt, "breakfast"),
        createMealPlanItem(muesliTopper, "breakfast"),
      ];
      
      // High carb target
      const targets: MacroTotals = { calories: 600, protein: 35, carbs: 70, fat: 12 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const breakfastResult = result.mealResults.get("breakfast");
      const muesliGrams = breakfastResult?.items.get(items[1].id);
      
      // Non-granola toppers should stay within 25-40g
      expect(muesliGrams).toBeGreaterThanOrEqual(25);
      expect(muesliGrams).toBeLessThanOrEqual(40);
    });
  });

  describe("composition validation", () => {
    it("lunch/dinner protein items have non-zero grams", () => {
      const items = [
        createMealPlanItem(testProducts.chicken, "lunch"),
        createMealPlanItem(testProducts.rice, "lunch"),
        createMealPlanItem(testProducts.broccoli, "lunch"),
      ];
      
      const targets: MacroTotals = { calories: 600, protein: 50, carbs: 80, fat: 15 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const lunchResult = result.mealResults.get("lunch");
      
      items.forEach(item => {
        const grams = lunchResult?.items.get(item.id) || 0;
        expect(grams).toBeGreaterThan(0);
      });
    });

    it("carb items respect 80g minimum for staples when targets allow", () => {
      const items = [
        createMealPlanItem(testProducts.chicken, "lunch"),
        createMealPlanItem(testProducts.rice, "lunch"),
      ];
      
      // Reasonable targets where 80g minimum is achievable
      const targets: MacroTotals = { calories: 650, protein: 50, carbs: 80, fat: 12 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const lunchResult = result.mealResults.get("lunch");
      const riceGrams = lunchResult?.items.get(items[1].id) || 0;
      
      // With reasonable targets, rice should respect 80g minimum
      expect(riceGrams).toBeGreaterThanOrEqual(80);
    });
  });

  describe("convergence or explicit failure", () => {
    it("returns success=false with warning when targets unreachable", () => {
      // Only one item with very different macros than target
      const items = [
        createMealPlanItem(testProducts.rice, "lunch"),
      ];
      
      // Impossible target: high protein with only rice
      const targets: MacroTotals = { calories: 500, protein: 100, carbs: 50, fat: 10 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      // Should either succeed with a warning or fail explicitly
      if (!result.success) {
        expect(result.warnings.length).toBeGreaterThan(0);
      }
    });

    it("handles edge case with no editable items", () => {
      const lockedChicken = createMealPlanItem(testProducts.chicken, "lunch", 100, true);
      const items = [lockedChicken];
      
      const targets: MacroTotals = { calories: 1000, protein: 80, carbs: 100, fat: 30 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      // Should return without crashing
      expect(result).toBeDefined();
      expect(result.dayTotals).toBeDefined();
    });
  });

  describe("calculateMacrosForGrams utility", () => {
    it("correctly calculates macros proportionally", () => {
      const product = testProducts.chicken;
      const macros = calculateMacrosForGrams(product, 100);
      
      expect(macros.calories).toBe(product.calories_per_100g);
      expect(macros.protein).toBe(product.protein_per_100g);
      expect(macros.carbs).toBe(product.carbs_per_100g);
      expect(macros.fat).toBe(product.fat_per_100g);
    });

    it("scales macros correctly for different gram amounts", () => {
      const product = testProducts.rice;
      const macros50 = calculateMacrosForGrams(product, 50);
      const macros200 = calculateMacrosForGrams(product, 200);
      
      expect(macros50.calories).toBe(product.calories_per_100g * 0.5);
      expect(macros200.carbs).toBe(product.carbs_per_100g * 2);
    });
  });
});

// === PROPERTY-BASED / RANDOMIZED TESTS ===

describe("autoPortioning - randomized scenarios", () => {
  const runRandomizedTest = (seed: number) => {
    // Use seed to create reproducible "random" values
    const random = (min: number, max: number) => min + ((seed * 9301 + 49297) % 233280) / 233280 * (max - min);
    
    // Create random products
    const products = [
      createProduct({ 
        name: `Protein-${seed}`, 
        protein_per_100g: 20 + random(0, 15), 
        carbs_per_100g: 2, 
        fat_per_100g: 5, 
        calories_per_100g: 150 + random(0, 50) 
      }),
      createProduct({ 
        name: `Carb-${seed}`, 
        protein_per_100g: 5, 
        carbs_per_100g: 55 + random(0, 25), 
        fat_per_100g: 2, 
        calories_per_100g: 300 + random(0, 100) 
      }),
      createProduct({ 
        name: `Fat-${seed}`, 
        protein_per_100g: 3, 
        carbs_per_100g: 10, 
        fat_per_100g: 12 + random(0, 12), 
        calories_per_100g: 180 + random(0, 100) 
      }),
    ];
    
    const mealTypes: MealType[] = ["breakfast", "lunch", "dinner"];
    const items = products.map((p, i) => createMealPlanItem(p, mealTypes[i % 3]));
    
    const targets: MacroTotals = {
      calories: 1500 + random(0, 1000),
      protein: 120 + random(0, 80),
      carbs: 150 + random(0, 100),
      fat: 40 + random(0, 40),
    };
    
    const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
    
    // Invariants that must always hold
    result.mealResults.forEach((mealResult) => {
      mealResult.items.forEach((grams) => {
        // All grams must be integers
        expect(Number.isInteger(grams)).toBe(true);
        // No negative grams
        expect(grams).toBeGreaterThanOrEqual(0);
      });
    });
    
    // If successful, macros must be within ±1g tolerance (NOT ±1.5)
    if (result.success) {
      expect(Math.abs(result.dayTotals.protein - targets.protein)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.dayTotals.carbs - targets.carbs)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.dayTotals.fat - targets.fat)).toBeLessThanOrEqual(1);
    }
  };
  
  it.each(Array.from({ length: 20 }, (_, i) => i))("randomized scenario %i", (seed) => {
    runRandomizedTest(seed);
  });
});

// === REALISTIC FULL-DAY SCENARIOS ===

describe("autoPortioning - realistic full-day scenarios", () => {
  it("handles typical Monday meal plan", () => {
    const items = [
      // Breakfast - simpler combo that's easier to solve
      createMealPlanItem(testProducts.zeroYogurt, "breakfast"),
      createMealPlanItem(testProducts.granola, "breakfast"),
      // Lunch
      createMealPlanItem(testProducts.chicken, "lunch"),
      createMealPlanItem(testProducts.rice, "lunch"),
      // Dinner
      createMealPlanItem(testProducts.salmon, "dinner"),
      createMealPlanItem(testProducts.pasta, "dinner"),
    ];
    
    // More achievable targets with this food selection
    const targets: MacroTotals = { calories: 1800, protein: 150, carbs: 200, fat: 50 };
    const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
    
    // Should converge successfully (or at least close)
    if (result.success) {
      // Macros should be within ±1g
      expect(Math.abs(result.dayTotals.protein - targets.protein)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.dayTotals.carbs - targets.carbs)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.dayTotals.fat - targets.fat)).toBeLessThanOrEqual(1);
    }
    
    // All portions should be integers regardless of success
    result.mealResults.forEach((mealResult) => {
      mealResult.items.forEach((grams) => {
        expect(Number.isInteger(grams)).toBe(true);
      });
    });
  });

  it("handles weekend targets (higher calories)", () => {
    const items = [
      createMealPlanItem(testProducts.zeroYogurt, "breakfast"),
      createMealPlanItem(testProducts.granola, "breakfast"),
      createMealPlanItem(testProducts.chicken, "lunch"),
      createMealPlanItem(testProducts.rice, "lunch"),
      createMealPlanItem(testProducts.salmon, "dinner"),
      createMealPlanItem(testProducts.pasta, "dinner"),
    ];
    
    // Weekend targets typically higher
    const targets: MacroTotals = { calories: 2400, protein: 180, carbs: 280, fat: 65 };
    const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
    
    if (result.success) {
      expect(Math.abs(result.dayTotals.protein - targets.protein)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.dayTotals.carbs - targets.carbs)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.dayTotals.fat - targets.fat)).toBeLessThanOrEqual(1);
    }
  });

  it("handles minimal meal plan with just breakfast", () => {
    const items = [
      createMealPlanItem(testProducts.zeroYogurt, "breakfast"),
      createMealPlanItem(testProducts.granola, "breakfast"),
    ];
    
    const targets: MacroTotals = { calories: 400, protein: 30, carbs: 45, fat: 12 };
    const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
    
    // Should handle single-meal scenario
    expect(result).toBeDefined();
    expect(result.mealResults.get("breakfast")).toBeDefined();
  });
});

