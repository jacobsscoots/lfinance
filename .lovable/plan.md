# Precision Solver Fix (Merged Plan) — Achieve ±1g Macros + Stop Wasting Credits

Keep everything that already works. Don’t refactor unrelated modules. This task is ONLY about making the meal-plan portion generator hit targets precisely (±1g for P/C/F) and preventing bad solves being saved.

---

## Problem Summary (Observed)

The generator is producing days like:
- Calories: **+200–250 kcal over**
- Fat: **-14g to -21g under**
- Protein: **+2–7g over**
- Carbs: sometimes on-target

This should never persist as “success”. If the day is not solvable within constraints, it must return `success=false` + clear reasons and **must not write grams to DB**.

---

## Non-Negotiables / Acceptance Criteria

1. **Success criteria**
   - `success=true` ONLY when:
     - `abs(proteinDiff) <= 1`
     - `abs(carbDiff) <= 1`
     - `abs(fatDiff) <= 1`
   - Calories should be consistent with macros (and close), but **macros are the primary constraint**. If macros are met, calories should naturally follow.
2. **No “pretend success”**
   - If not within tolerance or infeasible: `success=false` and include warnings like:
     - “Unsolvable due to fixed items”
     - “No adjustable fat sources available”
     - “Constraints prevent hitting fat without breaking carb/protein”
3. **Never persist failed solves**
   - `recalculateDay` and `recalculateAll` must not save grams for any day where `success=false`.
4. **All tests pass**
   - Run full suite, add regression tests for the reported failure pattern.

---

## Root Cause (Merged Findings)

### A) Granola topper excluded from global adjustments
**File:** `src/lib/autoPortioning.ts` (around the “allEditables” build)
```ts
// Skip breakfast toppers - fixed 25-40g range
if (mealType === "breakfast" && getBreakfastRole(item.product) === "topper") return;
Granola is a major fat knob but is blocked.

B) Fat sources filter too restrictive
Fat knob selection can exclude the only workable items (toppers, capped yoghurt ranges).

C) Integer rounding pass clamps topper max incorrectly
Granola is capped at 40g when it should be able to go higher (e.g., 60g).

D) Precision loop gives up early
noProgressCount > 5 is too low for multi-constraint problems.

E) Persistence logic still writes grams when solve fails
Any code path that writes grams after a failed solve is burning credits and creating garbage days.

F) Weekly calorie plan / target derivation mismatch risk
If weekly calorie adjustments change daily calories, macro targets must be derived consistently from the chosen rule. The solver must be solving against the exact same targets the UI shows.

Implementation Plan (Merged + Tightened)
Step 0 — Confirm target derivation rule (must match UI + solver)
Implement a single source of truth for daily targets derivation when weekly calories vary. Add a setting and use it in BOTH UI + solver.

Decision options:

Recalculate carbs (protein + fat fixed, carbs fills remaining calories)

Recalculate fat (protein + carbs fixed, fat fills remaining calories)

Keep macros fixed (weekly calories is display-only)

Warn instead if inconsistent

Default recommended: Recalculate carbs (most stable + practical).

Deliverable:

deriveDailyTargets(baseMacros, dailyCalories, rule) used everywhere.

Step 1 — Allow granola topper to participate in fat adjustment (but not all toppers)
File: src/lib/autoPortioning.ts

Update editables inclusion:

Still exclude sauces/seasonings

For breakfast toppers:

include ONLY if isGranola(product) (or if macro profile qualifies as “fat knob”)

if (mealType === "breakfast" && getBreakfastRole(item.product) === "topper") {
  if (!isGranola(item.product)) return;
}
Step 2 — Fix integer rounding pass: correct granola max
File: src/lib/autoPortioning.ts

In rounding constraints:

if (role === "topper") {
  minGrams = 25;
  maxGrams = isGranola(item.product) ? MAX_GRANOLA_GRAMS : 40;
}
Define MAX_GRANOLA_GRAMS (e.g., 60) in one place (constants).

Step 3 — Expand fat sources to include realistic fat contributors (incl. greek yoghurt)
File: src/lib/autoPortioning.ts

Fat knobs selection should:

allow moderate-fat items (>= 3g/100g)

explicitly include Greek yoghurt (secondary yoghurt type) within its allowed range

exclude sauces/seasonings still

const fatSources = allEditables
  .filter(e => {
    if (isSauceOrSeasoning(e.item.product)) return false;
    if (e.item.fatPer100g >= 3) return true;
    if (e.mealType === "breakfast" && getYoghurtType(e.item.product) === "secondary") return true;
    return false;
  })
  .sort((a,b) => b.item.fatPer100g - a.item.fatPer100g);
Step 4 — Increase precision loop budget + improve “no progress” detection
File: src/lib/autoPortioning.ts

Increase noProgressCount threshold 5 → 10

Track progress by totalWeightedError decrease, not just grams changes.

If no progress, switch strategy (see Step 5) instead of bailing.

Step 5 — Add an explicit final “macro reconciliation” stage (fat first, then calorie sanity)
File: src/lib/autoPortioning.ts

After the main solver loop:

If fat is short > 1g:

add grams to highest-fat knobs within constraints (granola, salmon, etc.)

If fat overshoots:

subtract from fat knobs (reverse direction)

Then re-balance carbs if needed (depending on derivation rule)

Only after macros are within tolerance, do minor calorie alignment (if your system supports it)

Key rule:

Never “fix calories” by breaking macros.

Calories are a consequence of macro precision.

Step 6 — Hard stop: never persist failed solves (recalculateDay + recalculateAll)
Files:

src/hooks/useMealPlanItems.ts (and anywhere else persisting)

Rules:

If result.success === false:

do not write any grams

do not zero out grams in DB

return warnings to UI

If you currently “virtualize” items, keep it virtual and only commit when success.

Acceptance test: no DB writes happen for failed solve days.

Step 7 — Fix debug console not showing (so we can stop wasting credits)
Your instrumentation says it logs on modal open, but nothing appears.

Add:

explicit console.groupCollapsed("[portioning debug] ...") without gating if localStorage flag is set

confirm the check uses the correct key: "debug_portioning" === "1"

ensure the log function is actually imported and called (no tree-shake/unused removal)

show a visible UI hint when debug flag enabled: “Debug logging ON”

This is not optional. We need reliable on-screen proof of solver vs UI targets to avoid endless reruns.

Regression Tests (Must Add)
1) Fat precision parity
If fat knobs exist, fat must be within ±1g when success=true.

If not solvable, success=false with fat-related warning.

2) “No +200 kcal / -20g fat success” test
A test that reproduces the exact failure pattern:

If deltas are large (fatDiff > 10 or calDiff > 50), success MUST be false.

3) Persistence guard
Mock the persistence layer and assert no update calls occur when success=false.

Files To Modify (Merged)
File	Change
src/lib/autoPortioning.ts	Granola participation, fat sources, rounding max, longer precision loop, final macro reconciliation, stricter progress detection
src/hooks/useMealPlanItems.ts	Never persist failed solves for recalculateDay/recalculateAll
src/lib/autoPortioning.test.ts	Add regression tests (fat precision, no fake success, persistence guard)
src/lib/portioningDebug.ts + UI call sites	Make debug logging reliably appear when enabled
(If needed) src/lib/targets.ts (new)	Single source of truth: deriveDailyTargets(...) used by UI + solver
Testing Protocol (Must Follow)
Run full test suite (no exceptions).

Run new regression tests.

Manual verification:

enable debug: localStorage.setItem("debug_portioning","1")

generate portions on failing day

open day modal and confirm debug group logs appear

Confirm:

success only when ±1g P/C/F

failed solve shows reasons and saves nothing

Definition of Done
No more “Targets missed” days being saved.

Solver hits ±1g macros when feasible.

When infeasible, it stops and explains why.

Debug output works reliably.

Keep protein consumption high as a priority

All tests pass.

