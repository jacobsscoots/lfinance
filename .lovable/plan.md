

# Plan: Fix Macro Precision After Integer Rounding

## Problem Analysis

The screenshot shows **severe under-target drift**:
| Macro | Target | Actual | Drift |
|-------|--------|--------|-------|
| Calories | 1952 | 1806 | -146 |
| Protein | 171g | 158g | **-13g** |
| Carbs | 220g | 196g | **-24g** |
| Fat | 43g | 39g | **-4g** |

**Root cause**: The integer rounding pass (lines 997-1111) converts decimals to whole numbers but the rebalance logic only adjusts by **±1g per macro**, which is completely inadequate when the drift can be 13-24g.

## Technical Root Cause

Looking at the rounding rebalance logic (lines 1061-1110):
```typescript
// Current: Only adjusts by 1g regardless of drift magnitude
const adjustment = roundingDrift.protein > 0 ? -1 : 1;
```

This only moves items by 1g, but if rounding caused 13g protein drift, a 1g adjustment won't fix it. The logic needs to:
1. Calculate the **exact** adjustment needed to compensate for drift
2. Apply multi-gram adjustments (not just ±1g)
3. Run **iteratively** until targets are hit within ±1g tolerance

## Solution

### 1. Replace Static Rebalance with Iterative Precision Loop

After the initial rounding, add a **post-rounding precision loop** that runs up to 30 iterations, adjusting the most appropriate items to bring each macro back to target:

```typescript
// After rounding, run precision iterations until within ±1g
for (let iteration = 0; iteration < 30; iteration++) {
  const current = calculateTotalMacros(...);
  const proErr = dailyTargets.protein - current.protein;
  const carbErr = dailyTargets.carbs - current.carbs;
  const fatErr = dailyTargets.fat - current.fat;
  
  // Exit if all within ±1g
  if (Math.abs(proErr) <= 1 && Math.abs(carbErr) <= 1 && Math.abs(fatErr) <= 1) break;
  
  // Adjust protein source by EXACT grams needed (not just 1g)
  if (Math.abs(proErr) > 1) {
    const source = proteinSources[0];
    const gramsNeeded = (proErr / source.item.proteinPer100g) * 100;
    allItemGrams.set(source.item.itemId, currentGrams + gramsNeeded);
  }
  // ... same for carbs and fat
}
```

### 2. Calculate Exact Adjustments Instead of ±1g

Change the rebalance adjustments from static ±1g to calculated amounts:
```typescript
// Before (broken): Only adjusts by 1g
const adjustment = roundingDrift.protein > 0 ? -1 : 1;

// After (correct): Calculate exact grams needed
const gramsNeeded = (proteinDrift / best.item.proteinPer100g) * 100;
const adjustment = Math.round(gramsNeeded); // Round to integer
```

### 3. Add Final Integer Enforcement

After precision loop, ensure all values are still integers:
```typescript
allItemGrams.forEach((grams, itemId) => {
  allItemGrams.set(itemId, Math.round(grams));
});
```

### 4. Priority Order for Adjustments

When multiple macros need fixing:
1. **Protein first** - Use high-protein sources (chicken, yogurt)
2. **Fat second** - Use high-fat sources (yogurt, oils)
3. **Carbs third** - Use high-carb sources (rice, pasta, fruit)
4. **Calories last** - Use calorie-dense items that minimally affect macros

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/autoPortioning.ts` | Replace single-pass rounding rebalance with iterative precision loop; calculate exact gram adjustments; enforce ±1g tolerance on all macros |

## Specific Code Changes

### Lines 1052-1111: Replace Single-Pass with Iterative Loop

Current broken logic:
```typescript
// Step 2: Rebalance using macro-appropriate items (only ±1g)
if (Math.abs(roundingDrift.protein) >= 0.5) {
  const adjustment = roundingDrift.protein > 0 ? -1 : 1; // ← PROBLEM
  // ...
}
```

New precision logic:
```typescript
// Step 2: Iterative precision loop - run until ALL macros within ±1g
for (let rebalancePass = 0; rebalancePass < 30; rebalancePass++) {
  const current = calculateTotalMacros(allItemGrams, editableByMeal, fixedContribution, activeMeals);
  
  const proErr = dailyTargets.protein - current.protein;
  const carbErr = dailyTargets.carbs - current.carbs;
  const fatErr = dailyTargets.fat - current.fat;
  const calErr = dailyTargets.calories - current.calories;
  
  // Exit when all macros within ±1g (and calories within ±5)
  if (Math.abs(proErr) <= 1 && Math.abs(carbErr) <= 1 && 
      Math.abs(fatErr) <= 1 && Math.abs(calErr) <= 5) {
    break;
  }
  
  // Adjust protein (calculate EXACT grams, not ±1g)
  if (Math.abs(proErr) > 1 && proteinSources.length > 0) {
    const best = proteinSources[0];
    const currentGrams = allItemGrams.get(best.item.itemId) || 0;
    const gramsNeeded = (proErr / best.item.proteinPer100g) * 100;
    const newGrams = Math.round(currentGrams + gramsNeeded);
    // Clamp to valid range
    const clamped = Math.max(minForItem, Math.min(maxForItem, newGrams));
    allItemGrams.set(best.item.itemId, clamped);
  }
  
  // Similar for carbs, fat, calories...
}
```

## Expected Results After Fix

| Macro | Target | After Fix | Tolerance |
|-------|--------|-----------|-----------|
| Protein | 171g | 170-172g | ±1g ✓ |
| Carbs | 220g | 219-221g | ±1g ✓ |
| Fat | 43g | 42-44g | ±1g ✓ |
| Calories | 1952 | ~1952 | ±5 ✓ |

## Testing Checklist

1. Generate portions for Monday - verify all macros are within ±1g of targets
2. All portion values must be whole integers (no decimals)
3. Locked items must preserve their quantities
4. Breakfast yogurt proportions stay within realistic ranges (200-300g 0%, 50-150g Greek)
5. Seasonings stay at smart-paired portions (8-15g)
6. Alert bar shows green "on target" indicators

Plan: Fix Integer Rounding Without Breaking Precision + Enforce Meal Structure
Goals (must all hold true)

All portions are whole integers (grams) — no decimals anywhere.

Daily totals land within tolerance:

Protein / Carbs / Fat: ±1g

Calories: within ±5 kcal (or use a stricter value if your UI requires it, but pick one and enforce it consistently)

Calories are split evenly across meals (breakfast/lunch/dinner):

Each meal should be ~1/3 of daily calories with a small tolerance (e.g., ±10 kcal per meal) while still respecting daily macro tolerances.

Each meal must be “plate-proportional” (not just daily totals):

Lunch/dinner must include protein + carb + veg if those items exist in the user’s selection.

Breakfast must treat 0% yoghurt as base, Greek full-fat as secondary, and fruit/granola as toppers.

Topper items must never become 0g if selected:

If fruit/granola/other toppers are included, enforce a non-zero minimum (e.g., fruit ≥ 50g, granola ≥ 10g), only allowing 0g if the user removes the item.

Seasoning pairing must make sense:

Seasoning choices should match the main protein (e.g., chicken gets realistic seasoning combos) and use sensible gram ranges (e.g., 8–15g total seasoning) without breaking macro precision.

Add Reset Day and Reset Week buttons:

Reset Day clears that day’s selected items, generated grams, totals, alerts, and grocery outputs for that day only (settings remain).

Reset Week clears the entire week plan + derived outputs (settings remain).

Problem Analysis (existing issue)

The screenshot shows large under-target drift after the integer rounding pass:

Calories: -146

Protein: -13g

Carbs: -24g

Fat: -4g

Root cause: current rounding-rebalance only adjusts by ±1g, which cannot correct multi-gram drift introduced by rounding/clamping.

Solution Overview (keep existing architecture, fix the weak parts)
1) Two-phase approach: Solve → Round → Precision Rebalance (iterative)

Keep your current solver, but replace the “single-pass ±1g” rebalance with an iterative precision loop that can correct drift magnitude.

Important stability rules (to avoid ping-pong):

Apply small bounded step sizes per iteration (e.g., max ±10g to ±25g change per item per loop)

Prefer items by macro efficiency (protein source that minimally changes carbs/fat when fixing protein, etc.)

If clamping blocks progress, switch to the next best adjustable item

2) Add meal-level constraints before daily rebalance

Right now you’re solving “daily total only”. Add enforcement for:

Per-meal calorie split

Per-meal composition rules (plate ratios)
This should happen before final daily precision loop, because meal constraints can shift totals.

Recommended flow:

Generate initial grams (continuous) for each meal

Enforce meal structure rules (breakfast base/secondary/topper, lunch/dinner plate mix)

Round to integers (smart rounding)

Run Meal Balancer loop (bring each meal close to its calorie share without breaking macro tolerances)

Run Daily Precision loop (final reconcile to hit macros ±1g)

Detailed Implementation
A) Replace static rebalance with iterative precision loops
A1) Meal Balancer Loop (new)

After integer rounding, run up to ~30 iterations to nudge each meal toward its calorie share.

Compute:

mealCalTarget = dailyTargetCalories / numberOfActiveMeals

mealCalErr = mealCalTarget - currentMealCalories

Adjust within meal using the most appropriate knobs:

If meal calories low: increase carb/protein grams first, then fat if needed

If meal calories high: reduce carb first, then fat, then protein

Do not violate:

topper minimums

breakfast proportions

locked items

item min/max clamps

Stop when each meal within ±10 kcal (or chosen tolerance) OR no progress is possible.

A2) Daily Precision Loop (improved from original plan)

Then run up to ~50 iterations to correct daily macro errors to within ±1g.

Key points:

Calculate proErr, carbErr, fatErr, calErr

If all macros within ±1g and calories within tolerance → stop

Adjust by calculated grams but cap step size (e.g., ±25g max per iteration) to prevent overshooting

Prioritise adjustment order based on greatest error magnitude, but do not let fixing one macro blow another outside ±1g

Item selection logic:

Protein fix: prefer items with highest protein/100g and lowest carbs+fat impact (e.g., chicken, 0% yoghurt)

Carb fix: prefer items high carb/100g with low fat (e.g., rice, fruit)

Fat fix: prefer items high fat/100g with minimal carbs/protein impact (e.g., oils, full-fat yoghurt)

Calories fix (only if macros already within tolerance): use calorie-dense items that least disturb macro tolerances

Anti-oscillation:

If an adjustment makes the opposite direction worse repeatedly, reduce step size or switch items.

Track “no progress” for N iterations → break and trigger fallback.

B) Hard rules: breakfast + toppers

Enforce these during the meal structure phase and prevent later loops from violating them.

Breakfast rules:

0% yoghurt is the base: target range ~200–300g

Full-fat Greek is secondary: target range ~50–150g

Fruit topper must be non-zero if included: e.g., ≥50g

Granola topper must be non-zero if included: e.g., ≥10g

The loops can adjust within these bounds, but never set topper to 0 unless removed.

C) Plate-proportional lunch/dinner

If the user selected protein/carb/veg items for lunch/dinner:

each meal must include non-zero grams for those categories

veg grams can be stable and used as a constraint (veg is usually low-cal impact, but it must exist visually)

D) Seasoning pairing rules

Seasonings should:

be chosen from a “pairing map” (e.g., chicken ↔ garlic/paprika/peri-peri etc.)

have default grams in a realistic band (8–15g total seasoning)

be treated as “low macro impact” but still counted if your nutrition data includes it

never be used as a knob to solve macro drift (unless you explicitly want that)

E) Reset buttons

Add:

Reset Day (per day card):

clears selected items + generated grams + alerts + grocery outputs for that day

keeps global settings and saved foods

Reset Week:

clears all 7 days + derived totals + grocery list

keeps settings/saved foods

Files to Modify

src/lib/autoPortioning.ts

replace rounding rebalance with: Meal Balancer Loop + Daily Precision Loop

add topper minimum enforcement and breakfast bounds

add per-meal calorie target enforcement + plate-proportional rules

UI components for planner

add Reset Day and Reset Week actions + state clearing

Fallback Behavior (must be explicit)

If the system cannot satisfy constraints (too many locked items, too few adjustable foods, min/max clamps):

Do not silently output wrong totals

Show a clear message: “Can’t hit targets within tolerance with current foods/locks. Unlock an item or add another protein/carb/fat option.”

Highlight which macro is blocked and which constraint caused it (locked item, min/max, missing category, etc.)

Testing (must be automated + repeatable)

Add tests that run in CI / local test runner:

Unit tests

Rounding drift correction: feed known rounded drift cases and assert macros end within ±1g

Topper non-zero: if topper selected, grams never end at 0

Breakfast bounds: 0% yoghurt and Greek yoghurt stay within their ranges

Meal calorie split: each meal ends within ±10 kcal of target share (when feasible)

Locked items respected: locked grams never change

Min/max clamp handling: solver switches items and still converges or fails gracefully

Randomized/property tests (high value)

Run 100–500 randomized scenarios:

random targets + random food selections

assert invariants:

integer grams only

macros within ±1g (when solvable)

meals structured correctly

no negative grams

converges within iteration cap or returns explicit “not solvable”

Manual acceptance checks (last step)

Generate Monday–Sunday and confirm:

alert bar is green within tolerance

breakfast looks proportional

lunch/dinner plates look normal

reset buttons work and do not wipe settings

