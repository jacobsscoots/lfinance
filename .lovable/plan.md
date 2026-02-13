

# Meal Planner AI Solver -- Complete Rewrite

## Summary

Clean rewrite of the AI meal planner's edge function solver and client-side save/UI logic. The current code has accumulated conflicting patches across 10+ iterations. This plan addresses all 8 bugs systematically with a cohesive, tested implementation.

---

## Current State (What's Broken)

The system has three layers: (1) AI generates an initial portion guess, (2) a server-side coordinate descent solver refines it, (3) client saves on PASS or shows error on FAIL. Multiple bugs span all three layers:

| Bug | Status | Root Cause |
|-----|--------|-----------|
| 1. Solver target comparison | Partially fixed | `computeTotals` includes locked and compares against full targets -- correct. But AI prompt still uses "remaining" targets which can mislead the initial guess |
| 2. Forced minimums | Fixed | `minG = 0` for free items already implemented |
| 3. Greedy solver oscillation | Partially fixed | Multi-start coordinate descent exists but uses +-1g steps with acceleration heuristic that can overshoot |
| 4. meetsTargets double-counting | Fixed | `meetsAll()` compares full totals against full targets |
| 5. Client saves on FAIL | Fixed | Gate exists at line 998-1011 |
| 6. FAIL corrupts UI | Broken | `useEffect` on `items.length` (line 83-86) clears `aiFailInfo` on any re-render that changes item count. Also, items with `quantity_grams === 0` show as "--" which looks like corruption even though those are legitimately uncalculated items |
| 7. Suggestions inaccurate | Broken | Suggestions reference wrong grams, suggest reducing foods when under target, don't identify the real binding constraint |
| 8. Build verification | Done | `BUILD_SHA` already in MealPlan page |

---

## What Will Change

### File 1: `supabase/functions/claude-ai/index.ts` (edge function -- rewrite `handleMealPlanner`)

The `handleMealPlanner` function (lines 325-1117) will be rewritten from scratch. The `handleCheaperBills` function and the main `serve()` handler remain unchanged.

**Changes:**

**A. AI prompt fix (Bug 1 residual)**
- Change the AI system prompt to use FULL daily targets (not remaining). The solver's `computeTotals` already adds locked macros, so the AI should think in terms of total-day targets too. This makes the AI guess closer to reality.
- Tell the AI to output portions for free items only, but to account for locked items' contributions.

**B. Solver rewrite (Bug 3)**
- Keep the multi-start coordinate descent structure but fix the step-size logic:
  - Remove the "acceleration" heuristic (lines 656-672) that can overshoot. Instead, use adaptive step sizes: start at 10g steps, switch to 5g when error drops below 500, switch to 1g when below 50.
  - Increase stale limit from 200 to 500 before giving up.
  - Add a "perturbation" escape: when stuck, randomly perturb 2-3 foods by +-10g and continue.
- The core `computeTotals`, `meetsAll`, and `computeError` functions are correct and stay as-is.

**C. Rounding fix**
- Current rounding logic (lines 862-893) re-solves from rounded state but can fail. Change to: after rounding to 5g, if constraints break, run 200 more iterations of 1g coordinate descent from the rounded state. Only fall back to 1g rounding if that still fails.

**D. Suggestion engine rewrite (Bug 7)**
- Remove all existing suggestion logic (lines 922-1073).
- New suggestion engine:
  1. Compute `maxCarbsUnderConstraints`: greedy algorithm that maximises carbs while keeping fat and kcal within target. Sort foods by "fat cost per gram of carb" ascending, greedily assign up to min(maxG, fatBudget/fPer1g, calBudget/calPer1g).
  2. Do the same for protein: `maxProteinUnderConstraints`.
  3. If target carbs > maxCarbsUnderConstraints: "Cannot reach Xg carbs while keeping fat at or below Yg. Max achievable: Zg. Options: lower carb target, raise fat target, or add a low-fat carb source."
  4. Identify binding constraint: if fat budget runs out before carb target is reached, name the top 2 fat contributors from the food list (using saved grams, not solver grams).
  5. Never suggest reducing a food that provides a macro the plan is SHORT on.
  6. Only reference saved grams (the `quantity_grams` from the input payload). Never reference solver-attempted grams in user-facing suggestions.

**E. FAIL response structure**
- Return a clean `food_breakdown` array with: `name`, `savedGrams`, `minG`, `maxG`, `perGram` macros, `isSeasoning`.
- Do NOT include `solverAttemptedGrams` in the response (it confuses the client). Keep it in server logs only.

### File 2: `src/hooks/useMealPlanItems.ts` (client gate)

**Changes to `aiPlanDay` mutation (lines 937-1064):**

- The FAIL gate (lines 998-1011) is correct and stays.
- The `onSuccess` handler (lines 1038-1059) is correct and stays.
- No functional changes needed here. The gate works correctly.

**Changes to `aiPlanWeek` mutation (lines 1067-1163):**

- Line 1151: `queryClient.invalidateQueries` is called unconditionally. Change to only invalidate if `result.daysSucceeded > 0` (matching the pattern used in `recalculateAll` at line 903-906).

### File 3: `src/components/mealplan/MealDayCard.tsx` (UI state)

**Changes (Bug 6):**

**A. Fix `aiFailInfo` clearing logic (lines 83-86)**
- Current: `useEffect` watches `items.length` and clears `aiFailInfo` on any change. Problem: if React Query refetches (e.g., window refocus), `items` reference changes even without user action, clearing the fail banner.
- Fix: Remove the `useEffect`. Instead, clear `aiFailInfo` in three specific places:
  - `handleGenerate()` (user clicks Generate)
  - `handleAiPlan()` (user clicks AI Plan -- already done at line 197)
  - `handleAddItem()` (user adds a new food item)
  - `handleClearDay()` (user resets the day)

**B. Fix "uncalculated" detection (line 78-80)**
- Current: `hasUncalculatedItems` is true when any editable item has `quantity_grams === 0` AND `aiFailInfo` is null. This is correct but items showing "0g" as "--" (line 431) is confusing.
- No change needed here -- the "--" display for 0g items is intentional (they genuinely have no portion assigned yet).

**C. Suggestion display in FAIL banner (lines 317-326)**
- Add the `suggested_fixes` list below the error message in the red banner, styled as a bullet list. Currently suggestions only appear as toast notifications which disappear.

### File 4: `src/pages/MealPlan.tsx` (Bug 8)

- Update `BUILD_SHA` to a new value (e.g., `mp-20260213a`) so the user can verify deployment.

---

## Technical Details

### Solver Algorithm (pseudocode)

```text
function solveFromStart(startGrams):
  grams = copy(startGrams)
  stepSize = 10
  bestError = infinity
  bestGrams = copy(grams)
  staleCount = 0

  for iter = 0 to 5000:
    totals = computeTotals(grams)  // locked + free
    err = computeError(totals)     // vs full targets

    if err < bestError:
      bestError = err
      bestGrams = copy(grams)
      staleCount = 0
    else:
      staleCount++

    if meetsAll(totals): return PASS

    // Adaptive step size
    if err < 50: stepSize = 1
    else if err < 500: stepSize = 5
    else: stepSize = 10

    if staleCount > 500:
      // Perturbation escape
      randomly adjust 2-3 foods by +-10g (within bounds)
      staleCount = 0
      continue

    // Evaluate all +-stepSize moves for all free non-seasoning foods
    // Pick the move that minimises computeError
    // Apply it

  return bestGrams, bestError
```

### Suggestion Engine (pseudocode)

```text
function generateSuggestions(failedTotals, targets, foods, savedGrams):
  suggestions = []

  // Step 1: Which macros are failing?
  carbsShort = targets.carbs - failedTotals.carbs
  protShort = targets.protein - failedTotals.protein
  fatOver = failedTotals.fat - targets.fat

  // Step 2: Compute max achievable carbs under fat+kcal caps
  maxCarbs = greedyMaxCarbs(foods, targets.fat, targets.calories, lockedMacros)

  if maxCarbs < targets.carbs - 2:
    suggestions.add("Cannot reach {carbs}g carbs while keeping fat
      at or below {fat}g. Max achievable: {maxCarbs}g.
      Lower carb target to ~{maxCarbs}g, raise fat target,
      or add a low-fat carb source.")

  // Step 3: Identify fat budget consumers
  if carbsShort > 2 or kcalShort > 50:
    fatFoods = foods where fPer1g > 0.03 and cPer1g < 0.1
    sort by fat contribution (savedGrams * fPer1g) descending
    for top 2:
      suggestions.add("{name} ({savedG}g) uses {fat}g of {target}g
        fat budget but adds only {carbs}g carbs.
        Remove or replace with lower-fat option.")

  // Step 4: Maxed carb foods
  for food in foods where cPer1g > 0.2 and solverG >= maxG:
    suggestions.add("{name} hit max {maxG}g. Increase
      max_portion_grams to add more carbs.")

  return suggestions
```

### Data Flow (unchanged)

```text
User clicks "AI Plan"
  -> MealDayCard.handleAiPlan()
  -> useMealPlanItems.aiPlanDay.mutate()
  -> supabase.functions.invoke('claude-ai', { feature: 'meal_planner', ... })
  -> Edge function: AI guess -> solver refine -> validate
  -> Response: { success, status, portions/violations }
  -> Client: if success, save to DB + invalidate cache
             if fail, set aiFailInfo state, show banner, NO save
```

---

## Files Changed

| File | Change Type | Scope |
|------|------------|-------|
| `supabase/functions/claude-ai/index.ts` | Rewrite | `handleMealPlanner` function only (~800 lines). `handleCheaperBills` and `serve()` untouched |
| `src/hooks/useMealPlanItems.ts` | Minor fix | `aiPlanWeek.onSuccess` -- conditional query invalidation (1 line) |
| `src/components/mealplan/MealDayCard.tsx` | Fix | Remove `useEffect` for aiFailInfo clearing, add explicit clear points, add suggestion list to FAIL banner |
| `src/pages/MealPlan.tsx` | Trivial | Update BUILD_SHA |

---

## Testing Plan

After implementation:

1. **Solvable day**: Add foods with enough variety. Click AI Plan. Expect PASS, portions saved, totals within bands.
2. **Unsolvable day (inter-constraint)**: Day where carb target requires exceeding fat cap. Expect FAIL, red banner with accurate explanation, NO portion changes.
3. **Locked items**: Lock some items, click AI Plan. Expect only free items adjusted, locked unchanged.
4. **FAIL then manual edit**: After FAIL banner shows, add/remove a food. Banner should clear.
5. **Console verification**: Check `AI_RESPONSE` and `SAVE_CALLED?` logs match expected behaviour.
6. **Build SHA**: Confirm page header shows new build identifier.

