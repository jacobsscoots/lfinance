
# Plan: Fix Over-Target Portioning

## Problem Analysis

The portioning algorithm is exceeding targets because the **global day-level fine-tuning phase** (lines 816-902) doesn't respect the constraints established in the meal-level phase:

1. **Sauces/seasonings are being scaled** - While `solveSimultaneous()` correctly caps seasonings at small portions (8-15g), the global phase includes them in `allEditables` and may increase their portions during calorie adjustments
2. **No item type filtering** - The global adjustment passes select the "best" item for each macro without excluding sauces, breakfast toppers, or other constrained items
3. **Compounding adjustments** - Sequential fixes for protein → carbs → fat → calories can each add grams that push previous fixes over target

## Root Cause

In lines 806-812, all editable items are added to `allEditables` without filtering:

```typescript
// Current (broken) - includes everything
const allEditables: { item: EditableItem; grams: number }[] = [];
activeMeals.forEach(mealType => {
  editableByMeal[mealType].forEach(item => {
    const currentGrams = allItemGrams.get(item.itemId) || 0;
    allEditables.push({ item, grams: currentGrams });
  });
});
```

Then in the adjustment passes (lines 830-901), items are selected based on macro content but without respecting portion constraints.

## Solution

### 1. Filter Constrained Items from Global Adjustments

Add exclusion logic when building `allEditables`:

```typescript
const allEditables: { item: EditableItem; grams: number }[] = [];
activeMeals.forEach(mealType => {
  editableByMeal[mealType].forEach(item => {
    // Skip sauces/seasonings - they have fixed smart portions
    if (isSauceOrSeasoning(item.product)) return;
    
    // Skip breakfast toppers - they have fixed 25-40g range
    if (mealType === "breakfast" && getBreakfastRole(item.product) === "topper") return;
    
    const currentGrams = allItemGrams.get(item.itemId) || 0;
    allEditables.push({ item, grams: currentGrams });
  });
});
```

### 2. Enforce Max Portion Constraints in Global Adjustments

When adjusting any item, respect its category-specific max:

```typescript
// Before (no constraint):
const newGrams = Math.max(settings.minGrams, Math.min(settings.maxGrams, currentGrams + adjustment));

// After (respects item type):
const maxForItem = getMaxPortion(best.item.product, settings);
const newGrams = Math.max(settings.minGrams, Math.min(maxForItem, currentGrams + adjustment));
```

### 3. Add Direction-Aware Adjustment Logic

Prevent overshooting by capping adjustments to only what's needed:

```typescript
// For protein adjustment
if (Math.abs(proErr) >= 0.3) {
  // Only adjust if we're UNDER target, not if we're already over
  if (proErr > 0) {
    // ... increase protein item
  }
}
```

### 4. Final Validation Pass

Add a final clamp pass after all adjustments to ensure no item exceeds its max:

```typescript
// After all global passes, validate constraints
allEditables.forEach(({ item }) => {
  const currentGrams = allItemGrams.get(item.itemId) || 0;
  const maxForItem = getMaxPortion(item.product, settings);
  if (currentGrams > maxForItem) {
    allItemGrams.set(item.itemId, maxForItem);
  }
});
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/autoPortioning.ts` | Filter constrained items from global adjustments; enforce max portions per item type; add direction-aware adjustment logic; add final validation pass |

## Technical Details

### Affected Code Sections

| Lines | Section | Change |
|-------|---------|--------|
| 806-812 | `allEditables` construction | Filter out sauces and toppers |
| 830-842 | Protein adjustment | Use `getMaxPortion()` constraint |
| 848-862 | Carb adjustment | Use `getMaxPortion()` constraint |
| 868-881 | Fat adjustment | Use `getMaxPortion()` constraint |
| 886-901 | Calorie adjustment | Use `getMaxPortion()` constraint + direction check |

### Expected Behavior After Fix

1. Seasonings stay at smart-paired portions (8-15g) regardless of calorie needs
2. Breakfast toppers stay within 25-40g range
3. Main meal items (protein, carbs) absorb the macro adjustments
4. Day totals hit targets exactly without overshooting

## Testing

After implementation:
1. Generate portions for Saturday dinner with chicken + rice + seasoning
2. Verify seasoning stays at ~8g and rice is sized appropriately
3. Confirm day macros match targets exactly (green bars, no warnings)
4. Test with locked items to ensure they're preserved
5. Generate portions for whole week day by day and test the functionality of the proper portions is working
6. Update it so that if the user needs to, the auto generator can combine the greek and 0% greek yoghurt during breakfast instead of using 500g of one and 200g of the other
