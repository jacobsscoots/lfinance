
# Fix "Generate Portions" Button - Precision Solver Debug & Fix

## Problem Summary

The "Generate Portions" button appears to click but produces no visible change because:
1. The solver runs and returns `success=false` for most days (Feb 9-16)
2. Per the recent code change, failed solves are NOT persisted to the database (correct behavior)
3. The user sees no feedback that the solve failed or why

### Root Cause Identified

The weekly targets have a **calorie/macro mismatch**:
- Monday Feb 9: 1717 kcal target with 177g protein + 205g carbs
- Protein calories: 177 × 4 = 708 kcal
- Carbs calories: 205 × 4 = 820 kcal  
- Total P+C: **1528 kcal** (already 89% of budget)
- Remaining for fat: 1717 - 1528 = 189 kcal = **21g fat**

The solver is deriving fat as ~21g, but the items available (without enough high-fat sources or with constraints) may not be able to hit all three macros simultaneously within the ±1g tolerance.

## Technical Solution

### Step 1: Add User Feedback for Failed Solves

Currently when `recalculateAll` fails, the user just sees items stay at 0g with no explanation. Need to:

1. Show a toast with the failure reason when solves fail
2. Display per-day warnings explaining why each day failed
3. Add a "solver status" indicator to each day card

**File: `src/hooks/useMealPlanItems.ts`**

Modify `recalculateAll.onSuccess` to report failures:

```typescript
onSuccess: (result) => {
  queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
  setLastCalculated(new Date());
  
  if (result.daysSucceeded === result.totalDays) {
    toast.success(`Generated portions for all ${result.daysSucceeded} days`);
  } else if (result.daysSucceeded > 0) {
    toast.warning(
      `Generated portions for ${result.daysSucceeded}/${result.totalDays} days. ` +
      `${result.totalDays - result.daysSucceeded} days could not be solved within ±1g tolerance.`
    );
  } else {
    toast.error(
      `No days could be solved. Check that your macro targets are achievable with the selected items.`
    );
  }
}
```

### Step 2: Collect and Return Day-Specific Warnings

Modify `recalculateAll` to collect warnings per day:

```typescript
const dayWarnings: { date: string; warnings: string[] }[] = [];

for (const plan of mealPlans) {
  // ... existing solve logic ...
  
  if (!result.success) {
    dayWarnings.push({ 
      date: plan.meal_date, 
      warnings: result.warnings 
    });
  }
}

return { 
  updated: totalUpdated, 
  daysSucceeded: successCount, 
  totalDays: mealPlans.length,
  dayWarnings 
};
```

### Step 3: Improve Solver Precision for Edge Cases

The solver may be failing because it's hitting constraints before achieving ±1g precision. Review and fix:

**File: `src/lib/autoPortioning.ts`**

1. **Increase precision loop budget** from 50 to 100 iterations
2. **Add fallback adjustment strategy** when primary sources are exhausted
3. **Ensure the solver recalculates totals after EVERY adjustment** (currently may skip recalc in some paths)
4. **Fix the "no editable items" early return** - currently returns success=true when there are no editable items even if targets aren't met

### Step 4: Fix Items with 0g Quantities

For days Feb 9-16, the items currently have `quantity_grams: 0`. This happened because:
1. Previous generate attempts failed
2. Items were added with 0g default

Need to ensure the UI correctly shows these as "uncalculated" rather than calculated-but-zero.

**File: `src/components/mealplan/MealDayCard.tsx`**

The `hasUncalculatedItems` check is already present:
```typescript
const hasUncalculatedItems = items.some(item => 
  item.quantity_grams === 0 && item.product?.product_type === "editable"
);
```

This is showing the "Add items → click Generate" message correctly.

### Step 5: Database Cleanup for Testing

Clear the 0g items and regenerate with improved solver:

```sql
-- Reset all editable items in date range to allow fresh regeneration
UPDATE meal_plan_items mpi
SET quantity_grams = 0
FROM meal_plans mp
WHERE mpi.meal_plan_id = mp.id
  AND mp.meal_date BETWEEN '2026-02-08' AND '2026-02-16'
  AND mpi.is_locked = false
  AND EXISTS (
    SELECT 1 FROM products p 
    WHERE p.id = mpi.product_id 
    AND p.product_type = 'editable'
  );
```

### Step 6: Add Debug Logging Toggle

Enable localStorage debug flag to show solver internals:

**File: `src/lib/portioningDebug.ts`**

Ensure debug logging outputs to console when `localStorage.debug_portioning = '1'`:

```typescript
export function storePortioningSolverDebug(payload: PortioningSolverDebugPayload) {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('debug_portioning') === '1') {
    console.groupCollapsed(`[Portioning Debug] ${payload.mealDate}`);
    console.log('Targets:', payload.targets);
    console.log('Achieved:', payload.achieved);
    console.log('Success:', payload.warnings.length === 0);
    console.log('Warnings:', payload.warnings);
    console.table(payload.items.map(i => ({
      name: i.name,
      meal: i.mealType,
      grams: i.grams,
      cal: Math.round(i.contribution.calories),
      pro: Math.round(i.contribution.protein),
      carb: Math.round(i.contribution.carbs),
      fat: Math.round(i.contribution.fat)
    })));
    console.groupEnd();
  }
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useMealPlanItems.ts` | Add failure feedback in onSuccess, collect day warnings |
| `src/lib/autoPortioning.ts` | Increase iteration budget, fix edge cases, improve precision |
| `src/lib/portioningDebug.ts` | Ensure debug logging works when flag is set |

## Testing Protocol

1. Enable debug: `localStorage.setItem('debug_portioning', '1')`
2. Navigate to Feb 8-16 week
3. Click "Generate Portions"
4. Observe console output for each day's solve attempt
5. Verify toast message indicates which days failed and why
6. For successful days, verify macros are within ±1g of targets

## Definition of Done

- [ ] Generate Portions button shows clear feedback (success/failure count)
- [ ] Failed days explain why they couldn't be solved
- [ ] Days that CAN be solved hit ±1g macro precision
- [ ] Debug logging shows solver internals when enabled
- [ ] No silent failures - every outcome is communicated to user
