# Meal Plan Generator Fix Plan (Lovable) — Exact Targets With Realistic Portions

## Executive Summary
Rebuild the meal plan generator so it produces daily plans that match calorie + macro targets **precisely** within strict allowances, using a **deterministic, iterative optimisation loop** that keeps calculating until valid (or returns a clear failure reason). No LLM calls inside the solver loop.

**Tolerances (spec):**
- Calories: `target ≤ calories ≤ target + 50 kcal`
- Macros (each): `target ≤ macro ≤ target + 1–2g` (default `+2g`, configurable)

**Hard rules:**
- Must not stop after one attempt — it must keep trying until valid.
- Must not output unrealistic portions (e.g. **700g yoghurt**).
- Must respect LOCKED items (veg/cookies/hunters chicken pasta).
- Must scale seasonings perfectly with chicken grams.
- Must not change any nutrition info the user provided.

---

## Current State Analysis (What exists today)

### Solver Algorithm (existing)
- **File**: `src/lib/autoPortioning.ts` (~1900 lines)
- Multi-phase solver: meal-level solving → global fine-tuning → integer rounding → rebalancing
- Uses heuristics and name matching for food-type detection
- Tolerances: strict (±1g macros, ±50 kcal) and relaxed (±25g, ±150 kcal)
- Falls back to “nearMatch” to avoid blank days

### Product Data Model (existing)
- `products` table has `product_type`: “editable” / “fixed”
- No explicit `LOCKED/BOUNDED/FREE`
- No stored min/max/step constraints
- Constraints inferred from name keywords (yoghurt/granola/etc.)

### Test Coverage (existing)
- `src/lib/autoPortioning.test.ts` (~1100 lines)
- Invariants: integer grams, tolerance checks, locked items, topper minimums
- Property-based randomised scenarios
- Good foundation to extend for the new engine

---

## Key Problems to Solve

| Problem | Impact | Solution |
|---|---|---|
| Portion limits inferred from names, not stored | Unpredictable; new products can break | Store `min_g`, `max_g`, `step_g`, `rounding_rule` per product |
| Solver gives up / falls back after one pass | Produces “nearMatch” and warnings | Multi-iteration loop (up to 500) that keeps trying |
| No explicit LOCKED products | Can’t lock veg/cookies/pasta reliably | Add `editable_mode`: `LOCKED / BOUNDED / FREE` |
| Seasonings don’t scale with protein | Wrong seasoning proportions | Add `seasoning_rate_per_100g` and auto-scale |
| No eaten factor | Doesn’t model real-life waste | Add `eaten_factor` (0–1) for effective totals |
| No meal templates / balance rules | Unbalanced meals | Template system with slots + constraints |
| Unrealistic portions possible | “700g yoghurt” type outputs | Hard portion caps per product and per meal |

---

## Non-Negotiables

### Hard tolerances (must pass)
- **Calories:** `target ≤ achieved ≤ target + 50`
- **Protein/Carbs/Fat:** `target ≤ achieved ≤ target + 2g` (or configured)

**Important:**
- No single-attempt generation. Must keep calculating until it passes.
- If impossible (due to locked items, portion caps, ratios), return a clear failure reason (not half-valid output).

### Credit-saving requirement
- **No LLM calls inside the optimisation loop.**
- Use deterministic maths/logic; allow many iterations without burning credits.

---

## Data Model (Do NOT change user nutrition values)

### Products
Each product must store (solver-facing):
- `id`
- `name`
- `category`: `protein | carb | veg | dairy | fruit | snack | seasoning | premade`
- `nutrition_per_100g`: `{ calories, protein_g, carbs_g, fat_g }`
- `default_unit_type`: `grams | whole_unit`
- `unit_size_g` (optional, for whole unit items like a pot/pack)
- `editable_mode`: `LOCKED | BOUNDED | FREE`
- `min_portion_grams` (optional)
- `max_portion_grams` (optional)
- `portion_step_grams` (default 1)
- `rounding_rule`: `nearest_1g | nearest_5g | nearest_10g | whole_unit_only`
- `eaten_factor` (0–1, default 1.00)
- `seasoning_rate_per_100g` (optional)
- `meal_roles_allowed`: `breakfast | lunch | dinner | snack`

### Locked product examples (must be supported)
These must be truly non-editable:
- veg → `editable_mode = LOCKED`
- cookies → `editable_mode = LOCKED`
- hunters chicken pasta → `editable_mode = LOCKED`

---

## Phase 1: Database Schema Updates

### Update `products` table
```text
products table additions:
+-----------------------------+----------+---------+--------------------------------+
| Column                      | Type     | Default | Purpose                        |
+-----------------------------+----------+---------+--------------------------------+
| editable_mode               | text     | 'FREE'  | LOCKED/BOUNDED/FREE            |
| min_portion_grams           | integer  | NULL    | Minimum grams per serving      |
| max_portion_grams           | integer  | NULL    | Maximum grams per serving      |
| portion_step_grams          | integer  | 1       | Step increment (e.g., 5g)      |
| rounding_rule               | text     | 'nearest_1g' | Rounding behaviour          |
| eaten_factor                | numeric  | 1.00    | % actually consumed (0-1)      |
| seasoning_rate_per_100g     | numeric  | NULL    | Grams per 100g protein pairing |
| category                    | text     | NULL    | protein/carb/veg/dairy/etc     |
| default_unit_type           | text     | 'grams' | grams or whole_unit            |
| unit_size_g                 | integer  | NULL    | for whole_unit items           |
+-----------------------------+----------+---------+--------------------------------+
New meal_templates table
meal_templates table:
+----------------------+----------+---------------------------------+
| Column               | Type     | Purpose                         |
+----------------------+----------+---------------------------------+
| id                   | uuid     | Primary key                     |
| user_id              | uuid     | Owner                           |
| name                 | text     | e.g., "Balanced Dinner"         |
| meal_type            | text     | breakfast/lunch/dinner/snack    |
| slot_definitions     | jsonb    | Array of slot rules             |
| created_at           | timestamptz |                              |
+----------------------+----------+---------------------------------+
Slot definitions JSON structure example:

[
  { "role": "protein", "required": true, "minCalorieShare": 0.25, "maxCalorieShare": 0.45 },
  { "role": "carb", "required": true, "minCalorieShare": 0.30, "maxCalorieShare": 0.50 },
  { "role": "veg", "required": false, "minGrams": 80, "maxGrams": 200 }
]
Calculation Rules (Accurate + Real-Life)
Effective eating vs weighed grams
For each item:

weighed grams = grams shown in UI + used in shopping list

effective grams eaten = weighed_grams × eaten_factor

Totals must use effective grams:

nutrition_per_100g × (effective_grams / 100)

Rounding
Apply rounding rules consistently (nearest_5g, whole_unit_only, etc.)

After rounding, the solver must re-check tolerances and keep iterating if invalid.

Locked vs Editable Rules (Strict)
LOCKED
Grams can never change.

If locked items prevent targets, report exactly why.

BOUNDED
Grams can change only inside [min, max] and must follow step_g + rounding.

FREE
Grams can change normally (still subject to rounding rules).

Balanced Meals (Eatable + sensible ratios)
Meal templates + slot constraints
The solver must build meals using templates so meals stay realistic.

Breakfast template (example)
required: dairy (yoghurt) + fruit + granola

constraints:

granola max share of breakfast calories (e.g. 40%)

fruit bounded to a realistic range

yoghurt bounded (no huge amounts)

Dinner template (example)
required: protein (chicken) + carb (rice) + veg

constraints:

minimum protein contribution (e.g. ≥ 40g protein from protein sources)

carbs max share of dinner calories (e.g. 55%)

veg may be LOCKED: treat as compliance check (warn if too low but do not change)

Seasonings Must Scale Perfectly (Chicken proportion rule)
Seasonings must scale exactly with chicken grams:

Store seasoning products with seasoning_rate_per_100g (grams per 100g chicken)

After protein grams are determined:

seasoning_g = round(chicken_g × seasoning_rate_per_100g / 100)

Seasonings can be configured to:

Count towards macros (default OFF)

Have a max cap (e.g. 15g)

Generate Meal Plan Button (Must Iterate Until It Passes)
Core behaviour: keep trying until valid
When user clicks Generate Meal Plan the system must:

Load items + targets + template rules

Classify constraints:

LOCKED: fixed grams

BOUNDED: min/max/step/rounding

FREE: adjustable within limits

Subtract LOCKED contributions from targets

Run a deterministic optimisation loop (max 500 iterations):

adjust FREE/BOUNDED grams only

apply rounding rules

compute totals using eaten_factor

validate tolerances

continue iterating until valid

Replace the current proposed plan with the best valid plan found

Hard rule: Must not give up after one attempt.

Eatable Portion Limits (No unrealistic meal sizes)
The generator must never output unrealistic portions like “700g yoghurt”.

Every product must support realistic limits:

min_portion_grams, max_portion_grams, portion_step_grams, rounding_rule

Example defaults (configurable):

yoghurt: max per serving 250–300g OR whole_unit_only

fruit: max per meal 200–300g

rice cooked: bounded 150–300g

veg: often LOCKED but still checked for balance rules

The optimiser must respect portion constraints at all times.

Best Result Out of All Attempts (Choose best valid plan)
The solver must track candidates during the loop and return the best valid result.

Selection ranking
Lowest calorie overage

Lowest total macro overage

Closest to default portion sizes (avoid weird numbers)

Best meal balance score (slot/ratio constraints satisfied cleanly)

If no valid plan exists after max iterations:

Do not return a near-match plan

Return a failure state with blockers + closest totals

Failure Reporting (Explicit)
When no valid plan is found after max iterations:

interface SolverFailure {
  reason: 'locked_conflict' | 'portion_cap' | 'ratio_constraint' | 'rounding_conflict';
  blockers: { itemName: string; constraint: string; value: number }[];
  closestTotals: MacroTotals;
  targetDelta: MacroTotals;
}
UI should show explicit messages:

“Could not hit targets because LOCKED cookies contribute 12g fat; remaining fat target is 6g.”

“Yoghurt max portion cap prevents reaching protein target.”

Phase 2: Solver Algorithm Rewrite
Replace the heuristic solver with a deterministic constraint-based engine
Create a new solver implementation and stop using the existing autoPortioning.ts.

High-level flow:

+---------------------------+
|  1. Load items + targets  |
+---------------------------+
            |
            v
+---------------------------+
|  2. Classify constraints  |
|     LOCKED: fixed grams   |
|     BOUNDED: min/max/step |
|     FREE: within limits   |
+---------------------------+
            |
            v
+---------------------------+
|  3. Subtract LOCKED from  |
|     targets               |
+---------------------------+
            |
            v
+---------------------------+
|  4. Optimisation loop     |
|     (max 500 iterations)  |
|     - Adjust grams        |
|     - Apply rounding      |
|     - Use eaten_factor    |
|     - Check tolerances    |
|     - Track best valid    |
+---------------------------+
            |
    +-------+-------+
    |               |
    v               v
+---------+   +-------------+
| SUCCESS |   | MAX_ITERS   |
| Return  |   | Return best |
| best    |   | or failure  |
+---------+   +-------------+
Key properties:

Deterministic (same inputs → same outputs)

No LLM calls

Integer grams (or whole units)

Respects LOCKED/BOUNDED/FREE and portion limits

Tolerance Configuration (Spec-Compliant)
Metric	Allowed Range
Calories	target to target + 50
Protein	target to target + 2g
Carbs	target to target + 2g
Fat	target to target + 2g
Macros are only allowed to be over target (not under) by default.
(If you want “allow under” later, make it a setting, but default is strict.)

Seasoning Scaling Logic (Implementation detail)
// After protein grams are determined:
const chickenGrams = getGrams('chicken');
const seasoningRate = product.seasoning_rate_per_100g ?? 0;
const seasoningGrams = Math.round(chickenGrams * seasoningRate / 100);
Effective Eating Calculation (Implementation detail)
const effectiveGrams = weighedGrams * (product.eaten_factor ?? 1);
const macros = calculateMacrosForGrams(product, effectiveGrams);
UI shows weighed grams, totals use effective grams.

Best Result Selection (Implementation detail)
Track valid candidate plans and select best by:

lowest calorie overage

lowest macro overage

closest to default portion sizes

best balance score

Implementation Phases
Phase 1: Database Migration
Add new columns to products

Create meal_templates

Migrate existing data using current heuristics as initial defaults only

Phase 2: Update Product UI
Add fields: editable_mode, min/max/step, rounding_rule, eaten_factor, category

Add seasoning rate field for seasoning products

Phase 3: Rewrite Solver Core
Create src/lib/portioningEngine.ts

Implement deterministic optimisation loop (max 500 iters)

Implement strict tolerance checking (target to target+N only)

Add best-result tracking + selection

Phase 4: Integration
Replace calls to calculateDayPortions with new engine

Update debug logging

Wire failure reporting to UI

Deprecate autoPortioning.ts (keep for reference only)

Phase 5: Testing
Update/extend tests for:

strict tolerance rules

locked constraints

portion cap constraints

rounding conflicts

ratio constraint conflicts

Add bulk validation test harness (200–1000 runs)

Phase 6: Debug Panel
Add collapsible debug panel:

targets vs achieved

deltas

active constraints

failure reasons

Files to Create/Modify
File	Action	Purpose
supabase/migrations/xxx_meal_plan_v2.sql	CREATE	Schema changes
src/lib/portioningEngine.ts	CREATE	New solver implementation
src/lib/portioningEngine.test.ts	CREATE	New test suite
src/lib/portioningTypes.ts	CREATE	Type definitions
src/hooks/useProducts.ts	MODIFY	Add new fields
src/hooks/useMealPlanItems.ts	MODIFY	Use new engine
src/components/settings/ProductSettings.tsx	MODIFY	Add portion config UI
src/components/mealplan/DayDetailModal.tsx	MODIFY	Debug panel + failure UI
src/lib/autoPortioning.ts	DEPRECATE	Keep for reference only
Migration Strategy
Auto-migrate defaults based on existing heuristics (initial only)
Current detection	New values
Contains "yogurt/yoghurt"	category='dairy', min=100, max=350
Contains "granola/muesli"	category='carb', min=25, max=60
Contains "chicken/fish/salmon"	category='protein', min=100, max=300
Contains "rice/pasta"	category='carb', min=80, max=250
Contains "seasoning/schwartz"	category='seasoning', editable_mode='BOUNDED', max=15
Contains "broccoli/veg"	editable_mode='LOCKED'
Contains "cookie"	editable_mode='LOCKED'
Contains "hunters chicken pasta"	editable_mode='LOCKED'
Backwards compatibility mapping
Old product_type='fixed' → editable_mode='LOCKED'

Old product_type='editable' → editable_mode='FREE'

Test Harness Design
Bulk validation test should:

run 200–1000 scenarios

verify strict tolerances

group failures by reason

allow failures only for truly impossible scenarios

Example structure:

describe('Bulk Validation', () => {
  it('generates valid plans for 1000 random scenarios', () => {
    const failures: FailedScenario[] = [];

    for (let i = 0; i < 1000; i++) {
      const scenario = generateRandomScenario();
      const result = solve(scenario.items, scenario.targets);

      if (!result.success) failures.push({ scenario, result });
    }

    const byReason = groupBy(failures, f => f.result.failure.reason);
    console.table(byReason);

    // Allow up to 5% failure only for truly impossible scenarios
    expect(failures.length / 1000).toBeLessThan(0.05);
  });
});
Risk Mitigation
Risk	Mitigation
Breaking existing meal plans	Feature flag new engine during rollout; keep old solver for comparison only
Performance (500 iterations)	Benchmark; stop early when converged; optimise hotspots
User confusion from new fields	Hide advanced settings behind a toggle
Migration errors	Dry-run migration and validate outputs before applying
Success Criteria
Pass rate: >95% of generated plans hit all tolerances (only impossible cases fail)

No blank days: Always a valid plan or a clear failure reason

Performance: <200ms per day solve (benchmark target)

User experience: Portions are realistic; meals are balanced; seasonings scale correctly

Test coverage: All invariants verified via automated tests