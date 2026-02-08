
## What’s actually happening (based on the live failing data)

### 1) The “At maximum portion of 15g; At minimum portion of 100g” blocker is real and is currently caused by a global constraint bug for seasonings
From the database for **2026-02-08**, the “Schwartz … Chicken Seasoning” product has:
- `food_type = other` (so it relies on name fallback to be treated as seasoning)
- **`min_portion_grams = 100`**
- **`max_portion_grams = 300`**

Our code currently:
- correctly *detects by name* that it is a seasoning and clamps **max** to 15g
- but it **does not override the product’s min_portion_grams**, so the solver item becomes:
  - `minPortionGrams = 100`
  - `maxPortionGrams = 15`
This creates a contradictory constraint pair and the failure message you’re seeing.

### 2) Why seasoning still “shows 100g” on later days/weeks
Weekly generation only writes new grams **on solver success**. If a day fails, the existing stored grams remain unchanged.
So if seasoning was previously 100g (from manual entry or copying), it will stay 100g on days that fail—making it look like “caps aren’t applied”, when in practice the day never committed updated quantities.

### 3) The “Contributes 70g protein; At minimum portion of 10g” message is not necessarily a unit bug
That “Contributes 70g protein” is consistent with a locked/fixed meal item contributing a large chunk of protein (e.g., a big fixed pasta meal), and “At minimum 10g” usually comes from default min constraints on “other” items.
It may still be solvable, but the current local-search loop can stagnate, and it reports `max_iterations_exceeded` even when it broke early due to stagnation.

---

## Goals (non-negotiable, kept)
- No solver rewrite
- Additive, isolated patches
- Seasoning must never exceed 15g everywhere (day/week/copy)
- Fail fast when impossible; retry deterministically when feasible-but-stuck
- Add tests + re-run the rigorous bulk harness

---

## Fix B (Seasoning) — Make it impossible for seasoning to be 100g anywhere

### B0) Core change: “Seasoning constraints override product constraints”
**Change in `productToSolverItem()`** (isolated):
- If the item is classified as seasoning (by food_type, explicit category, or name fallback), then:
  - Force constraints to seasoning-safe values, regardless of product min/max:
    - `minPortionGrams = 0` (or 1, depending on preference)
    - `maxPortionGrams = 15`
    - `portionStepGrams = 1` (or keep product step, but clamped)
    - `roundingRule = nearest_1g` (safe default)
  - Force `editableMode = 'LOCKED'` (pre-solve rule: not an optimization variable)
  - Force `countMacros = false` unless a feature flag says otherwise

This resolves the contradictory “min 100 / max 15” and enforces “non-optimisable + capped”.

### B1) Persist seasoning clamp even when the day fails
In `useMealPlanItems.ts`:
- In both `recalculateDay` and `recalculateAll`:
  1) Identify seasoning items (same detection rule as solver: food_type OR name fallback).
  2) Compute their intended grams:
     - If paired protein exists + rate configured: derived grams
     - Else fallback: 5g
     - Clamp to 15g
  3) **Update seasoning items in the DB first (or at least update them even if solve fails)**

This guarantees:
- seasonings never remain at 100g just because the rest of the solve failed.

### B2) Clamp on copy operations so 100g can’t propagate forward
Update these mutations in `useMealPlanItems.ts`:
- `copyDayToNext`
- `copyFromPreviousWeek`

During copying, if an item is a seasoning:
- copy the row but cap grams to <= 15 (or set fallback 5)

### B3) Clamp at item-add time (manual + target mode)
Update UI add flows:
- `MealItemDialog` (single add)
- `MealItemMultiSelectDialog` (multi add)

Rules:
- If a selected product matches seasoning detection, default grams to 5 (manual or target mode)
- If user types a larger number, clamp to 15 and show a small inline hint:
  - “Seasonings are capped at 15g”

### B4) Tests for seasoning “everywhere”
Add/extend tests to cover:
- `productToSolverItem()` seasoning override ignores product min/max (this is the key regression test)
- “Clamp even if solve fails” (a unit test around the mutation function helper, or a mocked mutation test)
- “Copy clamps seasonings”

---

## Fix A (Iteration failures) — Fail fast if impossible; deterministic retries if feasible-but-stuck

### A1) Add a feasibility pre-check (necessary-condition bounds)
Add a small pre-check inside `solve()` (before the iteration loop):
- Compute:
  - `minTotals` = locked items + min for adjustable items (after clamping/rounding)
  - `maxTotals` = locked items + max for adjustable items (after clamping/rounding)
  - exclude seasonings from totals unless `seasoningsCountMacros=true`

Then check necessary conditions for each macro and calories:
- If `maxTotals.protein < targetProtein` ⇒ impossible
- If `minTotals.protein > targetProtein + tolerance.max` ⇒ impossible
- Repeat for carbs/fat/calories

If impossible:
- return `success:false` with:
  - `reason: 'impossible_targets'` (new FailureReason)
  - blockers include:
    - which macro failed
    - target vs min/max achievable totals
    - top 2–3 items limiting that macro (e.g., items already at max or locked contributors)

This replaces misleading `max_iterations_exceeded` in truly impossible cases.

### A2) Deterministic multi-start retries (minimal change, no randomness)
Implement a wrapper inside `portioningEngine.ts`:
- Attempt 1: current initialization (unchanged)
- Attempt 2: midpoint initialization for FREE/BOUNDED items
- Attempt 3: protein-heavy / carb-light initialization
- Attempt 4: carb-heavy / protein-light initialization

Implementation approach (minimal refactor):
- Extract the existing loop into a helper function like:
  - `runLocalSearch(initialPortions): CandidatePlan[] | failureSnapshot`
- Keep scoring, adjustment selection, tolerances identical
- Only swap the initial portions used

Return the best candidate across attempts by existing score function.

### A3) Make failure reason accurate when we break due to stagnation
Currently, stagnation breaks early but we still return `max_iterations_exceeded`.
Add a new failure reason:
- `reason: 'stagnation'` (or `local_optimum`)
and include blockers + closestTotals as before.

This improves debugging and avoids “you didn’t test enough” confusion, because it will report what actually happened.

### A4) Product nutrition validation used for solver gating (not just a helper)
We already have `validateProductNutrition()` but it is not used to prevent a bad product entering the solve.
Add two gates:
1) On product save (create/update): block invalid values with a clear error toast.
2) Before solve: if any item product fails validation, return:
   - `reason: 'invalid_product_nutrition'`
   - blockers listing the product(s) and the exact validation error

This catches unit conversion mistakes deterministically.

### A5) Tests for feasibility + multi-start
Add tests:
- Feasibility fail-fast:
  - construct a scenario where max achievable protein < target
  - assert `reason === 'impossible_targets'` and min/max bounds are reported
- Multi-start success:
  - construct a small synthetic scenario known to stagnate from current initialization but solvable from midpoint
  - assert at least one attempt succeeds
- Stagnation reason:
  - scenario that breaks on stagnation and returns `reason === 'stagnation'`

---

## Fix C (Global constraints + targets across all dates) — tighten propagation and stop snapshot bleed

### C1) Constraints always come from Products (already mostly true, but fix the seasoning exception)
With the seasoning override, constraints become globally consistent across all dates even if a product has a “bad” min/max for a seasoning.

### C2) Targets are hybrid explicit-only (your choice)
Keep the current hybrid behavior:
- Weekly overrides apply only when explicit (protein/carbs nullable)
- Otherwise, compute from global settings for any date

### C3) Invalidation completeness (additive)
We already invalidate meal-plans on settings save and product update.
We’ll add/confirm invalidation on:
- Product create/delete
- Weekly targets save/remove (already invalidates)
- Any “bulk edit constraints” action (if present)

---

## Implementation sequence (safe, isolated)
1) Seasoning constraints override + lock seasonings in solver items
2) Clamp/persist seasonings even when a day fails
3) Clamp seasonings on copy + add-item flows
4) Feasibility pre-check + new failure reason(s)
5) Multi-start wrapper (keep core loop identical)
6) Product nutrition validation gates
7) Tests + bulk harness + short test report

---

## Test + Rigorous validation report (non-negotiable deliverable)
After implementation we will:
1) Run full existing unit test suite (no skips)
2) Run bulk harness: 200–1000 scenarios
3) Add new tests:
   - seasoning min/max override regression test (prevents your current bug permanently)
   - seasoning clamp persists even if solve fails
   - feasibility fail-fast test
   - multi-start resolves a formerly-stagnant case
4) Manual checks:
   - Generate week containing 2026-02-08
   - Confirm seasoning never shows 100g even on failed days
   - Confirm failure reasons are “impossible targets” or “stagnation” with clear bounds, not “max iterations exceeded” everywhere

---

## What I need next
If you want me to proceed implementing this (it will touch solver + hooks + UI dialogs + tests), confirm and I’ll continue in a new request as you asked (no more tool calls in this one).
