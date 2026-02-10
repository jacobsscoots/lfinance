

## Plan: Custom Projections, Service Status Page, Nav Redesign, and Net Worth Tracker

### 1. Customisable Projection Periods (Investments)

**What changes**: Replace the hardcoded "3 Months / 6 Months / 1 Year" projection grid with user-editable time periods. Each of the 3 columns will have a small dropdown or input allowing you to pick from options like 1m, 3m, 6m, 1y, 2y, 3y, 5y, 10y.

**How it works**:
- Add local state in `ProjectionCard` for the 3 selected periods (defaulting to 3, 6, 12 months)
- Replace the static labels with a small Select dropdown per column offering: 1m, 3m, 6m, 1y, 2y, 3y, 5y, 10y
- The `calculateProjectionScenarios` function already accepts any month count, so no calculation changes needed
- The projections object becomes dynamic based on the 3 selected values

**File**: `src/components/investments/ProjectionCard.tsx`

---

### 2. Service Status Page (Settings)

**What changes**: A new "Services" tab in Settings showing the connection status of all external integrations in one place, with quick-action buttons.

**Services to display**:
- **Bank Connections (TrueLayer)** -- uses `useBankConnections` hook: shows connected banks count, last sync time, status
- **Gmail** -- uses `useGmailConnection` hook: connected/disconnected, email address, last sync
- **Smart Meter (Bright/Hildebrand)** -- uses `useBrightConnection` hook: connected/expired/disconnected
- **Bill Comparison Scanner** -- uses `useBillsScanner` hook: last scan date, services tracked count
- **Live Pricing (Yahoo Finance)** -- static info card showing it's used for investment tickers

**Each service card shows**:
- Service name and icon
- Status badge (Connected / Disconnected / Error / Expired) with colour coding
- Last synced/scanned timestamp
- Quick action button (Connect / Sync / View Settings)

**Files**:
- New file: `src/components/settings/ServiceStatusSettings.tsx`
- Modified: `src/pages/Settings.tsx` -- add "Services" tab with Activity icon

---

### 3. Redesigned Navigation Bar

**What changes**: Group navigation items under collapsible section headers to reduce visual clutter. Instead of 13 flat links, organise into 5 groups with subtle section labels. The sidebar will feel cleaner while keeping everything accessible.

**New structure**:
```text
[Dashboard]                    (always visible, top-level)

MONEY
  Accounts
  Transactions
  Debt Tracker

BILLS
  Bills
  Cheaper Bills
  Yearly Planner

INVESTMENTS
  Investments
  Net Worth          (new -- see item 4)

LIFESTYLE
  Calendar
  Groceries
  Meal Plan
  Toiletries

[Settings]                     (always visible, bottom area)
```

**Design details**:
- Section headers are small, uppercase, muted-grey text (like "MONEY", "BILLS") with no click interaction
- Dashboard stays at the very top as the primary landing page
- Settings stays pinned to the bottom footer area (already is)
- Same changes mirrored in `MobileNav.tsx`

**Files**:
- `src/components/layout/AppSidebar.tsx`
- `src/components/layout/MobileNav.tsx`

---

### 4. Net Worth Tracker

**What changes**: A new page that aggregates your total financial position across all account types into a single view.

**How it works**:
- **Data sources** (all already exist in the app):
  - Bank accounts: from `useAccounts` hook (current/savings balances)
  - Investments: from `useInvestments` + live prices (portfolio value)
  - Debts: from `useDebts` hook (outstanding balances as liabilities)
- **No new database tables needed** -- this is a read-only aggregation view

**Page layout**:
- **Net Worth headline**: Total Assets minus Total Liabilities, large prominent number
- **Breakdown cards**: Assets card (bank accounts + investments) and Liabilities card (debts)
- **Accounts list**: Each account/investment/debt shown with its current balance and a green/red indicator
- **Net Worth trend chart**: Using a Recharts line chart. Data points calculated from existing account balance history, investment valuations, and debt payment records over time

**Database consideration**: The schema already supports future net worth tracking (per memory note). For the initial version, we will calculate net worth on-the-fly from current balances. A `net_worth_snapshots` table can be added later for historical tracking if needed.

**Files**:
- New file: `src/pages/NetWorth.tsx`
- New file: `src/hooks/useNetWorthData.ts` -- aggregates data from useAccounts, useInvestments, useDebts
- Modified: `src/App.tsx` -- add `/net-worth` route
- Modified: `src/components/layout/AppSidebar.tsx` -- already covered in nav redesign (item 3)
- Modified: `src/components/layout/MobileNav.tsx` -- already covered in nav redesign (item 3)

---

### Technical Summary

| Change | Files | Type |
|--------|-------|------|
| Custom projection periods | `ProjectionCard.tsx` | Modify |
| Service status page | `ServiceStatusSettings.tsx` (new), `Settings.tsx` | New + Modify |
| Nav redesign (grouped sections) | `AppSidebar.tsx`, `MobileNav.tsx` | Modify |
| Net Worth page | `NetWorth.tsx` (new), `useNetWorthData.ts` (new), `App.tsx` | New + Modify |

