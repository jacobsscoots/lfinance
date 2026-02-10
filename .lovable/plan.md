

## Plan: Auto-Sync Indicator, Page-Load Sync, and Yearly Planner Income Breakdown

### 1. Auto-Sync Status Indicator on Bank Connections Card

**What changes**: The Bank Connections card will show a live countdown timer ("Next sync in 4:32") and a subtle pulsing animation when a background sync is running.

**How it works**:
- The `useBankConnections` hook will be updated to expose two new pieces of state: `isSyncing` (boolean, true while background auto-sync runs) and `lastAutoSyncAt` (timestamp of last completed auto-sync)
- The `BankConnectionCard` will display a small status bar at the bottom showing:
  - When idle: "Auto-syncing every 5 min -- Next in X:XX" with a countdown timer
  - When syncing: "Syncing..." with a spinning RefreshCw icon and a subtle purple pulse animation on the card border
- The countdown is calculated from `lastAutoSyncAt + 5 minutes` vs `now`, updated every second via a local `setInterval`

**Files modified**:
- `src/hooks/useBankConnections.ts` -- expose `isSyncing` and `lastAutoSyncAt` state
- `src/components/accounts/BankConnectionCard.tsx` -- add auto-sync status bar with countdown timer and sync animation

---

### 2. Sync on Page Load (Accounts Page)

**What changes**: When you open the Accounts page, all connected banks will immediately sync, in addition to the existing 5-minute interval.

**How it works**:
- The `useBankConnections` hook will expose the `autoSync` function
- The `Accounts.tsx` page will call `autoSync()` once on mount (using a ref guard to prevent double-firing in React StrictMode)
- This is a silent sync (no toast), same as the interval-based one

**Files modified**:
- `src/hooks/useBankConnections.ts` -- expose `autoSync` in the return object
- `src/pages/Accounts.tsx` -- call `autoSync()` on mount

---

### 3. Yearly Planner: Income Breakdown Toggle

**What changes**: An eye icon button next to the "Income" row label in the detailed table. Clicking it expands the income row into a breakdown showing individual income sources (from transaction data for past months, or the projected average for future months).

**How it works**:
- For past/current months: group income transactions by merchant/description to show where income came from (e.g., "Employer Name: GBP2,400", "Side Hustle: GBP300")
- For future months: show the projected average as a single "Projected Income" line
- Income override rows already exist and will continue to display separately
- The eye icon toggles between collapsed (single "Income" row showing totals) and expanded (individual income source rows)
- State is local to the component (no database change needed)

**Data source**: The `useYearlyPlannerData` hook already fetches all transactions for the year. We will add income grouping logic to extract unique income sources and their monthly amounts.

**Files modified**:
- `src/hooks/useYearlyPlannerData.ts` -- add `incomeBreakdown` to the return: a map of income source name to per-month amounts
- `src/components/yearly-planner/DetailedYearlyTable.tsx` -- add eye icon toggle on Income row, render expanded income source rows when toggled

---

### 4. Fix Bill Frequency Display in Yearly Planner

**Investigation**: The Dentist bill is correctly stored as "biannual" (every 6 months) with a start date of May 2026. The `getBillOccurrencesForMonth` function correctly handles biannual frequency and should only place the dentist in May and November 2026.

**What I will do**: Add a small frequency badge (e.g., "6mo", "Yr", "2wk") next to each bill name in the detailed table so you can instantly verify the frequency is correct. If a bill genuinely appears in the wrong months, this will make the discrepancy immediately obvious and actionable (you can edit the bill's frequency from the Bills page). I will also double-check the rendering to ensure no bills are incorrectly duplicated across months.

**Files modified**:
- `src/components/yearly-planner/DetailedYearlyTable.tsx` -- add frequency badge next to bill names, verify month-cell rendering

---

### Technical Summary

| Change | Files Modified |
|--------|---------------|
| Auto-sync indicator + countdown | `useBankConnections.ts`, `BankConnectionCard.tsx` |
| Sync on page load | `useBankConnections.ts`, `Accounts.tsx` |
| Income breakdown toggle | `useYearlyPlannerData.ts`, `DetailedYearlyTable.tsx` |
| Bill frequency badges | `DetailedYearlyTable.tsx` |

