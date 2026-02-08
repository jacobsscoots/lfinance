# Transaction Linking + Cheaper Bills Switching - IMPLEMENTED ✅

## Part 1: Database changes ✅

### 1.1 Transactions table: add investment link
```sql
ALTER TABLE public.transactions
ADD COLUMN investment_account_id uuid
REFERENCES public.investment_accounts(id) ON DELETE SET NULL;
```

### 1.2 Investment transactions: make linking safe (no duplicates)
```sql
ALTER TABLE public.investment_transactions
ADD COLUMN source_transaction_id uuid UNIQUE
REFERENCES public.transactions(id) ON DELETE SET NULL;
```

### 1.3 Cheaper Bills payments: service_payments table
```sql
CREATE TABLE public.service_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracked_service_id uuid NOT NULL REFERENCES public.tracked_services(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  payment_date date NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS policies added
-- Unique constraint on (tracked_service_id, transaction_id) added
```

### 1.4 Comparison results fix
```sql
CREATE UNIQUE INDEX comparison_results_user_provider_plan
ON public.comparison_results (user_id, provider, plan_name)
WHERE provider IS NOT NULL;
```

---

## Part 2: Transaction "Link to…" UX ✅

### 2.1 TransactionList menu
- Added "Link to..." menu item in transaction row dropdown
- Opens `LinkTransactionDialog` with three tabs

### 2.2 LinkTransactionDialog component
- **Bill tab**: Links/unlinks bill_id on transaction
- **Investment tab**: 
  - Sets transactions.investment_account_id
  - Upserts investment_transactions with source_transaction_id
- **Service tab**:
  - Creates service_payments row

### 2.3 Unlinking
- Investment: Clears investment_account_id and deletes linked investment_transaction
- Service: Deletes the service_payments row

---

## Part 3: Cheaper Bills switching popup ✅

### 3.1 SwitchingPopupDialog component
- Shows provider, plan, monthly/annual savings
- "View Deal" button opens website_url
- Fallback message if no URL available

### 3.2 ServiceCard integration
- "View details" link appears when recommendation is "switch"
- Opens SwitchingPopupDialog with best offer details

---

## Part 4: Types / queries ✅

### Transactions query
- Now includes investment join: `investment:investment_accounts(id, name)`
- Badge displays on transaction row when linked

### New hook: useServicePayments
- Lists payments for a tracked service
- Create/delete payment links
- Joins transaction basic fields

---

## Files Created
- `src/hooks/useServicePayments.ts`
- `src/components/transactions/LinkTransactionDialog.tsx`
- `src/components/cheaper-bills/SwitchingPopupDialog.tsx`

## Files Modified
- `src/hooks/useTransactions.ts` - Added investment to type and query
- `src/components/transactions/TransactionList.tsx` - Added Link menu item and badges
- `src/components/cheaper-bills/ServiceCard.tsx` - Added switching popup integration

---

## Summary
✅ Link transactions to bills (existing, enhanced)
✅ Link transactions to investments (with contribution creation)
✅ Link transactions to cheaper bills services (via payment history)
✅ Switching popup shows deal info
✅ Switching popup has working link (with fallback)
✅ No duplicate records (unique constraints)
