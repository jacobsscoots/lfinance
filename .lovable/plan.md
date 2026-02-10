

## Plan: Investment Live Pricing, Yearly Planner, and Apple Transaction Notes

### 1. Live Investment Pricing (WisdomTree AI ETF)

**What changes**: Your investment page will show real daily values based on actual ETF prices instead of estimated compound growth. When you enter transactions (buys/sells with unit quantities), the system calculates your holdings and multiplies by the latest unit price.

**How it works**:
- A new backend function fetches the daily closing price for the WisdomTree AI ETF (ticker INTL on LSE, GBP-denominated) from Yahoo Finance's public endpoint
- The function runs when you open the Investments page (cached for 24 hours) and stores the latest price in the `investment_valuations` table
- A new `ticker_symbol` column on `investment_accounts` lets you assign a ticker to any investment (e.g. "INTL.L" for your ChipX AI Fund)
- A new `units` column on `investment_transactions` records how many shares/units each deposit or withdrawal represents
- Current value = units held x latest unit price
- Daily change shows yesterday's close vs today's close (real data, not estimated)

**Database changes**:
- Add `ticker_symbol` (text, nullable) to `investment_accounts`
- Add `units` (numeric, nullable) to `investment_transactions`

**New files**:
- `supabase/functions/fetch-etf-price/index.ts` -- edge function that calls Yahoo Finance API for a given ticker, returns latest price, and upserts into `investment_valuations`

**Modified files**:
- `src/hooks/useInvestments.ts` -- include `ticker_symbol` in type
- `src/hooks/useInvestmentTransactions.ts` -- include `units` in type and forms
- `src/hooks/useInvestmentValuations.ts` -- add a `fetchLatestPrice` function that calls the edge function
- `src/components/investments/InvestmentCard.tsx` -- use latest valuation price x total units instead of estimated compound growth
- `src/components/investments/ContributionFormDialog.tsx` -- add optional "units" field
- `src/components/investments/InvestmentFormDialog.tsx` -- add optional "ticker symbol" field
- `src/pages/Investments.tsx` -- trigger price fetch on load for investments with tickers; use real valuations in portfolio summary

---

### 2. Yearly Planner Page

**What it does**: A new "Yearly Planner" page showing a 12-month calendar-year grid (Jan-Dec 2026, extendable). Each month column shows:
- Expected income (from your payday settings / historical income transactions)
- Committed outgoings (auto-populated from your active bills and subscriptions, adjusted by frequency)
- Discretionary spend (from historical data for past months, editable forecast for future months)
- Net position (income minus total outgoings)
- Running surplus/deficit that carries forward month to month
- Colour-coded: green months are fine, amber months are tight, red months show a shortfall

This lets you spot problem months like December and plan savings in advance.

**Auto-population logic**:
- For past months: pull actual income and expense totals from the `transactions` table
- For future months: calculate expected bills by expanding each active bill's frequency across the year
- Income: use the most recent monthly income figure as a baseline (editable)
- Users can add manual overrides for any month (e.g. "Christmas spending +GBP200" in December)

**Database changes**:
- New table `yearly_planner_overrides`: stores user adjustments per month (user_id, year, month, label, amount, type: 'income'|'expense')
- RLS: users can only access their own rows

**New files**:
- `src/pages/YearlyPlanner.tsx` -- the main page with a responsive grid/table
- `src/hooks/useYearlyPlannerData.ts` -- fetches transactions, bills, and overrides; computes the 12-month grid
- `src/components/yearly-planner/MonthColumn.tsx` -- individual month card showing breakdown
- `src/components/yearly-planner/OverrideFormDialog.tsx` -- dialog to add/edit manual adjustments
- `src/components/yearly-planner/YearlySummaryBar.tsx` -- top-level summary (total income, total outgoings, net)

**Modified files**:
- `src/App.tsx` -- add route `/yearly-planner`
- `src/components/layout/AppSidebar.tsx` -- add "Yearly Planner" nav item (CalendarRange icon, under Bills section)
- `src/components/layout/MobileNav.tsx` -- add nav item

---

### 3. Apple Purchase Tracking

**The reality**: Apple does not provide a public API for purchase history. There is no way to programmatically pull your App Store, Apple Music, iCloud, etc. transactions.

**What we can do instead**: Since Apple charges show up on your bank statement as generic "APPLE.COM/BILL" transactions, we can add a feature to help you categorise them:
- When you see an Apple transaction in your transactions list, you can tag it with a sub-category (e.g. "iCloud Storage", "App Store", "Apple Music", "Apple TV+", "Apple One")
- A quick-tag dropdown appears for any transaction where the merchant contains "APPLE"
- Over time this builds a clear picture of where your Apple spending goes
- Auto-link known recurring amounts to the right subscription (e.g. GBP 6.99 = Apple Music)

**Modified files**:
- `src/components/transactions/TransactionList.tsx` -- detect Apple merchant and show quick-tag chips
- `src/hooks/useAutoLinkTransactions.ts` -- add Apple-specific matching rules for known subscription amounts

---

### Technical Summary

| Change | New Files | Modified Files | Migrations |
|--------|-----------|----------------|------------|
| Live ETF pricing | 1 edge function | 6 components/hooks | 1 (ticker + units columns) |
| Yearly Planner | 5 files (page + components + hook) | 3 (routing + nav) | 1 (overrides table) |
| Apple tagging | 0 | 2 | 0 |

