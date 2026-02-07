# Plan: Lower Seasoning Portions + Allow Granola up to 60g (Without Breaking Precision)

## ✅ IMPLEMENTED

### Changes Made

| Item Type | Before | After |
|---|---:|---:|
| Seasoning max | 30g | **15g** (hard cap) |
| Seasoning typical | up to 20g | **3–10g** |
| Granola max | 40g | **60g** (granola only) |
| Other toppers max | 40g | 40g (unchanged) |
| Sauces max | 30g | 30g (unchanged, NOT capped to 15g) |

### Implementation Details

1. **Added `isSeasoning()` helper** - Distinguishes seasonings (powders/rubs/spices) from sauces
2. **Added `isGranola()` helper** - Detects granola products for extended topper range
3. **Added constants**: `MAX_SEASONING_GRAMS = 15`, `DEFAULT_SEASONING_GRAMS = 8`, `MAX_GRANOLA_GRAMS = 60`
4. **Updated `SEASONING_PAIRINGS`** - All values now ≤10g (soy, teriyaki, bbq, honey reduced)
5. **Updated `getMaxPortion()`** - Seasonings get 15g cap; sauces keep 30g; granola gets 60g
6. **Updated `getItemConstraints()`** - Single source of truth for all constraints:
   - Seasonings: min 3g, max 15g
   - Granola toppers: min 25g, max 60g
   - Other toppers: min 25g, max 40g
7. **Updated `solveSimultaneous()`** - Granola can scale to 60g when needed for carb targets

### Tests Updated
- Seasoning test: asserts 3-15g range (was 5-30g)
- Added sauce regression test: confirms sauces NOT capped at 15g
- Updated granola test: allows up to 60g (was 40g)
- Added non-granola topper test: confirms 40g max still applies

### Validation ✅
- All 47 tests pass
- Seasonings stay within realistic 3-15g range
- Granola can extend to 60g when needed for carb targets
- Sauces are NOT accidentally capped
- Daily macros remain within ±1g tolerance
- Per-meal calories remain within ±15 kcal tolerance

---