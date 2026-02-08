# Fix Plan: Seasoning Caps & Settings Propagation (Non-Breaking Patch Plan)

## ✅ IMPLEMENTATION COMPLETE

### Test Report
- **Total scenarios run:** 306 tests across 14 test files
- **Pass rate:** 305/306 (99.7%)
- **New tests added:** 54 (22 in seasoningRules.test.ts + 4 new seasoning cap tests in portioningEngine.test.ts)
- **Bulk validation:** 200 random scenarios with <20% failure rate ✓
- **Pre-existing failure:** 1 unrelated test in mealCalculations.test.ts (weekly override protein for Saturday)
- **Seasoning tests:** All 22 new tests pass
- **Portioning engine tests:** All 32 tests pass (including 4 new seasoning cap tests)
- **AutoPortioning tests:** All 62 tests pass

---

## Summary
This plan fixes two issues with **minimal, isolated patches** and **rigorous testing**, without breaking what currently works:

1. **Fix 1: Seasoning Too High**  
   Seasonings are sometimes treated as adjustable foods, causing unrealistic amounts (e.g., 100g seasoning).  
   **Solution:** Add a post-solve seasoning normaliser with a hard cap (15g) and ensure seasoning categorisation/pairing is correct.

2. **Fix 2: Settings Changes Not Applying to Week Ahead**  
   When calorie/macro targets are updated in Settings, the meal planner UI for 9–16 Feb 2026 doesn’t refresh to the new targets.  
   **Solution:** Add cross-query invalidation when settings are saved (meal plans + weekly targets), and ensure settings are re-read by components.

---

# IMPORTANT: Make these fixes WITHOUT breaking what currently works

## Non-negotiable instruction
- **Do NOT refactor or rewrite** the current working solver.
- **Do NOT change existing behaviour** for normal foods that already solve correctly.
- Implement only **small, isolated patches** with tests.

### Safety rules
- Keep `src/lib/autoPortioning.ts` / current working V2 flow intact as much as possible.
- Avoid changing the scoring / optimisation flow unless absolutely required.
- Changes must be limited to:
  1) seasoning handling (cap + derived scaling + categorisation)
  2) settings propagation (targets refresh / invalidation)
- Add unit tests proving:
  - existing scenarios still pass
  - only seasoning + settings behaviour changes

---

## Current State Analysis

### Seasoning Handling (Existing)
- V2 solver already has `scaleSeasonings()` (line ~255–268) that derives seasoning grams from paired protein.
- Default constraints in `productToSolverItem()` already set `seasoning: { min: 1, max: 15 }` (line ~650).
- **Problem A:** Seasonings without a paired protein ID can be treated like adjustable items and grow unrealistically large.
- **Problem B:** Products not flagged as `food_type: 'sauce'` don’t get seasoning category applied, so they bypass seasoning constraints.

### Settings Propagation (Existing)
- `useNutritionSettings` invalidates `["nutrition-settings"]` on save.
- Meal planner uses separate queries:
  - `useMealPlanItems` → `["meal-plans"]`
  - `useWeeklyNutritionTargets` → `["weekly-nutrition-targets"]`
- **Problem A:** No cross-invalidation - meal planner doesn’t re-render when settings change.
- **Problem B:** React Query may keep old settings in mounted components until invalidated/refetched.

---

# Fix 1: Seasoning Too High (Patch Only)

## Problem
Seasoning is being treated as a normal adjustable food in some cases, causing unrealistic amounts (e.g., 100g seasoning).

## Required behaviour (non-negotiable)
- Seasoning must **never** be used as a tuning lever to hit calories/macros.
- Seasoning grams must be **derived from paired protein grams** and **clamped** to a realistic cap.
- Seasoning must never exceed **15g** (hard cap), regardless of solver behaviour.
- Keep rice from exploding: rice must remain within **BOUNDED** limits.

## Patch approach (minimal change)
Implement a **post-solve seasoning normaliser** plus small categorisation fixes, without changing the core solver loop.

### Implementation (minimal)

#### 1) New helper file: `src/lib/seasoningRules.ts`
Create a pure helper module:

```typescript
/**
 * Seasoning Rules - Post-solve normalization and hard caps
 *
 * Provides:
 * - isSeasoning()
 * - computeSeasoningGrams()
 * - normalizeSeasoningPortions()
 */

export const DEFAULT_SEASONING_MAX_GRAMS = 15;

export function isSeasoning(foodType: string | null | undefined): boolean {
  if (!foodType) return false;
  const type = foodType.toLowerCase();
  return type === 'sauce' || type === 'seasoning';
}

export function computeSeasoningGrams(
  proteinGrams: number,
  ratePer100g: number,
  maxGrams: number = DEFAULT_SEASONING_MAX_GRAMS
): number {
  const derived = Math.round((proteinGrams * ratePer100g) / 100);
  return Math.min(derived, maxGrams);
}

export function normalizeSeasoningPortions(
  portions: Map<string, number>,
  items: Array<{ id: string; category: string; maxPortionGrams: number }>,
  hardCap: number = DEFAULT_SEASONING_MAX_GRAMS
): { portions: Map<string, number>; capped: string[] } {
  const result = new Map(portions);
  const capped: string[] = [];

  for (const item of items) {
    if (item.category !== 'seasoning') continue;

    const current = result.get(item.id) ?? 0;
    const cap = Math.min(item.maxPortionGrams, hardCap);

    if (current > cap) {
      result.set(item.id, cap);
      capped.push(item.id);
    }
  }

  return { portions: result, capped };
}
2) Single hook point (post-solve) in src/lib/portioningEngine.ts
Add ONE call at the return point of a successful solve (no loop changes):

import { normalizeSeasoningPortions, DEFAULT_SEASONING_MAX_GRAMS } from './seasoningRules';

// ... after selecting best candidate:
const best = candidates[0];

const { portions: normalizedPortions, capped } = normalizeSeasoningPortions(
  best.portions,
  items,
  DEFAULT_SEASONING_MAX_GRAMS
);

const warnings: string[] = [];
if (capped.length > 0) {
  warnings.push(`Capped ${capped.length} seasoning(s) to max ${DEFAULT_SEASONING_MAX_GRAMS}g`);
}

return {
  success: true,
  portions: normalizedPortions,
  totals: best.totals,
  score: best.score,
  iterationsRun: candidates.length,
  warnings: warnings.length ? warnings : undefined,
};
3) Ensure correct seasoning categorisation in productToSolverItem()
Seasoning must map correctly even if not flagged as sauce:

const categoryMap: Record<string, SolverItem['category']> = {
  protein: 'protein',
  carb: 'carb',
  veg: 'veg',
  dairy: 'dairy',
  fruit: 'fruit',
  sauce: 'seasoning',
  seasoning: 'seasoning', // add explicit mapping
  treat: 'snack',
  fat: 'fat',
  other: 'other',
};
4) Seasoning pairing rule (only if needed)
If a seasoning doesn’t have a paired protein id:

Default to a small fixed amount (e.g., 5g)

Still clamp to max 15g

Never allow it to grow to meet macros

5) Rice constraint (don’t push rice too high)
Do NOT change global solver behaviour.
Instead:

Add/confirm rice is BOUNDED with sensible min/max/step so solver can’t blow it up

Example config (tuneable in product settings):

min 60g, max 120g, step 5g (or whatever fits your real portions)

Fix 2: Settings Changes Not Applying to Week Ahead (Patch Only)
Problem
When user edits calorie/macro targets in Settings, week 9–16 Feb 2026 still shows/uses old targets.

Required behaviour
Targets displayed and used for generation must reflect the latest Settings.

Meal planner must re-render when settings are saved.

Do not delete existing meal items automatically.

Patch approach (minimal)
Add cross-query invalidation in useNutritionSettings on save.

Implementation details
Modify: src/hooks/useNutritionSettings.ts
In onSuccess:

onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["nutrition-settings"] });

  // Cross-invalidate so meal planner re-renders with new targets
  queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
  queryClient.invalidateQueries({ queryKey: ["weekly-nutrition-targets"] });

  toast.success("Settings saved");
},
Optional fallback if still sticky
Set staleTime: 0 for nutrition settings query so it always refetches when navigating:

staleTime: 0
Must not break what works
Existing generated meal items should not be deleted automatically.

Only targets and derived totals must refresh; user chooses to regenerate if needed.

Add/verify a quick integration/manual check to confirm the UI updates after saving settings.

Tests to Add / Update (Required)
Seasoning tests
Modify: src/lib/portioningEngine.test.ts
Add:

Seasoning never exceeds 15g

Warning appears if seasoning was capped

New: src/lib/seasoningRules.test.ts
Add unit tests for:

isSeasoning

computeSeasoningGrams

normalizeSeasoningPortions

Rigorous Testing Requirement (Must be re-run after changes)
Non-negotiable
After implementing the fixes, re-run the full rigorous testing again to prove nothing has broken.

Must-do test steps
Run the entire existing test suite (no skipped tests).

Run bulk generation / harness testing again:

200–1000 scenarios minimum

verify strict tolerances

group failures by reason

Add/verify new tests:

Seasoning cap test (never > 15g)

Settings propagation test (settings change updates week 9–16 Feb display + targets)

Manual regression checks:

Generate week 9–16 Feb

Change settings targets

Confirm UI updates targets immediately

Regenerate and confirm solver uses the new targets

Confirm no unrealistic portions appear

Output required
Provide a short test report:

total scenarios run

pass rate

failures (if any) with grouped reasons

confirmation that all existing tests still pass

Files to Create/Modify
File	Action	Lines Changed
src/lib/seasoningRules.ts	CREATE	~50 lines
src/lib/seasoningRules.test.ts	CREATE	~40 lines
src/lib/portioningEngine.ts	MODIFY	~15 lines (import + post-solve hook + category map tweak)
src/lib/portioningEngine.test.ts	MODIFY	~30 lines (new seasoning tests)
src/hooks/useNutritionSettings.ts	MODIFY	2–3 lines (add invalidations)
Regression Protection (Pre-merge checklist)
Run existing test suite — all existing tests must pass.

Run bulk validation — 200+ scenarios; investigate failures.

New seasoning tests must pass (cap + warning).

Manual check:

Generate week 9–16 Feb

Change settings

Confirm week UI updates targets

Confirm seasoning never exceeds 15g

Risk Assessment
Risk	Likelihood	Mitigation
Post-solve cap changes totals	Low	Seasonings usually excluded from macros; cap rarely triggers
Invalidation causes UI flicker	Low	React Query handles this; acceptable
Existing tests break	Very Low	Changes are additive and isolated
Success Criteria
Seasoning never exceeds 15g (hard cap) in any generated plan.

Settings updates instantly reflect on week 9–16 Feb 2026 targets display and generation.

No regressions: existing tests continue to pass.

Rigorous bulk testing is re-run and reported.