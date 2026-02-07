
# Fix Plan: Weekly Calorie Targets Not Applied to Meal Planner

## Root Causes Identified

### Issue 1: Missing `weeklyOverride` in `MealDayCard`
- **File**: `src/components/mealplan/MealDayCard.tsx`
- **Line**: 57-60
- **Problem**: Calls `getTargetsForDate(date, settings)` without the `weeklyOverride` parameter
- **Result**: Shows 1951 kcal (global settings) instead of 1717 kcal (weekly zigzag)

### Issue 2: Missing `weeklyOverride` in `DayDetailModal`
- **File**: `src/components/mealplan/DayDetailModal.tsx`
- **Line**: 58-63
- **Problem**: Same issue - no `weeklyOverride` passed
- **Result**: Detail popup shows wrong target (2302 instead of 2101 for Saturday)

### Issue 3: Per-day Generate button doesn't use weekly targets
- **File**: `src/components/mealplan/MealDayCard.tsx`
- **Line**: 148-159
- **Problem**: `recalculateDay.mutate()` missing `weeklyOverride` parameter
- **Result**: Per-day portion generation uses global targets

## Proposed Edits

### Edit 1: Update `MealDayCard` props to accept `weeklyOverride`

**What**: Add `weeklyOverride` prop to `MealDayCardProps` interface and use it in `getTargetsForDate` call.

**Why it fixes**: The weekly targets stored in DB (1717 weekdays, 2101 weekends) will be used for display and per-day generation.

**What it will NOT affect**: No changes to database, RLS, or existing macro calculation logic. Only wiring up existing data.

### Edit 2: Update `WeeklyMealPlanner` to pass `weeklyOverride` to `MealDayCard`

**What**: Add `weeklyOverride={weeklyOverride}` prop when rendering `MealDayCard` components.

**Why it fixes**: Provides the weekly targets data to each day card.

### Edit 3: Update `DayDetailModal` to accept and use `weeklyOverride`

**What**: Add `weeklyOverride` prop and use it in `getTargetsForDate` call.

**Why it fixes**: Day detail popup will show correct targets.

### Edit 4: Update `MealDayCard.handleGenerate` to pass `weeklyOverride`

**What**: Pass `weeklyOverride` to `recalculateDay.mutate()` call.

**Why it fixes**: Per-day portion generation will use weekly zigzag targets.

## Files to Modify

1. `src/components/mealplan/MealDayCard.tsx`
   - Add `weeklyOverride?: WeeklyTargetsOverride | null` to props interface
   - Update `getTargetsForDate(date, settings)` → `getTargetsForDate(date, settings, weeklyOverride)`
   - Pass `weeklyOverride` to `DayDetailModal`
   - Pass `weeklyOverride` to `recalculateDay.mutate()`

2. `src/components/mealplan/DayDetailModal.tsx`
   - Add `weeklyOverride?: WeeklyTargetsOverride | null` to props interface
   - Update `getTargetsForDate(date, settings)` → `getTargetsForDate(date, settings, weeklyOverride)`

3. `src/components/mealplan/WeeklyMealPlanner.tsx`
   - Pass `weeklyOverride={weeklyOverride}` to both mobile and desktop `MealDayCard` components

## No Regressions

- Database schema unchanged
- RLS policies unchanged  
- Global settings fallback still works (when `weeklyOverride` is null)
- Existing `recalculateAll` already works correctly with weekly targets
- Macro calculation logic unchanged

## Tests Required

Add tests to verify:
1. `getTargetsForDate` returns weekly override values when date matches week
2. `getTargetsForDate` falls back to global settings when no override
3. Edge case: date outside weekly override week uses global settings

## Technical Details

```text
Data Flow (Fixed):

ZigzagCalculator → saves weekly_nutrition_targets (week_start_date: "2026-02-09")
                   ├── monday_calories: 1717
                   ├── saturday_calories: 2101
                   └── sunday_calories: 2101

WeeklyMealPlanner → useWeeklyNutritionTargets(weekStartMonday)
                  → builds weeklyOverride object
                  → passes to MealDayCard (NEW)
                  → passes to calculateDayMacros (existing)

MealDayCard → receives weeklyOverride prop (NEW)
           → getTargetsForDate(date, settings, weeklyOverride) (FIXED)
           → displays correct targets
           → handleGenerate passes weeklyOverride (FIXED)

DayDetailModal → receives weeklyOverride prop (NEW)
             → getTargetsForDate(date, settings, weeklyOverride) (FIXED)
             → displays correct targets in header
```
