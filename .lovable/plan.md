
# Unified Targets Pipeline for Macro Solver Consistency

## Problem Summary

After weekly calorie updates, the meal planner produces days with:
- Calories +234 over target
- Fat -21g under target
- Protein and carbs on target

This happens because:
1. **Multiple target-resolution code paths** exist (UI uses one, solver uses another, they can drift)
2. **Weekly calorie overrides don't recalculate macro targets consistently** - they store P/C/F separately and these can become stale or inconsistent with changed calorie targets
3. **Fat is not derived from remaining calories** when weekly targets change (user confirmed they want: keep protein, keep carbs, derive fat from remaining calories)

---

## Solution Architecture

### Core Principle: Single Source of Truth

Create **ONE** authoritative function that returns daily targets for any date, and **ONE** totals function used by both solver and UI.

```text
                  ┌─────────────────────────┐
                  │   getDailyTargets(date) │
                  │  (single source of truth)│
                  └───────────┬─────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
   UI Day Card        Solver Input         Summary Cards
   (display)         (calculateDayPortions)  (weekly avg)
```

### Macro Derivation Rule (User-Confirmed)

When weekly calorie targets change:
1. **Protein stays fixed** (from global settings or weekly override)
2. **Carbs stay fixed** (from global settings or weekly override)
3. **Fat = (Target Calories - Protein×4 - Carbs×4) ÷ 9** (derived from remaining calories)

This ensures:
- Calories are always consistent with macros
- Fat becomes the "flex" macro that absorbs calorie changes
- No more +234 cal / -21g fat scenarios (they literally can't happen)

### Holiday/Blackout Handling (User-Confirmed)

For blackout dates:
- Generator **skips** these days entirely
- Existing grams remain **untouched**
- UI shows "Holiday / no meal prep" badge (already implemented)
- Days are excluded from weekly grocery aggregation and summary averages (already implemented)

---

## Implementation Plan

### Step 1: Create `getDailyTargets()` Function

**File: `src/lib/dailyTargets.ts` (new)**

```typescript
export interface DailyTargetsInput {
  date: Date;
  globalSettings: NutritionSettings | null;
  weeklyTargets: WeeklyNutritionTargets | null;
}

export interface DailyTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;  // DERIVED from remaining calories
}

export function getDailyTargets(input: DailyTargetsInput): DailyTargets {
  // 1. Determine base calories for the day:
  //    - Check weeklyTargets first (zigzag schedule by day-of-week)
  //    - Fall back to globalSettings (weekday vs weekend)
  //
  // 2. Determine protein/carbs:
  //    - From weeklyTargets if set
  //    - Fall back to globalSettings
  //
  // 3. DERIVE fat from remaining calories:
  //    remainingCal = targetCalories - (protein × 4) - (carbs × 4)
  //    fat = Math.max(0, Math.round(remainingCal / 9))
}
```

**Key difference from current code:**
- Current: fat target stored independently, can become inconsistent with calorie target
- New: fat is ALWAYS derived, so calories = protein×4 + carbs×4 + fat×9 by construction

### Step 2: Create `computeTotals()` Function

**File: `src/lib/dailyTargets.ts`**

```typescript
export function computeTotals(
  items: MealPlanItem[],
  gramsById: Map<string, number>
): MacroTotals {
  // Sum up calories, protein, carbs, fat from all items
  // Using grams from the map (solver output OR DB stored values)
  // Handles ignore_macros, fixed portions, etc.
}
```

This function becomes the SINGLE source of totals for:
- Solver success check (after solving)
- UI day totals display (DayDetailModal, MealDayCard)
- Weekly summary calculations

### Step 3: Update Solver to Use `getDailyTargets()`

**File: `src/hooks/useMealPlanItems.ts`**

Change `recalculateDay` and `recalculateAll` to:
1. Import and call `getDailyTargets()` instead of `getTargetsForDate()`
2. Pass the unified targets to `calculateDayPortions()`

```typescript
// Before
const targets = getTargetsForDate(dayDate, settings, weeklyOverride);

// After
const targets = getDailyTargets({
  date: dayDate,
  globalSettings: settings,
  weeklyTargets: weeklyOverride,
});
```

### Step 4: Update UI to Use Same Functions

**Files to update:**
- `src/components/mealplan/MealDayCard.tsx` - use `getDailyTargets()`
- `src/components/mealplan/DayDetailModal.tsx` - use `getDailyTargets()` + `computeTotals()`
- `src/lib/mealCalculations.ts` - refactor `getTargetsForDate()` to call `getDailyTargets()` internally (or deprecate)

### Step 5: Update `WeeklyNutritionTargets` Save Logic

**File: `src/components/settings/ZigzagCalculator.tsx`**

When saving weekly targets:
- Store the calorie schedule (Mon-Sun)
- Store protein and carbs targets
- Do NOT store fat (it will be derived on read)

OR alternatively:
- Store fat as well for display purposes, but `getDailyTargets()` will always recalculate it on read to ensure consistency

### Step 6: Skip Blackout Days in Generator

**File: `src/hooks/useMealPlanItems.ts`**

In `recalculateDay` and `recalculateAll`:

```typescript
// Check if this date is a blackout day
if (isDateBlackout(plan.meal_date, blackouts)) {
  // Skip - don't generate, don't modify grams
  continue;
}
```

The UI already handles display (shows Holiday card) - this just ensures the generator respects it.

---

## Tests to Add

**File: `src/lib/dailyTargets.test.ts` (new)**

```typescript
describe("getDailyTargets", () => {
  it("derives fat from remaining calories correctly", () => {
    // calories=2000, protein=150 (600cal), carbs=200 (800cal)
    // remaining = 2000 - 600 - 800 = 600cal
    // fat = 600 / 9 = 67g
  });

  it("returns same targets used by UI and solver", () => {
    // Verify getDailyTargets() output matches what both UI and solver receive
  });

  it("handles weekly calorie override with fixed protein/carbs", () => {
    // If zigzag lowers Monday to 1800 cal:
    // fat = (1800 - 600 - 800) / 9 = 44g
  });

  it("clamps fat to minimum 0g when calories too low", () => {
    // Edge case: target calories too low to cover protein+carb calories
  });
});

describe("computeTotals", () => {
  it("matches solver totals exactly", () => {
    // Use same items and grams, verify identical output
  });

  it("handles ignore_macros items correctly", () => {
    // Items with ignore_macros contribute 0 to totals
  });
});
```

**File: `src/lib/autoPortioning.test.ts` (additions)**

```typescript
describe("unified targets integration", () => {
  it("fat never differs from derived value when solvable", () => {
    // If solver succeeds, fat totals = (achieved cal - pro×4 - carb×4) / 9
    // This test ensures internal consistency
  });

  it("regression: no +200cal/-20fat scenarios", () => {
    // Create the exact failure case and verify it either:
    // - Hits all macros within tolerance, OR
    // - Returns success=false with clear warning
  });
});
```

**File: `src/lib/mealPlannerWeek.test.ts` (additions)**

```typescript
describe("blackout day handling in generation", () => {
  it("generator skips blackout days", () => {
    // Verify recalculateAll does not touch blackout day items
  });
});
```

---

## Files to Create/Modify Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/dailyTargets.ts` | **CREATE** | Single source of truth for targets + totals |
| `src/lib/dailyTargets.test.ts` | **CREATE** | Tests for unified targets |
| `src/hooks/useMealPlanItems.ts` | MODIFY | Use `getDailyTargets()`, skip blackouts |
| `src/components/mealplan/MealDayCard.tsx` | MODIFY | Use `getDailyTargets()` |
| `src/components/mealplan/DayDetailModal.tsx` | MODIFY | Use `getDailyTargets()` + `computeTotals()` |
| `src/lib/mealCalculations.ts` | MODIFY | Deprecate/refactor `getTargetsForDate()` to use `getDailyTargets()` |
| `src/components/settings/ZigzagCalculator.tsx` | MODIFY (optional) | Clarify that fat is derived |
| `src/lib/autoPortioning.test.ts` | MODIFY | Add regression test for the failure pattern |

---

## Why This Fix Works

1. **Fat is derived, not stored independently**
   - When calories change, fat automatically adjusts
   - Impossible to have calorie-inconsistent macros

2. **Single function = single behavior**
   - UI and solver call the same `getDailyTargets()`
   - No drift possible between what user sees and what solver targets

3. **Consistent totals calculation**
   - Both solver success check and UI display use `computeTotals()`
   - No rounding or calculation differences

4. **Clear failure modes**
   - If solver can't hit derived fat target, it returns `success=false`
   - Warning explains which macro failed and why
   - No "pretend success" with +234cal / -21g fat

---

## Technical Details

### Fat Derivation Formula

```
remainingCalories = targetCalories - (proteinGrams × 4) - (carbsGrams × 4)
fatGrams = Math.max(0, Math.round(remainingCalories / 9))
```

### Week Boundary Logic

Weekly targets apply to **Mon-Sun** (the main nutrition week), even though the shopping week is **Sun-Mon** (9 days). The `getDailyTargets()` function resolves the correct weekly override by checking which Mon-Sun week the date falls into.

### Blackout Exclusion

```typescript
// In recalculateAll mutation:
for (const plan of mealPlans) {
  if (isDateBlackout(plan.meal_date, blackouts)) {
    // Don't generate, don't modify, skip entirely
    continue;
  }
  // ... normal generation logic
}
```

---

## Verification Steps

After implementation:

1. **Set weekly calorie target** via Zigzag Calculator
2. **Generate portions** for a day
3. **Open day detail modal** and verify:
   - Displayed targets match solver targets (check console debug if needed)
   - Fat target = (displayed calories - protein×4 - carbs×4) / 9
   - If solver succeeded, all macros within ±1g

4. **Run test suite**: `npm test` - all tests must pass

5. **Blackout test**: Add a holiday date, generate portions, verify that day's grams unchanged
