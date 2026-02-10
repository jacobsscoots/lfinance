

## Plan: Fix 4 Issues

### 1. Fix Upcoming Bills Showing Wrong Due Dates (Dashboard)

**Problem**: The `getBillOccurrenceInRange` function in `usePayCycleData.ts` (line 75-97) is too simplistic. It only checks the bill's `due_day` in the current or next month, ignoring the bill's actual `frequency`. So a yearly bill like "Snapchat Premium" (due in December) gets placed in the current month because its `due_day` falls within the pay cycle range, even though it shouldn't recur until December 2026.

**Fix**: Replace `getBillOccurrenceInRange` with the existing, properly-tested `generateBillOccurrences` function from `src/lib/billOccurrences.ts`, which correctly handles all frequencies (weekly, fortnightly, monthly, quarterly, biannual, yearly) and respects start/end dates.

**File**: `src/hooks/usePayCycleData.ts`
- Remove the inline `getBillOccurrenceInRange` helper (lines 75-97)
- Import `generateBillOccurrences` from `@/lib/billOccurrences`
- Replace the `upcomingBills` mapping (lines 177-184) to use `generateBillOccurrences(bill, today, cycle.end)` instead, which returns only the occurrences that genuinely fall within the remaining cycle window

---

### 2. Fix Gmail Button Still Showing "Coming Soon" (Transactions)

**Problem**: The Gmail button in `TransactionFilters.tsx` (line 316) is hardcoded as disabled with "Coming Soon" text. It never checks whether Gmail is actually connected.

**Fix**: Import `useGmailConnection` and conditionally render either a "Sync Receipts" button (if connected) or a "Connect Gmail" button (if not connected, linking to the OAuth flow).

**File**: `src/components/transactions/TransactionFilters.tsx`
- Import `useGmailConnection` hook
- Replace the static disabled button (lines 305-326) with conditional rendering:
  - If connected: Show "Sync Receipts" button that triggers `sync()`, with a "Connected" badge and last-synced timestamp
  - If not connected: Show "Connect Gmail" button that triggers `connect()` (no longer disabled, no "Coming Soon")

---

### 3. Add MyProtein to Email Order Parsers

**Problem**: The `RETAILER_DOMAINS` map in `emailOrderParsers.ts` doesn't include MyProtein, so order confirmation emails from MyProtein are not detected.

**Fix**: Add MyProtein's domain to the retailer detection map.

**File**: `src/lib/emailOrderParsers.ts`
- Add `"myprotein.com": "MyProtein"` and `"myprotein.co.uk": "MyProtein"` to the `RETAILER_DOMAINS` object

---

### 4. Sort Bills by Importance in Yearly Planner

**Problem**: Bills in the `DetailedYearlyTable` are listed in whatever order they come from the database, not by importance (rent first, then utilities, then subscriptions, etc.).

**Fix**: Add a priority-based sort to the `billRows` array in `DetailedYearlyTable.tsx`. Bills will be sorted by:
1. Category-based priority (Rent/Mortgage at top, then Council Tax, Utilities, Insurance, Transport, then everything else, with subscriptions at bottom)
2. Amount descending within each priority tier (highest cost bills first)

**File**: `src/components/yearly-planner/DetailedYearlyTable.tsx`
- Add a `BILL_PRIORITY` map that assigns priority numbers based on bill name keywords and category
- Sort `billRows` by priority tier first, then by total amount descending

---

### Technical Summary

| Issue | File(s) | Change |
|-------|---------|--------|
| Upcoming bills wrong dates | `usePayCycleData.ts` | Use `generateBillOccurrences` instead of broken inline helper |
| Gmail "Coming Soon" | `TransactionFilters.tsx` | Check connection status, show Sync/Connect accordingly |
| MyProtein not detected | `emailOrderParsers.ts` | Add domain to retailer map |
| Yearly Planner bill sort | `DetailedYearlyTable.tsx` | Sort by category priority, then amount |

