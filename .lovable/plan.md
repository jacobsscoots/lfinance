

## Plan: Three Improvements

### 1. Fix "View Best Deal" 404 Link (Cheaper Bills)

**Problem**: The Octopus Energy "View Best Deal" button links to `https://octopus.energy/dashboard/new-quote/` which returns a 404.

**Fix**: Update the `PROVIDER_URLS` map in the `compare-energy-deals` edge function to use a working URL: `https://octopus.energy/smart/flexible-octopus/`. Also update the `LastScanCard` component so the "View Best Deal" button opens the `SwitchingPopupDialog` (with full details and working link) instead of navigating directly to a potentially broken URL.

**Files**:
- `supabase/functions/compare-energy-deals/index.ts` -- update the Octopus Energy URL
- `src/components/cheaper-bills/LastScanCard.tsx` -- open switching dialog instead of direct link

---

### 2. Broadband Comparisons with Speed and Contract Length (Cheaper Bills)

**Problem**: Broadband deals are compared on price only; speed and contract length are stored in `features` but not shown or factored in.

**Fix**:
- **Service form**: Add optional `current_speed_mbps` and `contract_length_months` fields to the broadband service form so users can record their current speed and contract preference.
- **Database**: Add `current_speed_mbps` (integer, nullable) and `preferred_contract_months` (integer, nullable) columns to `tracked_services`.
- **Edge function**: Update `scanBroadbandDeals` to accept and use current speed + preferred contract length. Only recommend plans that match or exceed the user's current speed. Penalise longer contracts or highlight no-contract flexibility. Show speed and contract info in comparison reason text.
- **UI**: Show speed (e.g., "132 Mbps") and contract length (e.g., "18 months") in the `ScanResultsPanel` and `SwitchingPopupDialog` for broadband results.

**Files**:
- Migration: add columns to `tracked_services`
- `src/components/cheaper-bills/ServiceFormDialog.tsx` -- conditional speed/contract fields for broadband
- `src/hooks/useTrackedServices.ts` -- update interface
- `supabase/functions/compare-energy-deals/index.ts` -- update `scanBroadbandDeals` to filter by speed and factor contract
- `src/components/cheaper-bills/ScanResultsPanel.tsx` -- show speed/contract badges
- `src/components/cheaper-bills/SwitchingPopupDialog.tsx` -- show speed/contract in details

---

### 3. Daily Budget Tracker on Bills Page

**Problem**: The user has a GBP 15/day discretionary budget concept and wants to see on the Bills page how actual daily spending tracks against it -- including accumulated surplus/deficit over time.

**Fix**: Add a "Daily Budget Tracker" card at the top of the Bills page that shows:
- The daily budget amount (GBP 15, configurable via a setting or hardcoded initially)
- How many days into the current pay cycle
- Total budget available so far (GBP 15 x days elapsed)
- Total discretionary spend so far (transactions minus committed bills/subs)
- Surplus or deficit (green/red) -- e.g., "You have GBP 23 extra saved up" or "You're GBP 12 over budget"
- A mini progress bar or simple visual

This uses existing data from `usePayCycleData` which already calculates `safeToSpendPerDay`, `totalSpent`, `daysPassed`, etc. The GBP 15 daily budget will be stored in `user_payday_settings` as a new `daily_budget` column (default 15).

**Files**:
- Migration: add `daily_budget` column to `user_payday_settings` (numeric, default 15)
- `src/hooks/usePaydaySettings.ts` -- include `daily_budget` in types/defaults
- `src/components/bills/DailyBudgetCard.tsx` -- new component showing the tracker
- `src/pages/Bills.tsx` -- integrate the card above the bill list
- `src/components/settings/PaydaySettings.tsx` -- add field to configure the daily budget amount

---

### 4. Fix Build Error (send-bills-notification)

**Problem**: `npm:resend@2.0.0` import syntax doesn't work in the Deno edge function environment.

**Fix**: Change `import { Resend } from "npm:resend@2.0.0"` to `import { Resend } from "https://esm.sh/resend@2.0.0"`.

**File**: `supabase/functions/send-bills-notification/index.ts`

---

### Technical Summary

| Change | Files Modified | Files Created |
|--------|---------------|---------------|
| Fix Octopus 404 | edge function, LastScanCard | -- |
| Broadband speed/contract | edge function, ServiceFormDialog, ScanResultsPanel, SwitchingPopupDialog, useTrackedServices | 1 migration |
| Daily budget tracker | Bills.tsx, usePaydaySettings, PaydaySettings | DailyBudgetCard.tsx, 1 migration |
| Fix build error | send-bills-notification/index.ts | -- |

