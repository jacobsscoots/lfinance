
# Meal Portioning Algorithm - Implementation Complete

## Recently Implemented Features

### 1. Integer Rounding + Rebalance Pass ✅
- All portion values are now whole integers (no decimals)
- After initial solve, a final rounding pass converts all values and rebalances to maintain macro targets
- Uses macro-appropriate items for rebalancing (protein sources for protein drift, etc.)

### 2. Breakfast Proportionality ✅
- Added `getYoghurtType()` helper to detect 0%/fat-free vs Greek/full-fat yoghurt
- 0% yoghurt (primary base): 200-300g range
- Greek/full-fat yoghurt (secondary): 50-150g range
- Fruit: 80-120g range
- Granola/toppers: 25-40g range

### 3. Carb Balancing Priority ✅
- When carbs exceed target, high-carb items (rice, pasta) are reduced first
- Maximum 5g reduction per item per pass to prevent overshooting
- Respects item-specific minimums (80g for staple carbs, 25g for toppers)

## File Modified
- `src/lib/autoPortioning.ts`
