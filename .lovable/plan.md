# Plan: Per-Meal Constraints + Composition Validation + Comprehensive Tests

## Status: ✅ IMPLEMENTED

## Summary

This plan implemented:
1. **Iterative per-meal calorie balancer** (15 passes with early exit and no-progress detection) targeting **equal meal split** across breakfast/lunch/dinner within **±15 kcal**
2. **Composition enforcement + validator** using **category/role-specific minimums and bounds from `getItemConstraints`** (single source of truth)
3. **Comprehensive test suite** with **±1g macro tolerance** plus **per-meal calorie balance tests** and invariants

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/autoPortioning.ts` | Added Phase 1.5 meal calorie balance loop; added `getItemConstraints` helper (single source of truth); added `validateMealComposition()` before final precision loop |
| `src/lib/autoPortioning.test.ts` | **NEW** - Comprehensive test suite with 44 tests including 20 randomized scenarios |

---

## Implementation Details

### 1. Single Source of Truth: `getItemConstraints()`

A shared helper function that returns `{ minGrams, maxGrams }` for any item based on:
- Breakfast role (base/secondary/topper)
- Yoghurt type (primary 0% vs secondary Greek)
- Staple carb detection (80g minimum for rice/pasta)

All phases (meal calorie balance, composition validation, precision loop) use this single function.

### 2. Phase 1.5: Per-Meal Calorie Balance Loop

- Runs **after Phase 1** (meal independent solve) and **before Phase 2** (global fine-tuning)
- **15 iterations max** with early exit when all meals within ±15 kcal
- **No-progress detection** breaks after 3 iterations without improvement
- Only adjusts "base" items for breakfast (not toppers/fruit)
- Caps adjustments at ±20g per iteration to prevent oscillation

### 3. Composition Validator

- Runs **after meal calorie balance** and **before final precision loop**
- Ensures lunch/dinner have non-zero protein + carb + veg when selected
- Ensures breakfast items respect role minimums (topper ≥25g, fruit ≥80g, yoghurt ≥200/50g)
- Uses `getItemConstraints()` for all bounds

### 4. Test Suite (44 tests)

**Unit Tests:**
- Integer grams invariant (2 tests)
- Macro tolerance ±1g (2 tests)
- Per-meal calorie balance ±15 kcal (2 tests)
- Topper non-zero invariant (3 tests)
- Locked items invariant (2 tests)
- Breakfast proportionality (2 tests)
- Seasoning constraints (2 tests)
- Composition validation (2 tests)
- Convergence/failure handling (2 tests)
- Utility functions (2 tests)

**Randomized Tests:**
- 20 property-based scenarios with random products and targets
- All assert ±1g tolerance (not ±1.5)

**Realistic Scenarios:**
- Typical Monday meal plan
- Weekend higher targets
- Minimal single-meal plan

---

## Expected Results (Verified)

| Invariant | Guarantee |
|-----------|-----------|
| Integer grams | All portions are whole numbers ✅ |
| Protein tolerance | Within ±1g of target ✅ |
| Carbs tolerance | Within ±1g of target ✅ |
| Fat tolerance | Within ±1g of target ✅ |
| Per-meal calories | Within ±15 kcal of 1/3 share ✅ |
| Topper minimums | Granola ≥25g, Fruit ≥80g when selected ✅ |
| Locked items | Never changed during generation ✅ |
| Composition | Protein + carb + veg all non-zero when selected ✅ |
| Failure handling | Explicit warnings when unsolvable ✅ |

---

## Testing Checklist

- [x] Run `vitest` to execute all 44 automated tests - **ALL PASS**
- [x] Generate portions for Monday - verify ±1g on all macros
- [x] Check that each meal is within ±15 kcal of 1/3 share
- [x] Verify breakfast composition: base yoghurt 200-300g; Greek 50-150g; granola 25-40g; fruit 80-120g
- [x] Verify lunch/dinner composition: protein + carb + veg all non-zero
- [x] Lock some items, regenerate - verify locked quantities preserved
- [x] Verify "not solvable" warnings appear when targets can't be met with locks/foods
