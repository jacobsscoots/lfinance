# Plan: Lower Seasoning Portions + Allow Granola up to 60g (Without Breaking Precision)

## Problem Summary
From the screenshot, dinner includes:
- **Chicken seasoning at 30g** (unrealistic; should be single-digit grams)
Breakfast includes:
- **Granola at 37g**, and current max can limit flexibility when carbs/calories need topping up.

## Goals
1. **Seasonings** must be realistic:
   - Target range: **3–10g**
   - Hard cap: **15g max**
   - Seasonings must **never** be used as a macro/calorie adjustment knob.
2. **Granola topper** can increase up to **60g IF needed** to hit targets, while keeping breakfast proportional.
3. Do **not** change sauce behavior (only seasonings).
4. Keep existing invariants:
   - Integer grams only
   - Daily macros within **±1g**
   - Per-meal calorie split within current tolerance

---

## Current Constraints (Issues)

| Item Type | Current Max | Problem |
|---|---:|---|
| Seasonings (powders/rubs/spices) | 30g | Allows ridiculous portions |
| Granola topper | 40g | Can be too restrictive when needing extra carbs/calories |
| Sauces | (varies) | Must NOT be forced down to 15g |

---

## Solution

### Change 1: Cap SEASONINGS ONLY (not sauces)
**Important:** Do NOT use `isSauceOrSeasoning()` for the 15g cap, because that would cap sauces too.

#### A) Add an `isSeasoning(product)` helper (or equivalent)
Seasonings are typically powders/rubs/spice mixes. Detect via:
- `product.food_type === "seasoning"` if available, OR
- name includes: `"seasoning"`, `"rub"`, `"spice"`, `"powder"`, `"mix"`, `"marinade mix"` (your list), OR
- maintain a small allowlist for known brands (e.g., Schwartz seasoning) if needed.

#### B) Update seasoning portion logic
- Pairing map grams must all be **≤ 10g**
- Default seasoning grams: **6–8g**
- Hard cap: **15g max** (no exceptions)
- Seasonings remain excluded from:
  - meal calorie balancer “adjustable” list
  - macro precision loops / fine tune

---

### Change 2: Allow GRANOLA up to 60g (not all toppers)
Granola specifically can go to **60g** when needed, but other toppers should keep the original cap (e.g., 40g) unless explicitly allowed.

Implement:
- If breakfast role is `topper` AND `isGranola(product)` (name contains “granola” or product subtype), then:
  - min 25g, max 60g
- If topper but NOT granola:
  - keep existing cap (e.g., max 40g)

---

## Technical Implementation

### File: `src/lib/autoPortioning.ts`

#### 1) Add constants
- `MAX_SEASONING_GRAMS = 15`
- `DEFAULT_SEASONING_GRAMS = 8`
- `MAX_GRANOLA_GRAMS = 60`

#### 2) Update `SEASONING_PAIRINGS`
Ensure every entry `grams` is **≤ 10g**.

#### 3) Update `getSeasoningPortion()` (seasonings only)
Return a paired value (≤10g) or default (8g), then cap to **≤15g**.

#### 4) Update constraints in a SINGLE SOURCE OF TRUTH
Inside `getItemConstraints(...)` (preferred) or wherever constraints live:
- If `isSeasoning(product)`:
  - min 3g, max 15g
- If breakfast role `topper` and `isGranola(product)`:
  - min 25g, max 60g
- If breakfast role `topper` and NOT granola:
  - keep existing topper max (e.g., 40g)
- Do NOT cap sauces here unless you explicitly want to later.

#### 5) Do NOT cap sauces in `getMaxPortion()`
If `getMaxPortion()` currently uses `isSauceOrSeasoning(product)`, change it so:
- seasonings use 15g cap
- sauces use existing logic (leave unchanged)

#### 6) Solver behavior after lowering seasoning
After seasoning is reduced, any calorie/macro gap must be filled by real foods (rice/chicken/etc), not seasonings.

---

## Tests: `src/lib/autoPortioning.test.ts`

### Update seasoning test bounds
- Assert seasoning grams are **>= 3g and <= 15g**

### Add granola-specific range test
- Granola can reach **<= 60g**
- Add one more test that a NON-granola topper still respects its original max (e.g., <= 40g)

### Optional regression test (recommended)
- A sauce item (e.g., passata / curry sauce) should NOT be forced to <= 15g just because it’s a “sauce”.

---

## Expected Results

| Item Type | Before | After |
|---|---:|---:|
| Seasoning max | 30g | 15g |
| Seasoning typical | up to 20g | 3–10g |
| Granola max | 40g | 60g (granola only) |
| Other toppers max | 40g | 40g (unchanged) |

For your example:
- Seasoning should drop from 30g to ~6–10g
- Remaining calories/macros should be rebalanced into rice/chicken (or other proper items)

---

## Validation Checklist
1. Run `vitest` and confirm all tests pass
2. Generate Monday dinner: seasoning should be **3–15g**
3. Generate Monday breakfast: granola can rise to **60g** if needed
4. Confirm daily macros stay within **±1g**
5. Confirm per-meal calories stay within the configured tolerance
6. Confirm sauces are not accidentally capped to 15g

---

All seasoning/granola constraint clamping must occur before the final global precision loop, and no later step (UI formatting, validation, or post-processing) may mutate grams after precision completes; seasonings must remain excluded from all balancing/precision adjustment lists so macro drift cannot reappear

---