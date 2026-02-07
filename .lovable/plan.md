# Plan: Per-Meal Constraints + Composition Validation + Comprehensive Tests

## Summary

This plan implements:
1. **Iterative per-meal calorie balancer** (15 passes with early exit and no-progress detection) targeting **equal meal split** across breakfast/lunch/dinner within **±15 kcal**
2. **Composition enforcement + validator** using **category/role-specific minimums and bounds from `getItemConstraints`** (single source of truth)
3. **Comprehensive test suite** with **±1g macro tolerance** (not ±1.5) plus **per-meal calorie balance tests** and invariants

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/autoPortioning.ts` | Add meal calorie balance loop (Phase 1.5); add composition enforcement/validation; **composition must run BEFORE the final global precision loop so precision is the last mutating step** |
| `src/lib/autoPortioning.test.ts` | **NEW** - Comprehensive test suite with 20+ tests and randomized scenarios |

---

## Detailed Implementation

### 1. Iterative Per-Meal Calorie Balance Loop (Phase 1.5)

Insert **after Phase 1 (meal independent solve)** and **before Phase 2 (global fine-tuning)**:

```typescript
// === PHASE 1.5: Per-Meal Calorie Balance Loop ===
// Ensure each meal is within ±15 kcal of its equal share (iterative with early exit)
const MEAL_CAL_TOLERANCE = 15;
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

      // Editable items in this meal
      mealEditables.forEach(item => {
        const grams = allItemGrams.get(item.itemId) || 0;
        mealCals += (item.caloriesPer100g * grams) / 100;
      });

      // Locked/fixed items in this meal
      mealItems[mealType].forEach(item => {
        if (!item.product || item.product.ignore_macros) return;
        if (item.is_locked || item.product.product_type === "fixed") {
          const grams = allItemGrams.get(item.id) || item.quantity_grams;
          mealCals += (item.product.calories_per_100g * grams) / 100;
        }
      });

      const mealErr = mealTarget - mealCals;
      maxMealError = Math.max(maxMealError, Math.abs(mealErr));

      // If outside tolerance, adjust using SINGLE SOURCE OF TRUTH constraints
      if (Math.abs(mealErr) > MEAL_CAL_TOLERANCE) {
        const adjustable = mealEditables
          .filter(i => !isSauceOrSeasoning(i.product))
          .filter(i => {
            // Breakfast: avoid adjusting toppers/secondary by default
            // (constraints still come from getItemConstraints; this is just "which knob to turn")
            if (mealType === "breakfast") return getBreakfastRole(i.product) === "base";
            return true;
          })
          .sort((a, b) => b.caloriesPer100g - a.caloriesPer100g);

        if (adjustable.length > 0) {
          const item = adjustable[0];
          const currentGrams = allItemGrams.get(item.itemId) || 0;

          // IMPORTANT: constraints must come from the shared helper ONLY
          const { minGrams, maxGrams } = getItemConstraints(item, mealType, settings);

          const adjustment = (mealErr / item.caloriesPer100g) * 100;
          const cappedAdjustment = Math.max(-20, Math.min(20, adjustment));

          const newGrams = Math.max(minGrams, Math.min(maxGrams, Math.round(currentGrams + cappedAdjustment)));
          allItemGrams.set(item.itemId, newGrams);
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
2. Ordering rule (must-do): composition cannot be the last mutating step
validateMealComposition() can change grams (e.g., enforce minimums for carbs/veg or breakfast toppers), which can push macros/calories outside tolerance.

✅ Implementation requirement: Run validateMealComposition() BEFORE the final global precision loop (and before final micro-corrections if those exist), so the last mutating step is always the ±1g convergence logic.

3. Composition Enforcement + Validator (single source of truth constraints)
Insert after Phase 1.5 and before the final global precision loop:

// === COMPOSITION ENFORCEMENT / VALIDATION PASS ===
// Ensure lunch/dinner have non-zero protein + carb + veg when selected
// Ensure breakfast roles follow non-zero rules (base/secondary/topper) when selected
// IMPORTANT: Minimums/bounds must come from getItemConstraints (single source of truth)

const validateMealComposition = () => {
  // Lunch & dinner: protein + carb + veg non-zero when those items exist
  for (const mealType of ["lunch", "dinner"] as MealType[]) {
    const mealEditables = editableByMeal[mealType];
    if (mealEditables.length === 0) continue;

    const proteins = mealEditables.filter(i => isHighProteinSource(i.product));
    const carbs = mealEditables.filter(i => i.carbsPer100g > 25 && i.proteinPer100g < 10);
    const vegs = mealEditables.filter(i => getFoodType(i.product) === "veg");

    [proteins, carbs, vegs].forEach(category => {
      category.forEach(item => {
        const grams = allItemGrams.get(item.itemId) || 0;
        const { minGrams, maxGrams } = getItemConstraints(item, mealType, settings);

        // If the user selected the item (exists in editables), it must be non-zero (>= min)
        if (grams < minGrams) {
          allItemGrams.set(item.itemId, Math.max(minGrams, Math.min(maxGrams, minGrams)));
        }
      });
    });
  }

  // Breakfast: ensure selected items respect role minimums (topper/secondary/base) via getItemConstraints
  const breakfastEditables = editableByMeal.breakfast;
  if (breakfastEditables.length > 0) {
    breakfastEditables.forEach(item => {
      const grams = allItemGrams.get(item.itemId) || 0;
      const { minGrams, maxGrams } = getItemConstraints(item, "breakfast", settings);

      // Selected breakfast items must not end at 0g; enforce min
      if (grams < minGrams) {
        allItemGrams.set(item.itemId, Math.max(minGrams, Math.min(maxGrams, minGrams)));
      }
    });
  }
};

validateMealComposition();
4. Constraint source of truth (must-do)
Refactor constraint handling so there is exactly one place that defines min/max grams and role rules.

Both mealCalorieBalanceLoop() and validateMealComposition() must call getItemConstraints(item, mealType, settings) (or the project’s equivalent) to obtain { minGrams, maxGrams }.

Do not duplicate logic like yoghurt ranges, topper mins, or carb mins inside loops.

If any role/category rules need adjusting (e.g., breakfast base/secondary/topper ranges), update them inside the constraint helper only, so all phases use identical limits and we avoid regressions caused by mismatched constraints.

If the current helper does not return both min/max, extend it to return { minGrams, maxGrams } and migrate existing hardcoded constraint branches to it.

5. Comprehensive Test Suite (NEW FILE: src/lib/autoPortioning.test.ts)
Notes for tests:

Keep ±1g for protein/carbs/fat everywhere (unit + randomized).

Keep meal split tolerance consistent: ±15 kcal (matches MEAL_CAL_TOLERANCE).

Add at least one test that checks meal calories are within tolerance when solvable.

(Use the existing test template from the plan, but ensure per-meal calorie test asserts ≤ 15, and randomized tests assert ≤ 1 for macros.)

Expected Results
Invariant	Guarantee
Integer grams	All portions are whole numbers
Protein tolerance	Within ±1g of target
Carbs tolerance	Within ±1g of target
Fat tolerance	Within ±1g of target
Per-meal calories	Within ±15 kcal of 1/3 share
Topper minimums	Enforced via getItemConstraints (never 0g when selected)
Locked items	Never changed during generation
Composition	Lunch/dinner protein + carb + veg all non-zero when selected
Failure handling	Explicit warnings when unsolvable
Testing Checklist
Run vitest to execute all automated tests

Generate portions for Monday - verify ±1g on all macros

Check that each meal is within ±15 kcal of 1/3 share

Verify breakfast composition: base yoghurt larger than Greek; fruit/granola never 0g when selected

Verify lunch/dinner composition: protein + carb + veg all non-zero

Lock some items, regenerate - verify locked quantities preserved

Verify “not solvable” warnings appear when targets can’t be met with locks/foods