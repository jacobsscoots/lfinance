

# Upgrade Dashboard to Payday-to-Payday Control Centre

## Overview

Transform the current light dashboard into an information-dense control centre that focuses on pay cycle health, forecasting, and actionable guidance. The layout will be 2-column with a main content area (runway, charts, bills) and a sidebar for alerts/actions.

## Layout Structure

```text
+-----------------------------------------------+
| Header: "Payday Control Centre"               |
| Cycle: 19 Jan → 18 Feb 2026  |  12 days left  |
+-----------------------------+-----------------+
| MAIN CONTENT (2/3)          | ALERTS (1/3)    |
|                             |                 |
| [Runway & Balance Widget]   | [Alerts Panel]  |
| - Days remaining            | - Overspend     |
| - Safe-to-spend/day         | - Runway risk   |
| - Balance timeline          | - Actions       |
| - Projections               |                 |
|                             | [Account List]  |
| [Charts Row]                | - Current bal   |
| - Spend pace line chart     | - Change since  |
| - Outgoings donut           |   payday        |
| - Net trend mini chart      |                 |
|                             |                 |
| [Budget Health Snapshot]    |                 |
| - Income | Committed |      |                 |
|   Discretionary | Buffer    |                 |
|                             |                 |
| [Upcoming Bills - Expanded] |                 |
| - Fixed bills section       |                 |
| - Subscriptions section     |                 |
| - Variable bills section    |                 |
| - Totals: 7 days / cycle    |                 |
+-----------------------------+-----------------+
```

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/hooks/usePayCycleData.ts` | Central hook for all pay-cycle calculations |
| `src/lib/dashboardCalculations.ts` | Pure functions for runway, projections, alerts |
| `src/lib/dashboardCalculations.test.ts` | Tests for calculation functions |
| `src/components/dashboard/RunwayBalanceCard.tsx` | Key widget with balance timeline |
| `src/components/dashboard/SpendPaceChart.tsx` | Cumulative spend vs pace line chart |
| `src/components/dashboard/OutgoingsBreakdownChart.tsx` | Donut: Bills vs Other |
| `src/components/dashboard/NetTrendChart.tsx` | Mini line: last 6 cycles |
| `src/components/dashboard/BudgetHealthCard.tsx` | Income/Committed/Discretionary/Buffer |
| `src/components/dashboard/UpcomingBillsExpanded.tsx` | Bills with sections + risk flag |
| `src/components/dashboard/AlertsPanel.tsx` | Smart alerts with actions |
| `src/components/dashboard/AccountsOverview.tsx` | Compact account balances |

### Modified Files

| File | Changes |
|------|---------|
| `src/pages/Dashboard.tsx` | New 2-column layout, wire up all new components |
| `src/hooks/useDashboardData.ts` | Add new queries for historical cycles |

## Technical Implementation

### 1. Pay Cycle Data Hook (`usePayCycleData.ts`)

Central hook that calculates all pay-cycle metrics:

```typescript
interface PayCycleData {
  // Cycle info
  cycleStart: Date;
  cycleEnd: Date;
  daysTotal: number;
  daysRemaining: number;
  daysPassed: number;

  // Balances
  startBalance: number;      // Balance at cycle start (or first transaction)
  currentBalance: number;    // Current total balance
  projectedEndBalance: number;

  // Spending
  totalSpent: number;
  expectedSpentByNow: number;  // Linear pace
  safeToSpendPerDay: number;
  
  // Committed vs discretionary
  committedRemaining: number;  // Bills/subs still due this cycle
  discretionaryRemaining: number;
  bufferAmount: number;

  // Flags
  isOverPace: boolean;
  runwayRisk: boolean;  // Low runway after committed
  
  // Daily breakdown for charts
  dailySpending: { date: string; actual: number; expected: number }[];
}
```

Calculations:
- `startBalance`: Sum of account balances + all spending - all income since cycle start
- `committedRemaining`: Sum of all bills/subscriptions due in remaining days of cycle
- `discretionaryRemaining`: `currentBalance - committedRemaining`
- `safeToSpendPerDay`: `discretionaryRemaining / daysRemaining`
- `projectedEndBalance`: Based on current pace extrapolation
- `runwayRisk`: True if `discretionaryRemaining < (daysRemaining * 10)` or similar threshold

### 2. Dashboard Calculations (`dashboardCalculations.ts`)

Pure functions for testability:

```typescript
// Runway calculations
export function calculateSafeToSpend(
  currentBalance: number,
  committedRemaining: number,
  daysRemaining: number
): number;

export function calculateProjectedEndBalance(
  currentBalance: number,
  spentSoFar: number,
  daysPassed: number,
  daysRemaining: number,
  committedRemaining: number
): { best: number; expected: number; worst: number };

// Alert generation
export function generateAlerts(
  data: PayCycleData,
  upcomingBills: BillOccurrence[]
): Alert[];

// Historical cycle comparison
export function calculateNetPosition(
  income: number,
  expenses: number
): number;
```

### 3. Runway & Balance Card (`RunwayBalanceCard.tsx`)

Key visual showing:
- Large "X days remaining" display
- "Safe to spend: £X/day" with color coding (green/amber/red)
- Balance timeline mini-visual:
  ```
  [Start £2,450] ----●---- [Now £1,823] -------- [End ~£450]
  ```
- Projection band (best/worst case)
- Warning banner if unknown data (accounts not connected)

### 4. Charts Implementation

**Spend Pace Chart** (Line chart using Recharts):
- X-axis: Days of cycle (1, 2, 3...)
- Y-axis: Cumulative £
- Two lines: Actual cumulative spend, Expected linear pace
- Shaded area between them (green if under, red if over)

**Outgoings Breakdown** (Donut chart):
- Two segments: "Bills & Subscriptions" vs "Other Spending"
- Center shows total spent this cycle
- Legend with amounts

**Net Trend** (Mini line chart):
- Last 6 pay cycles (or placeholder if not enough data)
- Each point = income - expenses for that cycle
- Visual shows trajectory (improving/declining)

### 5. Budget Health Snapshot (`BudgetHealthCard.tsx`)

Four-column stat display:

```
| Income     | Committed  | Discretionary | Buffer  |
| £2,450.00  | £892.00    | £931.00       | £521.00 |
| Received   | Bills left | Left to spend | Leftover|
```

- Income: Sum of income transactions this cycle
- Committed: Sum of bills/subscriptions remaining
- Discretionary: Current balance - committed
- Buffer: Projected end balance if zero discretionary spend

### 6. Expanded Upcoming Bills (`UpcomingBillsExpanded.tsx`)

Sections with collapsible groups:
- **Fixed Bills** (bill_type = 'fixed', is_subscription = false)
- **Subscriptions** (is_subscription = true)
- **Variable Bills** (is_variable = true) - shows "~£X (est.)"

Summary boxes:
- "Due next 7 days: £X"
- "Due rest of cycle: £X"
- Risk flag if: `committedRemaining > discretionaryRemaining`

### 7. Alerts Panel (`AlertsPanel.tsx`)

Smart alerts generated from data:

```typescript
type Alert = {
  type: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  action?: {
    label: string;
    description: string;
  };
};
```

Examples:
- **Overspending**: "You're £54 over pace. Reduce daily spend to £18/day to finish on target."
- **Runway Risk**: "After upcoming bills, you'll have £120 discretionary for 12 days (£10/day)"
- **Large Bill Coming**: "Council Tax (£142) due in 3 days"
- **Positive**: "On track! £24 below expected spend"

Each alert has a suggested action where applicable.

### 8. Accounts Overview (`AccountsOverview.tsx`)

Compact list showing:
```
Current Account    £1,823.45    -£626.55
Savings           £3,240.00    +£0.00
```
- Account name
- Current balance
- Change since cycle start (green/red)
- Respects `is_hidden` flag
- "Some accounts not synced" warning if applicable

## Data Flow

```text
Dashboard.tsx
    │
    ├── usePayCycleData()
    │   ├── usePaydaySettings() → cycle dates
    │   ├── useAccounts() → balances
    │   ├── useTransactions(cycle range) → spending
    │   └── useBillsInCycle() → committed
    │
    ├── useHistoricalCycles() → net trend
    │
    └── Components render with data
```

## Handling Missing Data

Each component will gracefully handle missing data:

```typescript
// Example in RunwayBalanceCard
if (!hasAccounts) {
  return <WarningCard message="Connect an account to see runway" />;
}

if (isLoading) {
  return <Skeleton />;
}
```

For historical charts:
- If < 2 cycles of data: Show "Building history..." placeholder
- If < 6 cycles: Show available data with note

## Tests to Add

`src/lib/dashboardCalculations.test.ts`:

```typescript
describe('calculateSafeToSpend', () => {
  it('returns positive when balance exceeds committed', () => {});
  it('returns 0 when balance equals committed', () => {});
  it('handles 0 days remaining', () => {});
});

describe('calculateProjectedEndBalance', () => {
  it('projects based on current spending pace', () => {});
  it('accounts for committed spending', () => {});
  it('best case assumes zero additional spend', () => {});
});

describe('generateAlerts', () => {
  it('generates overspend warning when over pace', () => {});
  it('generates runway risk when low discretionary', () => {});
  it('generates positive alert when under budget', () => {});
});
```

## Mobile Responsiveness

On mobile (< md breakpoint):
- Single column layout
- Alerts panel moves below main content
- Charts stack vertically
- Accounts overview collapses to summary

## Implementation Order

1. Create `dashboardCalculations.ts` + tests (pure logic first)
2. Create `usePayCycleData.ts` hook
3. Create `RunwayBalanceCard` (key widget)
4. Create `BudgetHealthCard`
5. Create `UpcomingBillsExpanded`
6. Create `AlertsPanel` + `AccountsOverview`
7. Create charts (`SpendPaceChart`, `OutgoingsBreakdownChart`, `NetTrendChart`)
8. Update `Dashboard.tsx` with new layout
9. Add historical cycles query to `useDashboardData.ts`
10. Final testing and polish

## Guardrails Respected

- No changes to meal planning or macro solver code
- No mutations to transaction data (read-only computations)
- Dashboard computes derived values only
- Existing pay cycle logic in `payday.ts` and `payCycle.ts` unchanged
- Existing bills logic in `billOccurrences.ts` unchanged

