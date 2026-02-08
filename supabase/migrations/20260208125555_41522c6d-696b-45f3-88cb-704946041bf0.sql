-- Part 1.1: Add investment link to transactions
ALTER TABLE public.transactions 
ADD COLUMN investment_account_id uuid REFERENCES public.investment_accounts(id) ON DELETE SET NULL;

-- Part 1.2: Add source_transaction_id to investment_transactions for safe linking
ALTER TABLE public.investment_transactions
ADD COLUMN source_transaction_id uuid UNIQUE REFERENCES public.transactions(id) ON DELETE SET NULL;

-- Part 1.3: Create service_payments table for Cheaper Bills payment history
CREATE TABLE public.service_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracked_service_id uuid NOT NULL REFERENCES public.tracked_services(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  payment_date date NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for service_payments
CREATE POLICY "Users can view own service payments" ON public.service_payments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own service payments" ON public.service_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own service payments" ON public.service_payments
  FOR DELETE USING (auth.uid() = user_id);

-- Prevent duplicate links (a transaction can only be linked to one service once)
CREATE UNIQUE INDEX service_payments_unique_link
ON public.service_payments (tracked_service_id, transaction_id)
WHERE transaction_id IS NOT NULL;

-- Part 3.1: Fix comparison_results upsert by adding unique constraint
CREATE UNIQUE INDEX comparison_results_user_provider_plan 
ON public.comparison_results (user_id, provider, plan_name) 
WHERE provider IS NOT NULL;