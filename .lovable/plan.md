# Plan: Fix Over-Target Portioning

## ✅ IMPLEMENTED

Changes made to `src/lib/autoPortioning.ts`:

1. **Filtered constrained items from global adjustments** (lines 806-820)
   - Sauces/seasonings excluded from `allEditables`
   - Breakfast toppers excluded from `allEditables`
   - These items keep their smart-paired portions without inflation

2. **Enforced max portion constraints** (all adjustment passes)
   - Replaced `settings.maxGrams` with `getMaxPortion(item.product, settings)`
   - Protein, carb, fat, and calorie adjustments all respect item-specific limits

3. **Direction-aware adjustment logic** (all passes)
   - Adjustments now properly increase/decrease based on whether under/over target
   - Prevents compounding overshoots

4. **Final validation pass** (lines 908-923)
   - Clamps all items to their max portions after global adjustments
   - Validates both editable items and excluded sauces/toppers

## Testing Required

- [ ] Generate portions for Saturday dinner with chicken + rice + seasoning
- [ ] Verify seasoning stays at ~8g and rice is sized appropriately  
- [ ] Confirm day macros match targets exactly (green bars, no warnings)
- [ ] Test with locked items to ensure they're preserved
- [ ] Generate portions for whole week day by day
- [ ] Test yogurt combining for breakfast if needed
