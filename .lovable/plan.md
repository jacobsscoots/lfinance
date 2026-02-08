Build Debt Tracker Module (Full Spec + Implementation Plan)

Build a new Debt Tracker module inside my LifeHub web app. It must track debts, balances, payments, attachable transactions, balance snapshots, reminders/alerts, payoff planning (Avalanche/Snowball), graphs, CSV import/export, and a printable report. Keep UI modern, clean, fast, and consistent with existing patterns in the app.

Core Goals

Track multiple debts (credit cards, loans, overdraft, BNPL, other)

Log payments and automatically reflect balance changes

Attach and match transactions to payments (with CSV import + suggested matches)

Correct/confirm balances using snapshots (statement-based accuracy)

Visualize progress with charts and projections

Plan payoff order and debt-free date using strategies

Show reminders for due payments, promo expiries, and overdue items

1) Navigation + Page Structure

Add a new sidebar item: Debt Tracker (Wallet2 icon).

Use a single route with tabs (like existing Bills/Investments), to keep it clean:

Overview (Dashboard)

Debts

Payments

Transactions

Reports (Payoff plan + exports + printable report)

Route:

/debt-tracker

2) Database Schema (must implement)

Create these tables/collections with user scoping.

Table: debts

id uuid PK

user_id uuid (RLS)

creditor_name text (required)

debt_type text enum: credit_card | loan | overdraft | bnpl | other

starting_balance numeric (required)

current_balance numeric (required)

apr numeric nullable

interest_type text enum: apr | fixed | none

promo_end_date date nullable (for 0% ending)

min_payment numeric nullable

due_day integer nullable (1–31) OR due_date date nullable (support both if easy)

status text enum: open | closed

opened_date date nullable

closed_date date nullable

notes text nullable

created_at timestamptz default now()

updated_at timestamptz default now()

Table: debt_payments

id uuid PK

user_id uuid (RLS)

debt_id uuid FK -> debts.id

payment_date date (required)

amount numeric (required)

category text enum: normal | extra | fee | refund | adjustment

principal_amount numeric nullable

interest_amount numeric nullable

fee_amount numeric nullable

notes text nullable

created_at timestamptz

updated_at timestamptz

Table: debt_transactions

Standalone transactions (manual or CSV import):

id uuid PK

user_id uuid (RLS)

transaction_date date

amount numeric

description text

reference text nullable

account_name text nullable

created_at timestamptz

Table: debt_payment_transactions (many-to-many link)

id uuid PK

user_id uuid (RLS)

payment_id uuid FK -> debt_payments.id

transaction_id uuid FK -> debt_transactions.id

created_at timestamptz
Add unique constraint on (payment_id, transaction_id).

Table: debt_balance_snapshots

Manual balance corrections:

id uuid PK

user_id uuid (RLS)

debt_id uuid FK -> debts.id

snapshot_date date

balance numeric

source text enum: manual | statement | import

notes text nullable

created_at timestamptz

Table: debt_attachments

File attachments for debt/payment/transaction:

id uuid PK

user_id uuid (RLS)

owner_type text enum: debt | payment | transaction

owner_id uuid

file_path text

filename text

created_at timestamptz

Table: debt_settings

User prefs:

id uuid PK

user_id uuid UNIQUE

monthly_budget numeric nullable

preferred_strategy text enum: avalanche | snowball

reminder_days_before integer default 3

no_payment_days_threshold integer default 45

created_at timestamptz

updated_at timestamptz

3) Security (RLS Policies)

Enable RLS on all above tables.
Policies (standard user-scoped):

SELECT/INSERT/UPDATE/DELETE: auth.uid() = user_id

4) UI Requirements (Modern + Simple)
Overview Tab (Dashboard)

Top summary cards:

Total remaining balance (sum open debts)

Total minimum payments per month

Next payment due (soonest upcoming due across open debts)

Estimated interest this month (if APR exists)

Estimated debt-free date (projection from monthly budget or payment history)

Graphs with date range filter chips: [1M] [3M] [6M] [1Y] [ALL]

Total Balance Over Time (line)

Balance by Debt (stacked area or multi-line)

Payments per Month (bar)

Interest vs Principal per Month (stacked bar: if split exists, otherwise estimate or hide)

Alerts card:

Payment due soon (within reminder_days_before)

Payment overdue (past due and no payment logged for that month)

Promo ending soon (promo_end_date within 30 days)

No recent payment (no payment in last threshold days)

Quick actions:

Add Debt

Log Payment

Add Transaction / Import CSV

Run Payoff Plan

Debts Tab

List view (cards or table) with filters:

Filters: Status (open/closed), Type, Sort (highest APR, highest balance, next due)
Each debt shows:

Creditor name + type

Current balance / starting balance

APR (if exists)

Minimum payment + due day/date (if exists)

Progress bar: % paid
Actions: View, Edit, Log Payment

Debt detail panel/page:

Summary fields + promo info

Notes timeline + attachments

Balance trend chart (this debt)

Payment history table (this debt)

Actions: Log payment / Add fee or adjustment / Add snapshot

Payments Tab

Payments list with filters:

date range

debt

category

matched / unmatched
Each row shows:

Date, amount, debt, category

Split fields (if entered)

Notes indicator

Attachment indicator

Matched status + linked transaction count

Log Payment dialog:
Required: debt, date, amount
Optional: category, notes, principal/interest/fee split, attachments, link transactions

Balance update rules:

Default: subtract payment amount from current_balance

If category is fee or adjustment, allow adding to balance (user chooses +/− or the category defines it)

If category is refund, add back to balance unless user toggles “not applied to debt”

Always allow manual correction via snapshot later

Transactions Tab

Transactions can be:

added manually

imported via CSV (simple parser + mapping step)

Transaction fields:

date, amount, description, reference, account_name, attachments

Matching UI:

Payment can link to 1+ transactions (many-to-many)

Suggested matches logic:

same amount (within £0.01)

date within ±3 days

optional keyword match against creditor name

Status badges:

Matched ✅ (linked)

Needs review ⚠️ (suggested matches exist)

Unmatched ❌ (no links)

Allow manual attach/detach at any time.

Reports Tab

Payoff plan tool + exports.

Payoff plan inputs:

monthly_budget (from settings)

strategy: Avalanche / Snowball

Outputs:

Payoff order list

Estimated payoff date per debt

Debt-free date

Interest saved vs other strategy (if APR data exists)

Monthly schedule table (month + allocation per debt)

Exports:

CSV export of payments + transactions (include matched status)

Printable “Debt Report” view (looks good when printed/saved as PDF): summary + debt list + charts + payoff schedule + payment history

5) Calculations (must be correct)
Total Balance

sum(current_balance) across open debts.

Progress %

(starting_balance - current_balance) / starting_balance * 100
Guard divide-by-zero.

Monthly interest estimate

If APR exists:
current_balance * (apr/100/12) summed across debts.

Balance history for charts

Prefer snapshots for historical points.
If no snapshot in a range, derive best-effort from:
starting_balance + adjustments - payments over time.

Debt-free projection

Use:

monthly_budget if set, else average monthly payments from last 90 days.
Apply minimum payments across all open debts and allocate extra based on selected strategy.
If APR missing, treat as 0 for projection and show “APR missing – estimate may be low”.

6) Technical Implementation (Files + Hooks + Components)

Create/modify files consistent with existing code patterns.

Page

src/pages/DebtTracker.tsx
Main tabs page: Overview/Debts/Payments/Transactions/Reports

Hooks (CRUD)

src/hooks/useDebts.ts

src/hooks/useDebtPayments.ts

src/hooks/useDebtTransactions.ts

src/hooks/useDebtPaymentTransactions.ts

src/hooks/useDebtSnapshots.ts

src/hooks/useDebtSettings.ts

src/hooks/useDebtAttachments.ts

Use TanStack Query patterns consistent with existing app, and invalidate caches properly so UI never shows stale totals.

Components

src/components/debt/DebtSummaryCards.tsx

src/components/debt/DebtCharts.tsx

src/components/debt/DebtBalanceChart.tsx

src/components/debt/DebtStackedBalanceChart.tsx

src/components/debt/DebtPaymentsChart.tsx

src/components/debt/DebtInterestChart.tsx

src/components/debt/DebtAlertsCard.tsx

src/components/debt/DebtList.tsx

src/components/debt/DebtCard.tsx

src/components/debt/DebtDetailPanel.tsx

src/components/debt/DebtFormDialog.tsx

src/components/debt/DeleteDebtDialog.tsx

src/components/debt/PaymentList.tsx

src/components/debt/PaymentFormDialog.tsx

src/components/debt/TransactionList.tsx

src/components/debt/TransactionFormDialog.tsx

src/components/debt/TransactionCsvImport.tsx

src/components/debt/TransactionMatcher.tsx

src/components/debt/SnapshotFormDialog.tsx

src/components/debt/PayoffPlanCard.tsx

src/components/debt/DebtFilters.tsx

Utilities

src/lib/debtCalculations.ts
(progress, interest estimate, projections, payoff schedule)

src/lib/debtCsvParser.ts
(parse CSV, basic validation, mapping)

Modify

src/App.tsx add route /debt-tracker

src/components/layout/AppSidebar.tsx add nav item

src/components/layout/MobileNav.tsx add nav item

Tech notes:

Charts use Recharts (same pattern as app)

Forms use react-hook-form + zod validation (same pattern)

Date formatting uses date-fns (same pattern)

Attachments stored in Supabase storage bucket: debt-attachments

7) Matching Logic (implementation requirement)

Suggested matches for a payment:

amount matches within £0.01

date within ±3 days

optional keyword match: creditor_name contained in transaction description

Statuses:

Matched: linked transactions exist

Needs review: at least 1 suggested match exists but not linked

Unmatched: no linked transactions and no suggestions

8) Validation + UX polish

Prevent accidental negative balances unless user confirms (allow if it’s a credit balance)

Empty states on all tabs

Tooltips where needed (APR, projection assumptions, snapshot priority)

Fast modals, clean spacing, consistent styling

All charts and totals update immediately after any CRUD action

9) Implementation Order (build in this sequence)

DB migrations + RLS

Hooks (debts/payments/settings)

Base UI (route + tabs + layout)

Debts CRUD + Debts tab

Payments logging + balance update rules

Overview summary cards

Core charts (balance trend + payments/month)

Transactions CRUD + CSV import

Matching UI + status logic

Balance snapshots + historical preference

Payoff planner + reports + exports

Alerts logic + final polish

10) Testing Checklist (must do)

Create sample data (3–5 debts, 10+ payments, 10+ transactions, a few snapshots) and verify:

Dashboard totals match sums

Balances update correctly per payment categories

Snapshots override history points correctly

Matching suggestions appear and can be overridden

Charts update after edits without refresh

Alerts show correctly (due soon/overdue/promo/no recent payment)

Payoff plan produces sensible payoff schedule and debt-free date

CSV import/export works, printable report looks good