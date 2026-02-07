# Plan: Meal Planning Improvements - COMPLETED

## Status: ✅ All items implemented

### 1. ✅ Fix Topper Items Showing 0g
**Solution implemented:**
- Added `getBreakfastMinimum()` function with role-based minimums:
  - Base (yogurt): minimum 100g
  - Secondary (fruit): minimum 80g  
  - Topper (granola): minimum 25g, maximum 40g
- Updated breakfast portioning to enforce these minimums even when calorie budget is exceeded
- Fruit now always gets ≥80g when included (not 0g)

### 2. ✅ Smart Seasoning Logic
**Solution implemented:**
- Added `SEASONING_PAIRINGS` map with protein-specific quantities:
  - Schwartz: 8g on chicken/beef/pork
  - Paprika: 3g on chicken/pork
  - Garlic: 6g on chicken/fish/prawn
  - Soy: 15g on fish/tofu/salmon
  - Teriyaki: 20g on salmon/chicken
  - Plus more...
- Added `getSeasoningPortion()` function that finds matching proteins in the meal
- Default fallback: 10g for unmatched seasonings

### 3. ✅ Reset Day Button
- Renamed "Clear All Items" to "Reset Day" in day card dropdown
- Uses existing `clearDay` mutation

### 4. ✅ Reset Week Button  
- Added "Reset Week" button to week header (desktop) and dropdown (mobile)
- Added confirmation dialog before clearing
- New `clearWeek` mutation in useMealPlanItems.ts
- Clears all meal_plan_items for all 7 days of the week

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/autoPortioning.ts` | Added seasoning pairings, breakfast minimums, smart seasoning logic |
| `src/hooks/useMealPlanItems.ts` | Added `clearWeek` mutation |
| `src/components/mealplan/WeeklyMealPlanner.tsx` | Added Reset Week button with AlertDialog confirmation |
| `src/components/mealplan/MealDayCard.tsx` | Renamed "Clear All Items" to "Reset Day" |

---

## Testing Verification
- ✅ Reset Week button visible in header
- ✅ Reset Week shows confirmation dialog
- ✅ Reset Day shows in day card dropdown
- ✅ No console errors
