
# Plan: Integer Rounding + Breakfast Proportionality + Carb Balancing

## Problem Analysis

Based on the screenshot showing Monday 2 February, there are three issues to fix:

1. **Decimal portions**: Rice shows "167g", which is fine, but other calculations produce decimals (e.g., 198.6g, 211.1g)
2. **Unrealistic breakfast yoghurt totals**: 0% yoghurt at 500g + Greek yoghurt at 198.6g = 698.6g total - unrealistic
3. **Carbs over target**: 213g vs 220g target (showing -7g, meaning 7g UNDER target in this screenshot, but the user reports creeping over in practice)

---

## Solution Overview

### Change 1: Integer Rounding with Rebalance Pass

All generated gram values must be whole integers. After the initial solve, add a final "rounding + rebalance" pass:

1. Round each item to nearest integer using smart rounding (prefer rounding down for items already near max)
2. Calculate the macro drift caused by rounding
3. Rebalance using the most appropriate items:
   - Protein sources for protein drift
   - Carb sources for carb drift
   - Fat sources for fat drift
   - Calorie-dense items for calorie drift
4. Keep toppers (fruit/granola) within min/max ranges - never round to 0 unless removed

### Change 2: Breakfast Proportionality Rules

Update the breakfast logic to establish a hierarchy for yoghurt types:

| Item Type | Role | Target Range | Priority |
|-----------|------|--------------|----------|
| 0% Fat Yoghurt | Primary base | 200-300g | Size first for protein |
| Full-fat Greek Yoghurt | Secondary base | 50-150g | Add fat/creaminess |
| Fruit | Secondary | 80-120g | Carbs + volume |
| Granola | Topper | 25-40g | Texture + carbs |

Detection logic:
- "0%" or "fat free" in name = primary base
- "greek" without "0%" = secondary base (higher fat)

### Change 3: Carb Balancing Priority

When carbs exceed target, reduce carb-heavy items first:
1. Identify high-carb items (rice, pasta, bread, granola)
2. Reduce their portions proportionally to bring carbs in line
3. Rebalance protein/fat items to maintain calorie target
4. Run validation to confirm all targets met

---

## Technical Implementation

### File: `src/lib/autoPortioning.ts`

#### A. Add Yoghurt Type Detection (new helper function)

```typescript
function getYoghurtType(product: Product): "primary" | "secondary" | "none" {
  const name = product.name.toLowerCase();
  if (!name.includes("yogurt") && !name.includes("yoghurt")) return "none";
  
  // 0% or fat-free yoghurt = primary base
  if (name.includes("0%") || name.includes("fat free") || name.includes("fat-free")) {
    return "primary";
  }
  
  // Greek/full-fat = secondary
  if (name.includes("greek") || name.includes("natural")) {
    return "secondary";
  }
  
  return "primary"; // Default yoghurt to primary
}
```

#### B. Update Breakfast Logic in `solveSimultaneous()` (lines 348-411)

Replace current breakfast handling with proportional yoghurt logic:

```typescript
if (mealType === "breakfast") {
  // Separate yoghurts into primary (0%) and secondary (Greek)
  const primaryYoghurt: number[] = [];
  const secondaryYoghurt: number[] = [];
  
  breakfastBase.forEach(idx => {
    const yogType = getYoghurtType(items[idx].product);
    if (yogType === "primary") primaryYoghurt.push(idx);
    else if (yogType === "secondary") secondaryYoghurt.push(idx);
    else primaryYoghurt.push(idx); // Default
  });
  
  // Step 1: Set topper (granola) to 30g
  breakfastTopper.forEach(idx => { grams[idx] = 30; });
  
  // Step 2: Set fruit to 80-100g
  breakfastSecondary.forEach(idx => { grams[idx] = 90; });
  
  // Step 3: Size primary yoghurt (0%) for protein - target 200-300g
  if (primaryYoghurt.length > 0) {
    const proteinNeeded = adjustedTargets.protein * 0.7;
    const totalProtPer100g = primaryYoghurt.reduce((s, i) => s + items[i].proteinPer100g, 0);
    const gramsNeeded = totalProtPer100g > 0 ? (proteinNeeded / totalProtPer100g) * 100 : 250;
    primaryYoghurt.forEach(idx => {
      grams[idx] = Math.max(200, Math.min(300, gramsNeeded));
    });
  }
  
  // Step 4: Size secondary yoghurt (Greek) smaller - target 50-150g
  if (secondaryYoghurt.length > 0) {
    secondaryYoghurt.forEach(idx => {
      // Use secondary yoghurt for fat contribution, keep small
      grams[idx] = Math.max(50, Math.min(150, 100));
    });
  }
  
  // Step 5: Fine-tune toppers/fruit to hit remaining macros
  // ...existing fine-tuning logic...
}
```

#### C. Add Rounding + Rebalance Pass (after line 922, before final validation)

```typescript
// === ROUNDING + REBALANCE PASS: Convert all to whole integers ===
const roundingPass = () => {
  // Step 1: Round all items to nearest integer
  const roundingDrift = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  
  allEditables.forEach(({ item }) => {
    const currentGrams = allItemGrams.get(item.itemId) || 0;
    const roundedGrams = Math.round(currentGrams);
    
    // Respect min/max constraints
    const minGrams = mealType === "breakfast" && getBreakfastRole(item.product) === "topper" 
      ? 25 : settings.minGrams;
    const maxGrams = getMaxPortion(item.product, settings);
    
    const finalGrams = Math.max(minGrams, Math.min(maxGrams, roundedGrams));
    
    // Calculate drift caused by rounding
    const macrosBefore = calculateMacrosForGrams(item.product, currentGrams);
    const macrosAfter = calculateMacrosForGrams(item.product, finalGrams);
    
    roundingDrift.calories += macrosAfter.calories - macrosBefore.calories;
    roundingDrift.protein += macrosAfter.protein - macrosBefore.protein;
    roundingDrift.carbs += macrosAfter.carbs - macrosBefore.carbs;
    roundingDrift.fat += macrosAfter.fat - macrosBefore.fat;
    
    allItemGrams.set(item.itemId, finalGrams);
  });
  
  // Step 2: Rebalance to compensate for drift
  // Use most appropriate item for each macro
  if (Math.abs(roundingDrift.protein) >= 0.5) {
    // Adjust protein source by 1g to compensate
    const proteinSource = allEditables
      .filter(e => isHighProteinSource(e.item.product))
      .sort((a, b) => b.item.proteinPer100g - a.item.proteinPer100g)[0];
    if (proteinSource) {
      const current = allItemGrams.get(proteinSource.item.itemId) || 0;
      const adjustment = roundingDrift.protein > 0 ? -1 : 1;
      allItemGrams.set(proteinSource.item.itemId, Math.max(10, current + adjustment));
    }
  }
  
  // Similar for carbs and fat...
};

roundingPass();
```

#### D. Carb Reduction Priority (update global adjustment pass)

Modify the carb adjustment logic (lines 859-876) to prioritize reduction:

```typescript
// When carbs are OVER target, reduce high-carb items first
if (carbErrAfter < -0.5) {
  // Over target - reduce primary carb sources
  const carbSources = allEditables
    .filter(e => e.item.carbsPer100g > 20)
    .sort((a, b) => b.item.carbsPer100g - a.item.carbsPer100g);
  
  if (carbSources.length > 0) {
    for (const source of carbSources) {
      if (carbErrAfter >= -0.5) break;
      
      const current = allItemGrams.get(source.item.itemId) || 0;
      const reduction = Math.min(10, current - settings.minGrams);
      if (reduction > 0) {
        allItemGrams.set(source.item.itemId, current - reduction);
        carbErrAfter += (reduction / 100) * source.item.carbsPer100g;
      }
    }
  }
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/autoPortioning.ts` | Add `getYoghurtType()` helper; Update breakfast logic for proportional yoghurt; Add integer rounding + rebalance pass; Update carb adjustment to prioritize reduction |

---

## Expected Behavior After Fix

| Issue | Before | After |
|-------|--------|-------|
| Decimal portions | 198.6g, 211.1g, 167g | 199g, 211g, 167g (integers) |
| Yoghurt totals | 500g + 198g = 698g | 250g + 100g = 350g |
| Carbs over target | 213g vs 220g (drift) | Exactly on target |
| Topper ranges | Could round to 0 | Clamped to 25-40g |

---

## Testing Checklist

After implementation:
1. Generate portions for Monday breakfast - verify 0% yoghurt is ~250g and Greek is ~100g
2. Check all portion values are whole integers (no decimals)
3. Confirm day totals show "on target" for all macros (no -7g or +7g warnings)
4. Test that locked items are still preserved during generation
5. Verify granola stays within 25-40g range
