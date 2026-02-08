-- Create debt_type enum values as text check
-- Table: debts
CREATE TABLE public.debts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  creditor_name TEXT NOT NULL,
  debt_type TEXT NOT NULL CHECK (debt_type IN ('credit_card', 'loan', 'overdraft', 'bnpl', 'other')),
  starting_balance NUMERIC NOT NULL,
  current_balance NUMERIC NOT NULL,
  apr NUMERIC,
  interest_type TEXT NOT NULL DEFAULT 'apr' CHECK (interest_type IN ('apr', 'fixed', 'none')),
  promo_end_date DATE,
  min_payment NUMERIC,
  due_day INTEGER CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31)),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_date DATE,
  closed_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- RLS policies for debts
CREATE POLICY "Users can view own debts" ON public.debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own debts" ON public.debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debts" ON public.debts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own debts" ON public.debts FOR DELETE USING (auth.uid() = user_id);

-- Table: debt_payments
CREATE TABLE public.debt_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT NOT NULL DEFAULT 'normal' CHECK (category IN ('normal', 'extra', 'fee', 'refund', 'adjustment')),
  principal_amount NUMERIC,
  interest_amount NUMERIC,
  fee_amount NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for debt_payments
CREATE POLICY "Users can view own debt payments" ON public.debt_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own debt payments" ON public.debt_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debt payments" ON public.debt_payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own debt payments" ON public.debt_payments FOR DELETE USING (auth.uid() = user_id);

-- Table: debt_transactions (standalone transactions for matching)
CREATE TABLE public.debt_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  transaction_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  account_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.debt_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for debt_transactions
CREATE POLICY "Users can view own debt transactions" ON public.debt_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own debt transactions" ON public.debt_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debt transactions" ON public.debt_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own debt transactions" ON public.debt_transactions FOR DELETE USING (auth.uid() = user_id);

-- Table: debt_payment_transactions (many-to-many link)
CREATE TABLE public.debt_payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  payment_id UUID NOT NULL REFERENCES public.debt_payments(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.debt_transactions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (payment_id, transaction_id)
);

-- Enable RLS
ALTER TABLE public.debt_payment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for debt_payment_transactions
CREATE POLICY "Users can view own payment transaction links" ON public.debt_payment_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own payment transaction links" ON public.debt_payment_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own payment transaction links" ON public.debt_payment_transactions FOR DELETE USING (auth.uid() = user_id);

-- Table: debt_balance_snapshots
CREATE TABLE public.debt_balance_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  balance NUMERIC NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'statement', 'import')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.debt_balance_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS policies for debt_balance_snapshots
CREATE POLICY "Users can view own debt snapshots" ON public.debt_balance_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own debt snapshots" ON public.debt_balance_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debt snapshots" ON public.debt_balance_snapshots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own debt snapshots" ON public.debt_balance_snapshots FOR DELETE USING (auth.uid() = user_id);

-- Table: debt_attachments
CREATE TABLE public.debt_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('debt', 'payment', 'transaction')),
  owner_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.debt_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for debt_attachments
CREATE POLICY "Users can view own debt attachments" ON public.debt_attachments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own debt attachments" ON public.debt_attachments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own debt attachments" ON public.debt_attachments FOR DELETE USING (auth.uid() = user_id);

-- Table: debt_settings
CREATE TABLE public.debt_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  monthly_budget NUMERIC,
  preferred_strategy TEXT NOT NULL DEFAULT 'avalanche' CHECK (preferred_strategy IN ('avalanche', 'snowball')),
  reminder_days_before INTEGER NOT NULL DEFAULT 3,
  no_payment_days_threshold INTEGER NOT NULL DEFAULT 45,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.debt_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for debt_settings
CREATE POLICY "Users can view own debt settings" ON public.debt_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own debt settings" ON public.debt_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debt settings" ON public.debt_settings FOR UPDATE USING (auth.uid() = user_id);

-- Create trigger for updated_at on debts
CREATE TRIGGER update_debts_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on debt_payments
CREATE TRIGGER update_debt_payments_updated_at
  BEFORE UPDATE ON public.debt_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on debt_settings
CREATE TRIGGER update_debt_settings_updated_at
  BEFORE UPDATE ON public.debt_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for debt attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('debt-attachments', 'debt-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for debt-attachments bucket
CREATE POLICY "Users can view own debt attachments storage"
ON storage.objects FOR SELECT
USING (bucket_id = 'debt-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own debt attachments storage"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'debt-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own debt attachments storage"
ON storage.objects FOR DELETE
USING (bucket_id = 'debt-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);