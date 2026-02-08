Part 1: Database changes
1.1 Transactions table: add investment link only
ALTER TABLE public.transactions
ADD COLUMN investment_account_id uuid
REFERENCES public.investment_accounts(id) ON DELETE SET NULL;


✅ Keep this because it’s a simple 1-to-1 relationship.

1.2 Investment transactions: make linking safe (no duplicates)

Add a direct link column so we can upsert and delete reliably:

ALTER TABLE public.investment_transactions
ADD COLUMN source_transaction_id uuid UNIQUE
REFERENCES public.transactions(id) ON DELETE SET NULL;

1.3 Cheaper Bills payments: use a proper linking table (remove tracked_service_id from transactions)

Create service_payments (this is the “link transaction → service” record + payment history):

CREATE TABLE public.service_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracked_service_id uuid NOT NULL REFERENCES public.tracked_services(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  payment_date date NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own service payments" ON public.service_payments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own service payments" ON public.service_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own service payments" ON public.service_payments
  FOR DELETE USING (auth.uid() = user_id);


Prevent duplicate links:

CREATE UNIQUE INDEX service_payments_unique_link
ON public.service_payments (tracked_service_id, transaction_id)
WHERE transaction_id IS NOT NULL;

Part 2: Transaction “Link to…” UX
2.1 TransactionList menu

Add “Link to…” → opens LinkTransactionDialog with tabs:

Bill (existing)

Investment (new)

Cheaper Bills Service (new)

2.2 Linking actions

Bill tab: existing bill_id update

Investment tab:

set transactions.investment_account_id = selected_id

upsert investment_transactions where source_transaction_id = transaction.id

amount/date/type from transaction

Service tab:

create service_payments row:

user_id

tracked_service_id

transaction_id = transaction.id

payment_date = transaction.transaction_date

amount = transaction.amount

2.3 Unlinking actions

Investment unlink

set transactions.investment_account_id = NULL

delete investment_transactions where source_transaction_id = transaction.id

Service unlink

delete the service_payments row (do not edit transaction)

Part 3: Cheaper Bills switching popup + link fix
3.1 Fix comparison_results upsert properly

If edge function does ON CONFLICT (user_id, provider, plan_name) then add the matching unique index:

CREATE UNIQUE INDEX comparison_results_user_provider_plan
ON public.comparison_results (user_id, provider, plan_name)
WHERE provider IS NOT NULL;

3.2 Confirm data actually exists + includes website_url

After scan runs, verify:

rows are inserted for that user_id

best result includes website_url (or equivalent)

UI query is filtering by user_id and service type/provider correctly

3.3 UI behaviour (must not be a dead button)

Add SwitchingPopupDialog that displays:

provider + plan

monthly/annual savings (if fields available)

“View deal” button:

if website_url exists → open it

if missing → show a message like “No switching link available for this deal”

Add clear empty state if there are no comparison_results yet (explain user needs to run scan)

Part 4: Types / queries
Transactions query include

investment join

bill join
(No need to join tracked_service on transactions if using service_payments)

New hook

useServicePayments(tracked_service_id)

list payments (including joined transaction basic fields)

create/delete payment link

Quick “is this what Jacob asked for” checklist

Link transactions to bills ✅

Link transactions to investments ✅ (safe, no duplicates)

Link transactions to cheaper bills ✅ (via payment history)

Switching popup shows info ✅

Switching popup has a working link ✅ (with fallback if missing)

No weird duplicate records ✅