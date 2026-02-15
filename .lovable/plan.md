
# Codebase Audit Report

## Summary

After a thorough review of the codebase, I've identified issues across several categories: bugs, branding inconsistencies, dead code, type safety concerns, and UX improvements. Below is a prioritised list grouped by severity.

---

## Critical / Bugs

### 1. `/toiletries` route renders `Groceries` instead of `Toiletries`
**File:** `src/App.tsx` line 54
The route `/toiletries` renders `<Groceries />` instead of `<Toiletries />`. The `Toiletries` page component is imported but never used in routing. This means any link to `/toiletries` shows the wrong page entirely.

**Fix:** Change the route element from `<Groceries />` to `<Toiletries />`.

### 2. `Toiletries` import is unused in `App.tsx`
Related to the above -- the `Toiletries` import on line 15 is dead code since the route incorrectly uses `Groceries`.

---

## Branding Inconsistencies

### 3. Mobile nav still says "Life Tracker" instead of "Lifehub"
**File:** `src/components/layout/MobileNav.tsx` line 81
The desktop sidebar correctly says "Lifehub" but the mobile header still shows "Life Tracker".

### 4. Auth form still says "Life Tracker"
**File:** `src/components/auth/AuthForm.tsx` line 69
The login/signup card title reads "Life Tracker" -- should be "Lifehub" to match the landing page and sidebar.

### 5. Other "Life Tracker" references
- `src/index.css` line 5 -- CSS comment mentioning "Life Tracker Design System"
- `src/lib/billsCalculations.ts` line 233 -- iCal PRODID string referencing "Life Tracker"

These are less user-facing but should be updated for consistency.

---

## Type Safety

### 6. Widespread `(as any)` casting (357 occurrences across 32 files)
Notable problem areas:
- `src/pages/Bills.tsx` lines 29-32 -- `(bill as any).is_subscription` suggests the `is_subscription` column exists in the database but isn't reflected in the TypeScript types. This is likely a types file sync issue.
- `src/hooks/useBirthdayEvents.ts` -- casting insert payloads as `any`
- `src/hooks/useOnlineOrders.ts` -- casting insert/update payloads as `any`
- `src/lib/autoPortioning.ts` -- casting product fields (`meal_eligibility`, `day_eligibility`, `food_type`) as `any`

**Recommendation:** Most of these stem from the auto-generated Supabase types being out of sync with actual database columns. A types regeneration would resolve many. Others need proper type definitions.

---

## Dead / Unused Code

### 7. `Toiletries` page import unused
As noted in item 2 above.

### 8. No sidebar link to Toiletries
The sidebar and mobile nav have no link to the Toiletries page at all. It's only reachable via direct URL. If this is intentional (accessed as a tab within Shopping/Groceries), the standalone route and page may be unnecessary. If it should be reachable, it needs a nav entry.

---

## UX / Polish

### 9. `&amp;` displaying as literal text in Bills grocery forecast
**File:** `src/pages/Bills.tsx` line 117
The line `Estimated based on meal plan &amp; calorie targets` uses `&amp;` which will render as the literal string `&amp;` in JSX (since JSX auto-escapes). It should be `&` or `{"&"}`.

### 10. `syncBright(undefined as any)` called in two places
**File:** `src/components/settings/ServiceStatusSettings.tsx` lines 99 and 150
The smart meter sync function is called with `undefined as any` which masks a potential type mismatch. The function signature should be checked and the call corrected.

### 11. No delete confirmation on Products
**File:** `src/components/settings/ProductSettings.tsx` line 1281
Clicking the delete button on a product immediately deletes it with no confirmation dialog, unlike Bills, Toiletries, and other entities which all have confirmation dialogs.

---

## Proposed Fix Plan

### Phase 1 -- Critical (do first)
1. Fix `/toiletries` route to render `<Toiletries />` instead of `<Groceries />`
2. Fix `&amp;` literal in Bills page grocery forecast text

### Phase 2 -- Branding
3. Update MobileNav title from "Life Tracker" to "Lifehub"
4. Update AuthForm title from "Life Tracker" to "Lifehub"
5. Update CSS comment and iCal PRODID string

### Phase 3 -- Type Safety / Code Quality
6. Fix `syncBright(undefined as any)` calls to use correct arguments
7. Add delete confirmation dialog for Products (matching the pattern used by Toiletries and Bills)

### Phase 4 -- Optional / Lower Priority
8. Audit the 357 `as any` casts -- many would be resolved by regenerating Supabase types; remaining ones need proper type definitions
9. Decide whether the standalone `/toiletries` route should exist or if the page is only accessed as a tab within the Shopping section

---

## Technical Details

**Files to modify:**
- `src/App.tsx` -- fix toiletries route (line 54)
- `src/components/layout/MobileNav.tsx` -- rebrand to Lifehub (line 81)
- `src/components/auth/AuthForm.tsx` -- rebrand to Lifehub (line 69)
- `src/pages/Bills.tsx` -- fix `&amp;` entity (line 117)
- `src/components/settings/ServiceStatusSettings.tsx` -- fix `syncBright` calls (lines 99, 150)
- `src/components/settings/ProductSettings.tsx` -- add delete confirmation dialog
- `src/index.css` -- update comment (line 5)
- `src/lib/billsCalculations.ts` -- update PRODID (line 233)

**No database changes required.**
**No new dependencies required.**
