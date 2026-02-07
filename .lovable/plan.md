

# Meal Planning UX Upgrades Plan

## Overview

This plan adds four major UX improvements to the Meal Planning page:
1. A Refresh/Recalculate button with last-calculated timestamp
2. Compact daily macro summaries with progress bars
3. Eye icon pop-out for detailed day/meal breakdown
4. Edge case handling for uncalculated states and target failures

---

## Current State Analysis

| Feature | Current State |
|---------|---------------|
| Daily macros | Shown in card header but minimal (calories + protein only) |
| Recalculation | Happens on page load/data change, no manual trigger |
| Detailed view | None - must navigate to Summary tab |
| Error messages | Warnings shown in banner but no drill-down |

---

## Part 1: Refresh / Recalculate Button

### Design

Add a "Recalculate" button in the header bar next to the mode badge:

```text
+------------------------------------------------------------+
| Mon 3 Feb – Sun 9 Feb 2026    [Today]                      |
|                                                             |
| [Target Mode] [Recalculate] [Copy Previous Week] [...]     |
|                                                             |
| Last calculated: 2 mins ago                                 |
+------------------------------------------------------------+
```

### Implementation

1. **Add state for calculation tracking**
   - `lastCalculated: Date | null` - timestamp of last recalculation
   - `isRecalculating: boolean` - loading state

2. **Create `recalculateAll` mutation** in `useMealPlanItems`:
   - Iterates through all days and unlocked items
   - Applies `calculateMealPortions()` from autoPortioning.ts
   - Updates item grams in database
   - Respects locked items, fixed portions, and meal eligibility

3. **Button behavior**:
   - Triggers full recalculation for all 7 days
   - Shows spinner and "Recalculating..." during operation
   - Updates timestamp on completion
   - Toast notification on success/failure

### UI Elements

- Recalculate button with `RefreshCw` icon
- "Last calculated: X mins ago" text below header (uses relative time from date-fns)
- Loading spinner replaces icon during recalculation

---

## Part 2: Daily Macro Summary (Visible on Each Day)

### Current State

The `MealDayCard` currently shows only:
- Calories (kcal)
- Protein (g)

### Enhanced Design

Add a compact macro summary with target comparison:

```text
+----------------------------------+
| Monday                           |
| 3 Feb                            |
|                                  |
| 2,027 / 2,100 kcal      [||||||] |
| P: 148/150g C: 195/200g F: 62/65g|
|                                  |
| [Breakfast ▼]         250 kcal   |
| ...                              |
+----------------------------------+
```

### Implementation

1. **Update `MealDayCard` component**:
   - Add `MacroSummaryStrip` sub-component showing all 4 macros
   - Display actual vs target for each macro
   - Show remaining (negative) or over (positive) values
   - Add mini progress bars for visual feedback

2. **Progress bar logic**:
   - Green: 90-105% of target
   - Amber: 80-90% or 105-115%
   - Red: < 80% or > 115%

3. **Conditional rendering**:
   - In Target Mode: show "actual / target" format
   - In Manual Mode: show just actual values

### New Sub-Component

Create `DayMacroSummary.tsx`:

```typescript
interface DayMacroSummaryProps {
  dayMacros: DayMacros;
  targets: MacroTotals;
  isTargetMode: boolean;
  compact?: boolean; // For mobile vs desktop
}
```

---

## Part 3: Eye Icon for Quick Detail Pop-out

### Design

Add an eye icon on each day card that opens a detailed modal:

```text
Day Card:
+----------------------------------+
| Monday                [👁] [⋮]   |
| 3 Feb                            |
+----------------------------------+

Modal Content:
+------------------------------------------+
| Monday 3 Feb                        [X]  |
| Target: 2,100 kcal | 150g P | 200g C     |
+------------------------------------------+
|                                          |
| BREAKFAST (342 kcal)                     |
| ├ Tesco Oat Granola     45g   180 kcal   |
| ├ Greek Yoghurt         150g  120 kcal   |
| └ Blueberries           40g    42 kcal   |
|                                          |
| LUNCH (520 kcal)                         |
| ├ Chicken Breast        180g  320 kcal   |
| └ Basmati Rice          120g  200 kcal   |
|                                          |
| DINNER (680 kcal)                        |
| ...                                      |
|                                          |
| SNACKS (200 kcal)                        |
| └ Protein Bar (Fixed)   60g   200 kcal   |
|                                          |
+------------------------------------------+
| Day Totals                               |
| 1,742 / 2,100 kcal (-358)               |
| P: 142/150g (-8) | C: 180/200g (-20)    |
| F: 58/65g (-7)                           |
+------------------------------------------+
| Notes:                                   |
| • Fruit restricted to breakfast/snacks   |
| • Portions rounded to nearest 5g         |
| • ⚠ Could not hit protein target -       |
|   consider adding high-protein items     |
+------------------------------------------+
|                            [Edit Day]    |
+------------------------------------------+
```

### Implementation

1. **Create `DayDetailModal.tsx`** component:
   - Receives `MealPlan`, `DayMacros`, and `NutritionSettings`
   - Groups items by meal type
   - Shows per-item breakdown (name, grams, calories, macros)
   - Calculates and displays target comparison
   - Lists any constraints or warnings

2. **Add eye icon to `MealDayCard`**:
   - Position in card header next to the date
   - Opens modal on click

3. **Modal sections**:
   - Header with date and targets
   - Meal-by-meal breakdown with expandable items
   - Day totals with +/- indicators
   - Constraints/Notes section showing:
     - Active meal eligibility rules
     - Rounding settings
     - Any warnings from `getBalanceWarnings()`
   - Footer with Edit button (for future enhancement)

4. **Keyboard/UX**:
   - Close on ESC, click outside, or X button
   - Read-only by default
   - Scrollable content for long days

### New Files

| File | Purpose |
|------|---------|
| `src/components/mealplan/DayDetailModal.tsx` | Main modal component |
| `src/components/mealplan/MealBreakdownList.tsx` | Reusable meal items list |

---

## Part 4: Edge Cases and Error States

### Uncalculated State

When a day has items but no calculation has run:

```text
+----------------------------------+
| Monday                [👁]       |
| 3 Feb                            |
|                                  |
| [!] Not calculated yet           |
| Click Recalculate to update      |
|                                  |
+----------------------------------+
```

Implementation:
- Track `calculatedAt` timestamp per day (or use presence of calculated grams)
- If items exist but some have quantity = 0 or undefined, show prompt
- Highlight Recalculate button

### Target Unachievable

When the system cannot meet targets with available items:

```text
In DayDetailModal:
+------------------------------------------+
| ⚠ Target Issues                          |
+------------------------------------------+
| • Could not achieve protein target       |
|   (142g achieved, 150g target)           |
|   Reason: No high-protein items allowed  |
|   for dinner. Consider adding chicken,   |
|   fish, or tofu.                         |
|                                          |
| • Fat target slightly under              |
|   (58g achieved, 65g target)             |
|   Add oils, nuts, or avocado.            |
+------------------------------------------+
```

Implementation:
- Enhance `calculateMealPortions` to return detailed failure reasons
- Store reasons in warning messages with context
- Display in modal's Notes section

### Missing Nutrition Data

Products with incomplete nutrition:

```text
| ⚠ Partially calculated              |
| 2 items have missing nutrition data  |
| (treated as 0, may affect accuracy)  |
```

Implementation:
- Check for null/0 values in key nutrition fields
- Flag products in the detail modal
- Suggest updating product data in Settings

---

## File Changes Summary

| File | Action | Changes |
|------|--------|---------|
| `WeeklyMealPlanner.tsx` | Modify | Add Recalculate button, lastCalculated state, loading indicator |
| `MealDayCard.tsx` | Modify | Add eye icon, enhanced macro summary |
| `DayDetailModal.tsx` | Create | Full day breakdown modal |
| `DayMacroSummary.tsx` | Create | Compact macro display component |
| `MealBreakdownList.tsx` | Create | Reusable meal items list |
| `useMealPlanItems.ts` | Modify | Add `recalculateAll` mutation |
| `autoPortioning.ts` | Modify | Add detailed failure reasons to warnings |

---

## Technical Details

### Recalculate Mutation

Add to `useMealPlanItems.ts`:

```typescript
const recalculateAll = useMutation({
  mutationFn: async () => {
    // For each day in mealPlans
    for (const plan of mealPlans) {
      const dayDate = new Date(plan.meal_date);
      const targets = getTargetsForDate(dayDate, settings);
      
      // Get editable, unlocked items
      const editableItems = (plan.items || []).filter(
        item => item.product?.product_type === 'editable' && !item.is_locked
      );
      
      // Calculate new portions
      const result = calculateMealPortions(
        editableItems.map(i => i.product!),
        targets,
        plan.items?.filter(i => i.is_locked).map(i => ({ 
          productId: i.product_id, 
          grams: i.quantity_grams 
        })) || [],
        portioningSettings
      );
      
      // Update each item
      for (const item of editableItems) {
        const newGrams = result.items.get(item.product_id);
        if (newGrams && newGrams !== item.quantity_grams) {
          await supabase
            .from('meal_plan_items')
            .update({ quantity_grams: newGrams })
            .eq('id', item.id);
        }
      }
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
    toast.success("Recalculated all portions");
  }
});
```

### DayMacroSummary Component

```typescript
export function DayMacroSummary({ dayMacros, targets, isTargetMode, compact }: DayMacroSummaryProps) {
  const { totals, targetDiff } = dayMacros;
  
  const getStatus = (actual: number, target: number) => {
    const ratio = actual / target;
    if (ratio >= 0.98 && ratio <= 1.02) return 'success';
    if (ratio >= 0.90 && ratio <= 1.10) return 'warning';
    return 'error';
  };
  
  return (
    <div className="grid grid-cols-4 gap-1 text-xs">
      <MacroCell 
        label="Cal" 
        actual={totals.calories} 
        target={targets.calories} 
        unit="kcal"
        status={getStatus(totals.calories, targets.calories)}
        showBar={isTargetMode}
      />
      <MacroCell label="P" actual={totals.protein} target={targets.protein} ... />
      <MacroCell label="C" actual={totals.carbs} target={targets.carbs} ... />
      <MacroCell label="F" actual={totals.fat} target={targets.fat} ... />
    </div>
  );
}
```

### DayDetailModal Structure

```typescript
export function DayDetailModal({ 
  open, 
  onOpenChange, 
  plan, 
  dayMacros, 
  settings 
}: DayDetailModalProps) {
  const targets = getTargetsForDate(new Date(plan.meal_date), settings);
  const warnings = getBalanceWarnings(dayMacros, settings);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>...</DialogHeader>
        
        {/* Meal breakdown */}
        {['breakfast', 'lunch', 'dinner', 'snack'].map(mealType => (
          <MealBreakdownList 
            key={mealType}
            mealType={mealType}
            items={plan.items?.filter(i => i.meal_type === mealType) || []}
            status={plan[`${mealType}_status`]}
            mealMacros={dayMacros.meals.find(m => m.mealType === mealType)}
          />
        ))}
        
        {/* Day totals */}
        <DayTotalsSection totals={dayMacros.totals} targets={targets} />
        
        {/* Warnings and notes */}
        {warnings.length > 0 && (
          <WarningsSection warnings={warnings} settings={settings} />
        )}
      </DialogContent>
    </Dialog>
  );
}
```

---

## Expected Outcome

After implementation:

1. Users can add all products first, then click "Recalculate" to auto-portion everything
2. Each day shows a clear macro summary with target comparison and progress bars
3. Eye icon provides drill-down details without navigating away
4. Clear error messages explain when/why targets cannot be met
5. "Last calculated" timestamp provides confidence that data is current

