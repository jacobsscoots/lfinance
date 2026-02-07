
# Fix Plan: Weekly Calorie Targets Not Applied to Meal Planner

## ✅ COMPLETED

### Root Causes Fixed

1. **MealDayCard.tsx** - Added `weeklyOverride` prop and passed it to `getTargetsForDate()` and `recalculateDay.mutate()`
2. **DayDetailModal.tsx** - Added `weeklyOverride` prop and passed it to `getTargetsForDate()`
3. **WeeklyMealPlanner.tsx** - Passed `weeklyOverride={weeklyOverride}` to both mobile and desktop `MealDayCard` components

### Changes Made

| File | Change |
|------|--------|
| `src/components/mealplan/MealDayCard.tsx` | Added `weeklyOverride` prop, updated imports, updated `getTargetsForDate()` call, updated `handleGenerate()`, passed prop to `DayDetailModal` |
| `src/components/mealplan/DayDetailModal.tsx` | Added `weeklyOverride` prop to interface and function signature, updated `getTargetsForDate()` call |
| `src/components/mealplan/WeeklyMealPlanner.tsx` | Added `weeklyOverride={weeklyOverride}` prop to both mobile and desktop MealDayCard renders |
| `src/lib/mealCalculations.test.ts` | Created new test file with 10 tests for `getTargetsForDate()` function |

### Tests Added & Passed

10 new tests in `src/lib/mealCalculations.test.ts`:
- ✅ Returns weekly override calories for Monday
- ✅ Returns weekly override calories for Saturday  
- ✅ Returns weekly override calories for Sunday
- ✅ Returns weekly override calories for Friday
- ✅ Returns global weekday targets for Monday (no override)
- ✅ Returns global weekend targets for Saturday (no override)
- ✅ Returns global weekend targets for Sunday (no override)
- ✅ Falls back to global settings when date is outside override week
- ✅ Uses global settings when weeklyOverride is undefined
- ✅ Uses global macro defaults when override has null macros

### Full Test Suite: 177 tests passed

### No Regressions
- Database schema unchanged
- RLS policies unchanged
- Global settings fallback still works
- Existing `recalculateAll` works correctly
- Macro calculation logic unchanged
