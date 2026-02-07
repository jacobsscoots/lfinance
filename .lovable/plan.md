
# Plan: Multi-Target Precision Solver for Zero-Tolerance Macro Matching

## Problem Analysis

The current algorithm has structural flaws causing macro drift:

1. **Sequential adjustment** - Fixes protein first, then tries to fix calories separately, which disrupts the balance
2. **Single-macro focus** - Each phase only considers one macro at a time
3. **No simultaneous constraints** - Doesn't solve protein + carbs + fat + calories together

Looking at the MyFitnessPal reference, realistic portions are:
- Breakfast: 290g yogurt, 130g fruit, 40g granola (~620 kcal, 31g protein)
- Lunch: 550g meal prep pack (~868 kcal, 93g protein)
- Dinner: 170g chicken, 210g rice, veg, seasoning (~859 kcal, 79g protein)

The key insight: **macros are mathematically linked** - every gram of food contributes to ALL macros simultaneously. We need a solver that respects this.

---

## Solution: Iterative Multi-Target Optimization

Replace the current sequential approach with a **gradient descent / iterative refinement** algorithm that:

1. Treats ALL targets (calories, protein, carbs, fat) as simultaneous constraints
2. Uses weighted error minimization to balance all macros together
3. Iterates until error across ALL dimensions is below tolerance
4. Applies realistic portion constraints (min/max grams, breakfast composition rules)

### Algorithm Overview

```
1. Calculate fixed contributions (locked/fixed items)
2. Calculate remaining targets for each macro
3. Initialize portions based on role (protein sources, carbs, etc.)
4. LOOP until convergence (all macros within 0.5g/1kcal):
   a. Calculate current error for each macro
   b. Compute weighted gradient for each adjustable item
   c. Adjust grams proportionally to reduce total error
   d. Apply constraints (min/max, breakfast caps)
5. Final polish pass to eliminate any remaining drift
```

### Key Improvements

| Current Approach | New Approach |
|------------------|--------------|
| Fix protein, then fix calories | Solve all macros simultaneously |
| Adjust one item at a time | Distribute adjustments across items |
| Ignores carb/fat targets | Considers all 4 dimensions |
| Single pass | Iterates until exact match |

---

## Technical Implementation

### File: `src/lib/autoPortioning.ts`

#### 1. New Multi-Macro Error Function
```typescript
interface MacroError {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  totalWeighted: number;
}

function calculateMacroError(achieved: MacroTotals, targets: MacroTotals): MacroError {
  // Weight priorities: Calories 1.0, Protein 1.5, Carbs 0.8, Fat 0.8
  const calError = targets.calories - achieved.calories;
  const proError = targets.protein - achieved.protein;
  const carbError = targets.carbs - achieved.carbs;
  const fatError = targets.fat - achieved.fat;
  
  return {
    calories: calError,
    protein: proError,
    carbs: carbError,
    fat: fatError,
    totalWeighted: Math.abs(calError) + 1.5 * Math.abs(proError) + 
                   0.8 * Math.abs(carbError) + 0.8 * Math.abs(fatError)
  };
}
```

#### 2. Iterative Solver with Simultaneous Constraints
```typescript
function solveSimultaneous(
  items: EditableItem[],
  targets: MacroTotals,
  settings: PortioningSettings
): Map<string, number> {
  const n = items.length;
  const grams = new Array(n).fill(50); // Initial guess
  
  const MAX_ITERATIONS = 100;
  const TOLERANCE = 0.5; // Within 0.5g/kcal of target
  
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const current = sumMacros(items, grams);
    const error = calculateMacroError(current, targets);
    
    // Check convergence
    if (Math.abs(error.calories) < 1 && 
        Math.abs(error.protein) < TOLERANCE &&
        Math.abs(error.carbs) < TOLERANCE &&
        Math.abs(error.fat) < TOLERANCE) {
      break;
    }
    
    // Compute adjustment for each item based on its macro contribution
    for (let i = 0; i < n; i++) {
      const item = items[i];
      
      // Calculate this item's "influence" on each macro
      const calInfluence = item.caloriesPer100g / 100;
      const proInfluence = item.proteinPer100g / 100;
      const carbInfluence = item.carbsPer100g / 100;
      const fatInfluence = item.fatPer100g / 100;
      
      // Weighted gradient: how much should this item change?
      const gradient = 
        error.calories * calInfluence * 1.0 +
        error.protein * proInfluence * 1.5 +
        error.carbs * carbInfluence * 0.8 +
        error.fat * fatInfluence * 0.8;
      
      // Apply damped adjustment (prevent oscillation)
      const learningRate = 0.3;
      grams[i] += gradient * learningRate;
      grams[i] = Math.max(settings.minGrams, Math.min(settings.maxGrams, grams[i]));
    }
  }
  
  // Final precision pass: fine-tune to hit exact targets
  return fineTuneToExact(items, grams, targets, settings);
}
```

#### 3. Breakfast Composition Rules (Preserved)
- **Yogurt (base)**: ~55% of breakfast calories, sized to hit protein
- **Fruit (secondary)**: ~30% of breakfast calories
- **Granola (topper)**: Max 40g regardless (capped)

These rules run BEFORE the multi-macro solver to establish reasonable starting portions.

#### 4. Final Precision Pass
```typescript
function fineTuneToExact(
  items: EditableItem[],
  grams: number[],
  targets: MacroTotals,
  settings: PortioningSettings
): Map<string, number> {
  // After iterative solve, make micro-adjustments to hit EXACT targets
  // Prioritize items by their dominant macro contribution
  
  // 1. Adjust highest-protein item to hit protein exactly
  // 2. Adjust highest-carb item to hit carbs exactly
  // 3. Adjust highest-fat item to hit fat exactly
  // 4. Micro-adjust any item to hit calories exactly
  
  // Each adjustment is tiny (0.1-2g) to preserve overall balance
}
```

---

## Changes Required

| File | Change |
|------|--------|
| `src/lib/autoPortioning.ts` | Replace `solveExactPortions` with new simultaneous solver |
| `src/lib/autoPortioning.ts` | Update `calculateDayPortions` to use new solver |
| `src/lib/autoPortioning.ts` | Add `calculateMacroError` and `fineTuneToExact` functions |

---

## Testing Plan

After implementation:
1. Open `/meal-plan` and add items to a day
2. Click "Generate Portions"
3. Verify ALL macros show green (within tolerance):
   - Calories: exactly 2302 (or user's target)
   - Protein: exactly 149g (or target)
   - Carbs: exactly 259g (or target)
   - Fat: exactly 51g (or target)
4. Check alert bar shows no warnings (no "under/over target" messages)

---

## Expected Outcome

The final day totals will match targets with zero tolerance:
- No more "22g under protein" warnings
- No calorie overshoot from carb/fat compensation
- Realistic gram portions (similar to the MyFitnessPal reference ranges)
- All progress bars show green (success state)
