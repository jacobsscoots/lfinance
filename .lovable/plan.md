
# Plan: Investments Page + Gmail Receipt Integration

## Overview

This plan covers two major features:
1. **Investments Page** - Track investments (specifically ChipX AI Fund) with manual entry, projections, and daily valuations
2. **Gmail Receipt Integration** - Automatically scan Gmail for receipts and match them to transactions

---

## Part 1: Investments Page

### 1.1 Navigation Update

Add "Investments" to the navigation in both sidebar and mobile nav:
- **Files**: `src/components/layout/AppSidebar.tsx`, `src/components/layout/MobileNav.tsx`
- **Route**: `/investments` in `src/App.tsx`
- **Icon**: `TrendingUp` or `PieChart` from lucide-react

### 1.2 Database Schema

Create 4 new tables to store investment data:

**Table: `investment_accounts`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| name | text | e.g., "ChipX AI Fund" |
| provider | text | e.g., "Chip" |
| fund_type | text | "etf", "fund", "stocks" |
| start_date | date | When investment started |
| expected_annual_return | numeric | User's growth assumption (default 8%) |
| compounding_method | text | "daily" or "monthly" |
| risk_preset | text | "conservative", "medium", "aggressive" |
| notes | text | Optional |
| status | text | "active", "closed" |
| created_at, updated_at | timestamp | Auto |

**Table: `investment_transactions`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| investment_account_id | uuid | FK to investment_accounts |
| transaction_date | date | When deposit/withdrawal occurred |
| type | text | "deposit", "withdrawal", "fee", "dividend" |
| amount | numeric | Positive = inflow, negative = outflow |
| is_recurring | boolean | If this is a recurring contribution |
| recurring_frequency | text | "weekly", "monthly" (nullable) |
| notes | text | Optional |
| created_at, updated_at | timestamp | Auto |

**Table: `investment_valuations`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| investment_account_id | uuid | FK to investment_accounts |
| valuation_date | date | The date of this value |
| value | numeric | Total value on this date |
| source | text | "manual", "estimated", "live" |
| created_at | timestamp | Auto |

**Table: `investment_settings`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Owner (unique constraint) |
| default_expected_return | numeric | Default 8% |
| show_projections | boolean | Toggle projections display |
| projection_range_months | integer | 12 by default |
| created_at, updated_at | timestamp | Auto |

### 1.3 ChipX Import Detection (Quick Fail)

ChipX does not provide a public API or Open Banking access for investment data. The implementation will:
1. Show "Import from Chip" button that opens a dialog
2. Dialog explains that direct import isn't available
3. Automatically switches to manual entry mode with pre-filled defaults:
   - Fund name: "ChipX AI Fund"
   - Provider: "Chip"

### 1.4 Manual Investment Setup

**New Component: `InvestmentFormDialog.tsx`**

Form fields:
- Fund name (default: "ChipX AI Fund")
- Provider (default: "Chip")
- Start date (date picker)
- Initial lump sum (optional number input)
- Recurring contribution amount (optional)
- Recurring frequency (weekly/monthly dropdown)
- Expected annual return % (default 8%)
- Risk preset (conservative 5% / medium 8% / aggressive 12%)
- Notes (textarea)

**New Component: `ContributionFormDialog.tsx`**

For adding ad-hoc deposits/withdrawals/fees:
- Date
- Amount
- Type (deposit/withdrawal/fee/dividend)
- Notes

**CSV Import for Contributions**

Add a "Import CSV" button that accepts:
```csv
date,amount,type
2025-01-15,500.00,deposit
2025-02-15,500.00,deposit
```

Parser in `src/lib/investmentCsvParser.ts`

### 1.5 Daily Balance & Projections

**Valuation Logic (Priority Order)**

1. **Manual Entry**: User can log actual portfolio value on any date
2. **Estimated Value**: When no manual entry exists, calculate using:
   ```
   estimated_value = total_contributions * (1 + daily_rate)^days_since_start
   
   daily_rate = (1 + annual_return)^(1/365) - 1
   ```

**Projection Features**

New component: `InvestmentProjections.tsx`
- Editable expected annual return %
- Preset buttons: Conservative (5%), Medium (8%), Aggressive (12%)
- Display projected values at:
  - 3 months
  - 6 months
  - 12 months
- Show contribution totals vs growth totals
- Optional: Best-case/worst-case range (±2% from expected)

**Daily Valuation Calculation**

Utility in `src/lib/investmentCalculations.ts`:
- `calculateDailyValues(contributions, startDate, expectedReturn)` - Returns array of daily estimated values
- `calculateProjection(currentValue, expectedReturn, months)` - Returns future projected value
- `calculateContributionTotal(transactions)` - Sum of all deposits minus withdrawals

### 1.6 Investment Page Layout

**File: `src/pages/Investments.tsx`**

```text
+--------------------------------------------------+
|  Investments                     [+ Add Investment]
|--------------------------------------------------+
|  Portfolio Summary Card                          |
|  +------------+  +-------------+  +-------------+|
|  | Total      |  | Current     |  | Total       ||
|  | Invested   |  | Value       |  | Return      ||
|  | £5,000     |  | £5,450      |  | +£450 (9%)  ||
|  +------------+  +-------------+  +-------------+|
|  | Daily Change: +£12.50 (+0.23%)               ||
+--------------------------------------------------+
|  Holdings Table                                  |
|  [ChipX AI Fund] [Chip] [£5,450] [+9%] [Actions]|
+--------------------------------------------------+
|  Performance Chart                               |
|  [1W] [1M] [3M] [6M] [1Y] [ALL]                 |
|  ~~~~~~~~~~~~ (line chart) ~~~~~~~~~~~          |
|  Legend: — Actual  ··· Estimated  --- Projected |
+--------------------------------------------------+
|  Contributions List                              |
|  [15 Jan 2025] [Deposit] [+£500] [Initial]     |
|  [15 Feb 2025] [Deposit] [+£500] [Monthly]     |
|  [Add Contribution] [Import CSV]                |
+--------------------------------------------------+
```

### 1.7 Performance Chart

**Component: `InvestmentPerformanceChart.tsx`**

Using Recharts (already installed):
- Time range buttons: 1W, 1M, 3M, 6M, 1Y, ALL
- Line types:
  - **Solid line**: Actual manual-entered values
  - **Dotted line**: Estimated daily values (interpolated)
  - **Dashed line**: Future projections
- Clear visual distinction with legend

---

## Part 2: Gmail Receipt Integration

### 2.1 Important Note on OAuth

Gmail integration requires Google OAuth with the `gmail.readonly` scope. This project uses Lovable Cloud authentication, which supports Google OAuth for sign-in. However, Gmail API access requires additional scopes beyond basic sign-in.

**Approach**: Create a dedicated Gmail connection flow that:
1. Uses Google OAuth with extended scopes (gmail.readonly)
2. Stores the refresh token securely in the database
3. Edge function handles token refresh and API calls

### 2.2 Database Schema for Gmail

**Table: `gmail_connections`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Owner (unique) |
| email | text | Connected Gmail address |
| access_token | text | Encrypted short-lived token |
| refresh_token | text | Encrypted refresh token |
| token_expires_at | timestamp | When access token expires |
| last_synced_at | timestamp | Last successful sync |
| status | text | "active", "error", "revoked" |
| created_at, updated_at | timestamp | Auto |

**Table: `gmail_receipts`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| gmail_connection_id | uuid | FK to gmail_connections |
| message_id | text | Gmail message ID (unique) |
| subject | text | Email subject |
| from_email | text | Sender email |
| received_at | timestamp | When email was received |
| merchant_name | text | Extracted merchant |
| amount | numeric | Extracted amount (nullable) |
| order_reference | text | Order/invoice number (nullable) |
| attachment_path | text | Path in storage bucket (nullable) |
| attachment_type | text | "pdf", "image", or null |
| match_status | text | "matched", "pending", "no_match", "review" |
| matched_transaction_id | uuid | FK to transactions (nullable) |
| match_confidence | text | "high", "medium", "low" |
| matched_at | timestamp | When match was made |
| created_at | timestamp | Auto |

**Table: `gmail_sync_settings`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Owner (unique) |
| auto_attach | boolean | Default true |
| scan_days | integer | Default 30 |
| allowed_domains | text[] | Optional domain whitelist |
| created_at, updated_at | timestamp | Auto |

**Table: `gmail_match_log`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | Owner |
| receipt_id | uuid | FK to gmail_receipts |
| transaction_id | uuid | FK to transactions |
| action | text | "auto_matched", "manual_matched", "rejected" |
| match_reasons | jsonb | Array of reason strings |
| created_at | timestamp | Auto |

### 2.3 Edge Function: `gmail-oauth`

Handles the OAuth flow:
1. Generate OAuth URL with gmail.readonly scope
2. Handle callback with authorization code
3. Exchange code for tokens
4. Store encrypted tokens in database

### 2.4 Edge Function: `gmail-sync-receipts`

Main sync function:
1. Refresh access token if expired
2. Search Gmail for receipt-like emails:
   - Keywords: "receipt", "order confirmation", "invoice", "thank you for your order", "payment received"
   - Common senders: Amazon, Tesco, PayPal, etc.
   - Date range: Last X days (from settings)
3. For each matching email:
   - Extract merchant name from sender/subject
   - Extract amount using regex patterns
   - Extract order reference
   - Download PDF/image attachments
   - Store in `gmail_receipts` table
4. Run matching algorithm against transactions
5. Auto-attach high-confidence matches
6. Mark medium-confidence as "review"

### 2.5 Receipt Matching Algorithm

**File: `src/lib/receiptMatcher.ts`**

Matching criteria (similar to existing `transactionMatcher.ts`):

| Factor | Score |
|--------|-------|
| Exact amount match | +40 |
| Amount within ±£0.50 | +25 |
| Same day | +30 |
| Within 1-3 days | +15-25 |
| Merchant name match | +30 |
| Same payment method (if detectable) | +10 |

Confidence levels:
- **High** (score >= 80): Auto-attach
- **Medium** (score >= 50): Mark for review
- **Low** (score < 50): No match

**Edge Cases Handled**:
- Duplicate emails: Track message_id to prevent re-processing
- Split payments: Flag if amount partially matches
- Multiple same-amount transactions: Mark as "review" instead of auto-matching
- Currency differences: Only match GBP amounts
- Partial refunds: Detect "refund" in subject, don't auto-match

### 2.6 UI Components for Gmail Integration

**Settings Tab: `GmailSettings.tsx`**

Add to Settings page:
- Connect/Disconnect Gmail button
- Connection status display
- Toggle: Auto-attach receipts ON/OFF
- Slider: Scan last X days (7-90)
- Optional: Allowed sender domains list
- View sync log button

**Transaction List Enhancement**

Modify `TransactionList.tsx`:
- Show "Receipt attached" badge with paperclip icon
- "View" button opens receipt preview
- If no receipt but potential matches exist: "Find Receipt" action
- Dropdown action: "Match Receipt Manually"

**New Component: `ReceiptMatchDialog.tsx`**

For manual matching and review:
- Shows transaction details
- Lists potential receipts with match scores
- Preview receipt attachment
- Confirm match or dismiss

**New Component: `ReceiptReviewPanel.tsx`**

For reviewing medium-confidence matches:
- List of receipts pending review
- Side-by-side: receipt info + suggested transaction
- Accept/Reject buttons
- Bulk actions

### 2.7 Trigger on Open Banking Sync

When `truelayer-sync` pulls new transactions:
1. After successful sync, trigger receipt matching
2. Add to existing edge function or create separate trigger
3. Only match transactions without existing receipts

---

## Part 3: Implementation Order

### Phase 1: Investments Page (Core)
1. Create database tables (migration)
2. Add navigation items
3. Create hooks: `useInvestments.ts`, `useInvestmentTransactions.ts`
4. Build page layout with summary card
5. Implement `InvestmentFormDialog.tsx`
6. Implement `ContributionFormDialog.tsx`

### Phase 2: Investments (Calculations & Charts)
7. Create `investmentCalculations.ts` utility
8. Build `InvestmentPerformanceChart.tsx`
9. Implement projections display
10. Add CSV import for contributions

### Phase 3: Gmail Integration (Foundation)
11. Create Gmail database tables (migration)
12. Build `gmail-oauth` edge function
13. Create `GmailSettings.tsx` component
14. Add Gmail tab to Settings page

### Phase 4: Gmail Integration (Sync & Match)
15. Build `gmail-sync-receipts` edge function
16. Create `receiptMatcher.ts` utility
17. Update `TransactionList.tsx` with receipt badges
18. Create `ReceiptMatchDialog.tsx`
19. Create `ReceiptReviewPanel.tsx`

### Phase 5: Polish & Integration
20. Connect Gmail sync to Open Banking trigger
21. Add audit logging
22. Test all edge cases
23. Mobile optimization

---

## Technical Details

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/Investments.tsx` | Main investments page |
| `src/hooks/useInvestments.ts` | Investment accounts CRUD |
| `src/hooks/useInvestmentTransactions.ts` | Contributions CRUD |
| `src/hooks/useInvestmentValuations.ts` | Valuations CRUD |
| `src/hooks/useGmailConnection.ts` | Gmail OAuth state |
| `src/hooks/useGmailReceipts.ts` | Receipt sync & matching |
| `src/lib/investmentCalculations.ts` | Projection math |
| `src/lib/investmentCsvParser.ts` | CSV import |
| `src/lib/receiptMatcher.ts` | Receipt matching algorithm |
| `src/components/investments/InvestmentFormDialog.tsx` | Add/edit investment |
| `src/components/investments/InvestmentCard.tsx` | Single holding display |
| `src/components/investments/ContributionFormDialog.tsx` | Add contribution |
| `src/components/investments/ContributionList.tsx` | Transaction history |
| `src/components/investments/InvestmentPerformanceChart.tsx` | Chart component |
| `src/components/investments/ProjectionCard.tsx` | Projections display |
| `src/components/investments/CsvImportDialog.tsx` | CSV upload |
| `src/components/settings/GmailSettings.tsx` | Gmail connection settings |
| `src/components/transactions/ReceiptBadge.tsx` | Receipt status badge |
| `src/components/transactions/ReceiptMatchDialog.tsx` | Manual matching |
| `supabase/functions/gmail-oauth/index.ts` | OAuth handler |
| `supabase/functions/gmail-sync-receipts/index.ts` | Receipt sync |

### Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add /investments route |
| `src/components/layout/AppSidebar.tsx` | Add Investments nav item |
| `src/components/layout/MobileNav.tsx` | Add Investments nav item |
| `src/pages/Settings.tsx` | Add Gmail tab |
| `src/components/transactions/TransactionList.tsx` | Add receipt badges & actions |
| `supabase/config.toml` | Add new edge functions |
| `supabase/functions/truelayer-sync/index.ts` | Trigger receipt matching |

---

## Storage Requirements

Create a new private storage bucket:
- **Bucket name**: `gmail-receipts`
- **Public**: No
- **File path format**: `{user_id}/{receipt_id}.{ext}`
- **Allowed types**: PDF, JPG, PNG, WebP

---

## Security Considerations

1. **Gmail tokens**: Store encrypted, refresh automatically
2. **RLS policies**: All new tables have user_id-based policies
3. **Edge functions**: Verify JWT before processing
4. **Attachments**: Private bucket with signed URLs
5. **Match logging**: Full audit trail for transparency
