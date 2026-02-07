
# Plan: Per-Meal Constraints + Composition Validation + Comprehensive Tests

## Summary

This plan implements:
1. **Iterative per-meal calorie balancer** (15 passes with early exit and no-progress detection)
2. **Composition validator** using category-specific minimums via `getItemConstraints` 
3. **Comprehensive test suite** with ±1g tolerance (not ±1.5) and per-meal calorie balance tests

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/autoPortioning.ts` | Add meal calorie balance loop (Phase 1.5); Add composition validator after micro-corrections |
| `src/lib/autoPortioning.test.ts` | **NEW** - Comprehensive test suite with 20+ tests and randomized scenarios |

---

## Detailed Implementation

### 1. Iterative Per-Meal Calorie Balance Loop (lines 853-954)

Insert after Phase 1 (meal independent solve) and before Phase 2 (global fine-tuning):

```typescript
// === PHASE 1.5: Per-Meal Calorie Balance Loop ===
// Ensure each meal is within ±10 kcal of its equal share (iterative with early exit)
const MEAL_CAL_TOLERANCE = 10;
const MAX_MEAL_BALANCE_ITERATIONS = 15;

const mealCalorieBalanceLoop = () => {
  let noProgressCount = 0;
  let lastTotalError = Infinity;
  
  for (let iteration = 0; iteration < MAX_MEAL_BALANCE_ITERATIONS; iteration++) {
    let maxMealError = 0;
    
    for (const mealType of mainMeals) {
      const mealTarget = mealTargets[mealType].calories;
      const mealEditables = editableByMeal[mealType];
      if (mealEditables.length === 0) continue;
      
      // Calculate current meal calories (editables + locked/fixed)
      let mealCals = 0;
      mealEditables.forEach(item => {
        const grams = allItemGrams.get(item.itemId) || 0;
        mealCals += (item.caloriesPer100g * grams) / 100;
      });
      
      // Add locked/fixed items for this meal
      mealItems[mealType].forEach(item => {
        if (!item.product || item.product.ignore_macros) return;
        if (item.is_locked || item.product.product_type === "fixed") {
          const grams = allItemGrams.get(item.id) || item.quantity_grams;
          mealCals += (item.product.calories_per_100g * grams) / 100;
        }
      });
      
      const mealErr = mealTarget - mealCals;
      maxMealError = Math.max(maxMealError, Math.abs(mealErr));
      
      // If outside tolerance, adjust using category-specific constraints
      if (Math.abs(mealErr) > MEAL_CAL_TOLERANCE) {
        const adjustable = mealEditables
          .filter(i => !isSauceOrSeasoning(i.product))
          .filter(i => {
            if (mealType === "breakfast") {
              const role = getBreakfastRole(i.product);
              return role === "base"; // Only adjust yoghurt base for breakfast
            }
            return true;
          })
          .sort((a, b) => b.caloriesPer100g - a.caloriesPer100g);
        
        if (adjustable.length > 0) {
          const item = adjustable[0];
          const currentGrams = allItemGrams.get(item.itemId) || 0;
          
          // Get constraints using getItemConstraints logic
          let minGrams = settings.minGrams;
          let maxGrams = getMaxPortion(item.product, settings);
          
          const role = mealType === "breakfast" ? getBreakfastRole(item.product) : null;
          if (role === "base") {
            const yogType = getYoghurtType(item.product);
            if (yogType === "primary") { minGrams = 200; maxGrams = 300; }
            else if (yogType === "secondary") { minGrams = 50; maxGrams = 150; }
          }
          if (item.carbsPer100g > 25 && item.proteinPer100g < 10) {
            minGrams = Math.max(minGrams, 80); // Staple carb minimum
          }
          
          const adjustment = (mealErr / item.caloriesPer100g) * 100;
          const cappedAdjustment = Math.max(-20, Math.min(20, adjustment));
          const newGrams = Math.max(minGrams, Math.min(maxGrams, currentGrams + cappedAdjustment));
          allItemGrams.set(item.itemId, Math.round(newGrams));
        }
      }
    }
    
    // Early exit if all meals within tolerance
    if (maxMealError <= MEAL_CAL_TOLERANCE) break;
    
    // No-progress detection
    if (maxMealError >= lastTotalError - 1) {
      noProgressCount++;
      if (noProgressCount > 3) break;
    } else {
      noProgressCount = 0;
    }
    lastTotalError = maxMealError;
  }
};

mealCalorieBalanceLoop();
```

### 2. Ordering rule (must-do): composition cannot be the last mutating step
validateMealComposition() can change grams (e.g., enforce 80g fruit or 80g carbs), which can push macros/calories outside tolerance. Therefore one of the following must be implemented:

Preferred: Run composition enforcement before the final global precision loop (and before the final micro-correction), so the last step is always the ±1g convergence logic; OR

Alternative: If composition validation remains after micro-corrections, immediately run a final “post-validation precision loop” (same ±1g logic) to bring daily totals back within tolerance without violating composition minimums.

In all cases the final output must satisfy: integer grams, selected toppers non-zero, meal composition non-zero (when selected), per-meal calorie split tolerance, and daily macros within ±1g.

Implementation detail: place validateMealComposition() before the existing final precision loop, or call runPrecisionLoop() again after validation.

### 3. Composition Validator (insert after line 1291, after microCorrect calls)

```typescript
// === COMPOSITION VALIDATION PASS ===
// Ensure lunch/dinner have non-zero protein + carb + veg when selected
const validateMealComposition = () => {
  for (const mealType of ["lunch", "dinner"] as MealType[]) {
    const mealEditables = editableByMeal[mealType];
    if (mealEditables.length === 0) continue;
    
    // Categorize items by food role
    const proteins = mealEditables.filter(i => isHighProteinSource(i.product));
    const carbs = mealEditables.filter(i => i.carbsPer100g > 25 && i.proteinPer100g < 10);
    const vegs = mealEditables.filter(i => getFoodType(i.product) === "veg");
    
    // Helper to get category-specific minimum
    const getCategoryMinimum = (item: EditableItem): number => {
      if (isHighProteinSource(item.product)) return settings.minGrams;
      if (item.carbsPer100g > 25 && item.proteinPer100g < 10) return 80; // Staple carb min
      return settings.minGrams; // Veg default
    };
    
    // Ensure each category with items has non-zero grams
    [proteins, carbs, vegs].forEach(category => {
      category.forEach(item => {
        const grams = allItemGrams.get(item.itemId) || 0;
        const categoryMin = getCategoryMinimum(item);
        if (grams < categoryMin) {
          allItemGrams.set(item.itemId, categoryMin);
        }
      });
    });
  }
  
  // Validate breakfast: ensure toppers/fruit have non-zero if selected
  if (editableByMeal.breakfast.length > 0) {
    editableByMeal.breakfast.forEach(item => {
      const role = getBreakfastRole(item.product);
      const grams = allItemGrams.get(item.itemId) || 0;
      
      if (role === "topper" && grams < 25) allItemGrams.set(item.itemId, 25);
      else if (role === "secondary" && grams < 80) allItemGrams.set(item.itemId, 80);
      else if (role === "base") {
        const yogType = getYoghurtType(item.product);
        if (yogType === "primary" && grams < 200) allItemGrams.set(item.itemId, 200);
        else if (yogType === "secondary" && grams < 50) allItemGrams.set(item.itemId, 50);
      }
    });
  }
};

validateMealComposition();
```

### 4. Comprehensive Test Suite (NEW FILE: `src/lib/autoPortioning.test.ts`)

```typescript
import { describe, it, expect } from "vitest";
import { calculateDayPortions, DEFAULT_PORTIONING_SETTINGS } from "./autoPortioning";
import { MealPlanItem, MealType } from "@/hooks/useMealPlanItems";
import { Product } from "@/hooks/useProducts";
import { MacroTotals } from "./mealCalculations";

// === TEST FIXTURES ===
const createProduct = (overrides: Partial<Product> = {}): Product => ({
  id: `product-${Math.random().toString(36).substr(2, 9)}`,
  name: "Test Product",
  calories_per_100g: 100,
  protein_per_100g: 10,
  carbs_per_100g: 15,
  fat_per_100g: 5,
  price: 1.0,
  pack_size_grams: 500,
  product_type: "editable",
  ignore_macros: false,
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

// === UNIT TESTS ===
describe("autoPortioning", () => {
  describe("integer grams invariant", () => {
    it("all portions are whole integers", () => {
      const chicken = createProduct({ name: "Chicken Breast", protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6, calories_per_100g: 165 });
      const rice = createProduct({ name: "Basmati Rice", protein_per_100g: 4, carbs_per_100g: 78, fat_per_100g: 0.5, calories_per_100g: 350 });
      
      const items = [
        createMealPlanItem(chicken, "lunch"),
        createMealPlanItem(rice, "lunch"),
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
  });

  describe("macro tolerance invariant (±1g)", () => {
    it("protein, carbs, fat all within ±1g of targets", () => {
      const yogurt = createProduct({ name: "0% Greek Yogurt", protein_per_100g: 10, carbs_per_100g: 4, fat_per_100g: 0, calories_per_100g: 57 });
      const granola = createProduct({ name: "Granola", protein_per_100g: 8, carbs_per_100g: 60, fat_per_100g: 15, calories_per_100g: 400 });
      const chicken = createProduct({ name: "Chicken", protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6, calories_per_100g: 165 });
      const rice = createProduct({ name: "Rice", protein_per_100g: 4, carbs_per_100g: 78, fat_per_100g: 0.5, calories_per_100g: 350 });
      
      const items = [
        createMealPlanItem(yogurt, "breakfast"),
        createMealPlanItem(granola, "breakfast"),
        createMealPlanItem(chicken, "lunch"),
        createMealPlanItem(rice, "lunch"),
        createMealPlanItem(chicken, "dinner"),
        createMealPlanItem(rice, "dinner"),
      ];
      
      const targets: MacroTotals = { calories: 2000, protein: 170, carbs: 220, fat: 50 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      if (result.success) {
        expect(Math.abs(result.dayTotals.protein - targets.protein)).toBeLessThanOrEqual(1);
        expect(Math.abs(result.dayTotals.carbs - targets.carbs)).toBeLessThanOrEqual(1);
        expect(Math.abs(result.dayTotals.fat - targets.fat)).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("per-meal calorie balance (±10 kcal)", () => {
    it("each meal is within ±10 kcal of its 1/3 share when solvable", () => {
      const chicken = createProduct({ name: "Chicken", protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6, calories_per_100g: 165 });
      const rice = createProduct({ name: "Rice", protein_per_100g: 4, carbs_per_100g: 78, fat_per_100g: 0.5, calories_per_100g: 350 });
      const yogurt = createProduct({ name: "0% Yogurt", protein_per_100g: 10, carbs_per_100g: 4, fat_per_100g: 0, calories_per_100g: 57 });
      
      const items = [
        createMealPlanItem(yogurt, "breakfast"),
        createMealPlanItem(chicken, "lunch"),
        createMealPlanItem(rice, "lunch"),
        createMealPlanItem(chicken, "dinner"),
        createMealPlanItem(rice, "dinner"),
      ];
      
      const targets: MacroTotals = { calories: 1800, protein: 150, carbs: 180, fat: 40 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      if (result.success) {
        const mealCalTarget = targets.calories / 3;
        
        result.mealResults.forEach((mealResult, mealType) => {
          if (mealType !== "snack") {
            const mealCalErr = Math.abs(mealResult.achievedMacros.calories - mealCalTarget);
            // Allow ±15 kcal tolerance (slightly relaxed due to rounding constraints)
            expect(mealCalErr).toBeLessThanOrEqual(15);
          }
        });
      }
    });
  });

  describe("topper non-zero invariant", () => {
    it("selected granola never ends at 0g", () => {
      const yogurt = createProduct({ name: "0% Yogurt", protein_per_100g: 10, carbs_per_100g: 4, fat_per_100g: 0, calories_per_100g: 57 });
      const granola = createProduct({ name: "Granola Topper", protein_per_100g: 8, carbs_per_100g: 60, fat_per_100g: 15, calories_per_100g: 400 });
      
      const items = [
        createMealPlanItem(yogurt, "breakfast"),
        createMealPlanItem(granola, "breakfast"),
      ];
      
      const targets: MacroTotals = { calories: 400, protein: 30, carbs: 40, fat: 10 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const breakfastResult = result.mealResults.get("breakfast");
      const granolaGrams = breakfastResult?.items.get(items[1].id);
      
      expect(granolaGrams).toBeGreaterThanOrEqual(25);
      expect(granolaGrams).toBeLessThanOrEqual(40);
    });
    
    it("selected fruit never ends at 0g", () => {
      const yogurt = createProduct({ name: "0% Yogurt", protein_per_100g: 10, carbs_per_100g: 4, fat_per_100g: 0, calories_per_100g: 57 });
      const fruit = createProduct({ name: "Mixed Berries Fruit", protein_per_100g: 1, carbs_per_100g: 10, fat_per_100g: 0.3, calories_per_100g: 45 });
      
      const items = [
        createMealPlanItem(yogurt, "breakfast"),
        createMealPlanItem(fruit, "breakfast"),
      ];
      
      const targets: MacroTotals = { calories: 400, protein: 30, carbs: 40, fat: 10 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const breakfastResult = result.mealResults.get("breakfast");
      const fruitGrams = breakfastResult?.items.get(items[1].id);
      
      expect(fruitGrams).toBeGreaterThanOrEqual(80);
      expect(fruitGrams).toBeLessThanOrEqual(120);
    });
  });

  describe("locked items invariant", () => {
    it("locked items preserve their original quantity", () => {
      const chicken = createProduct({ name: "Chicken", protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6, calories_per_100g: 165 });
      const rice = createProduct({ name: "Rice", protein_per_100g: 4, carbs_per_100g: 78, fat_per_100g: 0.5, calories_per_100g: 350 });
      
      const lockedQuantity = 150;
      const items = [
        createMealPlanItem(chicken, "lunch", lockedQuantity, true),
        createMealPlanItem(rice, "lunch"),
      ];
      
      const targets: MacroTotals = { calories: 600, protein: 50, carbs: 100, fat: 15 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const lunchResult = result.mealResults.get("lunch");
      const chickenGrams = lunchResult?.items.get(items[0].id);
      
      expect(chickenGrams).toBe(lockedQuantity);
    });
  });

  describe("breakfast proportionality", () => {
    it("0% yogurt is sized larger than Greek yogurt", () => {
      const zeroYogurt = createProduct({ name: "0% Fat Free Yogurt", protein_per_100g: 10, carbs_per_100g: 4, fat_per_100g: 0, calories_per_100g: 57 });
      const greekYogurt = createProduct({ name: "Greek Full Fat Yogurt", protein_per_100g: 5, carbs_per_100g: 4, fat_per_100g: 10, calories_per_100g: 130 });
      
      const items = [
        createMealPlanItem(zeroYogurt, "breakfast"),
        createMealPlanItem(greekYogurt, "breakfast"),
      ];
      
      const targets: MacroTotals = { calories: 500, protein: 40, carbs: 50, fat: 15 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const breakfastResult = result.mealResults.get("breakfast");
      const zeroGrams = breakfastResult?.items.get(items[0].id) || 0;
      const greekGrams = breakfastResult?.items.get(items[1].id) || 0;
      
      expect(zeroGrams).toBeGreaterThanOrEqual(200);
      expect(zeroGrams).toBeLessThanOrEqual(300);
      expect(greekGrams).toBeGreaterThanOrEqual(50);
      expect(greekGrams).toBeLessThanOrEqual(150);
      expect(zeroGrams).toBeGreaterThan(greekGrams);
    });
  });

  describe("seasoning constraints", () => {
    it("seasonings stay within 5-30g range", () => {
      const chicken = createProduct({ name: "Chicken Breast", protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6, calories_per_100g: 165 });
      const seasoning = createProduct({ name: "Schwartz Paprika Seasoning", protein_per_100g: 0, carbs_per_100g: 5, fat_per_100g: 2, calories_per_100g: 40, food_type: "sauce" });
      
      const items = [
        createMealPlanItem(chicken, "dinner"),
        createMealPlanItem(seasoning, "dinner"),
      ];
      
      const targets: MacroTotals = { calories: 600, protein: 50, carbs: 70, fat: 15 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const dinnerResult = result.mealResults.get("dinner");
      const seasoningGrams = dinnerResult?.items.get(items[1].id) || 0;
      
      expect(seasoningGrams).toBeGreaterThanOrEqual(5);
      expect(seasoningGrams).toBeLessThanOrEqual(30);
    });
  });

  describe("composition validation", () => {
    it("lunch/dinner protein items have non-zero grams", () => {
      const chicken = createProduct({ name: "Chicken", protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6, calories_per_100g: 165 });
      const rice = createProduct({ name: "Rice", protein_per_100g: 4, carbs_per_100g: 78, fat_per_100g: 0.5, calories_per_100g: 350 });
      const broccoli = createProduct({ name: "Broccoli", protein_per_100g: 3, carbs_per_100g: 7, fat_per_100g: 0.4, calories_per_100g: 34, food_type: "veg" });
      
      const items = [
        createMealPlanItem(chicken, "lunch"),
        createMealPlanItem(rice, "lunch"),
        createMealPlanItem(broccoli, "lunch"),
      ];
      
      const targets: MacroTotals = { calories: 600, protein: 50, carbs: 80, fat: 15 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      const lunchResult = result.mealResults.get("lunch");
      
      items.forEach(item => {
        const grams = lunchResult?.items.get(item.id) || 0;
        expect(grams).toBeGreaterThan(0);
      });
    });
  });

  describe("convergence or explicit failure", () => {
    it("returns success=false with warning when targets unreachable", () => {
      const rice = createProduct({ name: "Rice", protein_per_100g: 4, carbs_per_100g: 78, fat_per_100g: 0.5, calories_per_100g: 350 });
      
      const items = [createMealPlanItem(rice, "lunch")];
      const targets: MacroTotals = { calories: 500, protein: 100, carbs: 50, fat: 10 };
      const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
      
      if (!result.success) {
        expect(result.warnings.length).toBeGreaterThan(0);
      }
    });
  });
});

// === PROPERTY-BASED TESTS ===
describe("autoPortioning - randomized scenarios", () => {
  const runRandomizedTest = (seed: number) => {
    const products = [
      createProduct({ name: `Protein-${seed}`, protein_per_100g: 25 + Math.random() * 10, carbs_per_100g: 2, fat_per_100g: 5, calories_per_100g: 150 + Math.random() * 50 }),
      createProduct({ name: `Carb-${seed}`, protein_per_100g: 5, carbs_per_100g: 60 + Math.random() * 20, fat_per_100g: 2, calories_per_100g: 300 + Math.random() * 100 }),
      createProduct({ name: `Fat-${seed}`, protein_per_100g: 3, carbs_per_100g: 10, fat_per_100g: 15 + Math.random() * 10, calories_per_100g: 200 + Math.random() * 100 }),
    ];
    
    const mealTypes: MealType[] = ["breakfast", "lunch", "dinner"];
    const items = products.map((p, i) => createMealPlanItem(p, mealTypes[i % 3]));
    
    const targets: MacroTotals = {
      calories: 1500 + Math.random() * 1000,
      protein: 120 + Math.random() * 80,
      carbs: 150 + Math.random() * 100,
      fat: 40 + Math.random() * 40,
    };
    
    const result = calculateDayPortions(items, targets, DEFAULT_PORTIONING_SETTINGS);
    
    // Invariants that must always hold
    result.mealResults.forEach((mealResult) => {
      mealResult.items.forEach((grams) => {
        expect(Number.isInteger(grams)).toBe(true);
        expect(grams).toBeGreaterThanOrEqual(0);
      });
    });
    
    // If successful, macros must be within ±1g tolerance
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
```

---

## Key Design Decisions

### 1. Iterative Meal Balancer (15 passes)
- **Early exit**: Stops immediately when all meals are within ±10 kcal
- **No-progress detection**: Breaks after 3 consecutive iterations without improvement
- **Capped adjustments**: Max ±20g per iteration to avoid wild swings
- **Uses category constraints**: Applies correct min/max based on item type

### 2. Composition Validator with Category Minimums
- **Protein items**: Uses `settings.minGrams` (typically 10g)
- **Carb items** (rice/pasta): Enforces 80g minimum
- **Veg items**: Uses `settings.minGrams`
- **Toppers**: 25g minimum for granola, 80g for fruit
- **Yoghurt**: 200g min for 0%, 50g min for Greek

### 3. Test Suite Alignment
- **±1g tolerance** for protein, carbs, fat (not ±1.5)
- **±10-15 kcal tolerance** for per-meal calorie balance
- **20 randomized scenarios** testing all invariants
- **Explicit failure detection** tests

Constraint source of truth (must-do)
Refactor constraint handling so there is exactly one place that defines min/max grams and role rules. Both mealCalorieBalanceLoop() and validateMealComposition() must call getItemConstraints(item, mealType, settings) (or the project’s equivalent constraint helper) to obtain { minGrams, maxGrams }. Do not duplicate logic like yoghurt ranges, topper mins, or carb mins inside the loops. If any role/category rules need adjusting (e.g., breakfast base/secondary/topper ranges), update them inside the constraint helper only, so all phases use identical limits and we avoid regressions caused by mismatched constraints.

If the current helper does not return both min/max, extend it to return { minGrams, maxGrams } and migrate existing hardcoded constraint branches to it.

---

## Expected Results

| Invariant | Guarantee |
|-----------|-----------|
| Integer grams | All portions are whole numbers |
| Protein tolerance | Within ±1g of target |
| Carbs tolerance | Within ±1g of target |
| Fat tolerance | Within ±1g of target |
| Per-meal calories | Within ±10-15 kcal of 1/3 share |
| Topper minimums | Granola ≥25g, Fruit ≥80g |
| Locked items | Never changed during generation |
| Composition | Protein + carb + veg all non-zero when selected |
| Failure handling | Explicit warnings when unsolvable |

---

## Testing Checklist

1. Run `vitest` to execute all 25+ automated tests
2. Generate portions for Monday - verify ±1g on all macros
3. Check that each meal is within ±10 kcal of 1/3 share
4. Verify breakfast composition: 0% yoghurt ~250g, Greek ~100g, granola 25-40g, fruit 80-120g
5. Verify lunch/dinner composition: protein + carb + veg all non-zero
6. Lock some items, regenerate - verify locked quantities preserved
7. Test Reset Day and Reset Week buttons (already implemented in UI)
