-- ===========================================
-- INVESTMENT TABLES
-- ===========================================

-- Investment accounts (funds, portfolios)
CREATE TABLE public.investment_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  provider TEXT,
  fund_type TEXT DEFAULT 'fund',
  start_date DATE NOT NULL,
  expected_annual_return NUMERIC DEFAULT 8,
  compounding_method TEXT DEFAULT 'daily',
  risk_preset TEXT DEFAULT 'medium',
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.investment_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies for investment_accounts
CREATE POLICY "Users can view own investment accounts"
ON public.investment_accounts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own investment accounts"
ON public.investment_accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investment accounts"
ON public.investment_accounts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own investment accounts"
ON public.investment_accounts FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_investment_accounts_updated_at
BEFORE UPDATE ON public.investment_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Investment transactions (deposits, withdrawals, fees, dividends)
CREATE TABLE public.investment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  investment_account_id UUID NOT NULL REFERENCES public.investment_accounts(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  type TEXT NOT NULL DEFAULT 'deposit',
  amount NUMERIC NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurring_frequency TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for investment_transactions
CREATE POLICY "Users can view own investment transactions"
ON public.investment_transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own investment transactions"
ON public.investment_transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investment transactions"
ON public.investment_transactions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own investment transactions"
ON public.investment_transactions FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_investment_transactions_updated_at
BEFORE UPDATE ON public.investment_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Investment valuations (daily/manual balance snapshots)
CREATE TABLE public.investment_valuations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  investment_account_id UUID NOT NULL REFERENCES public.investment_accounts(id) ON DELETE CASCADE,
  valuation_date DATE NOT NULL,
  value NUMERIC NOT NULL,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(investment_account_id, valuation_date)
);

-- Enable RLS
ALTER TABLE public.investment_valuations ENABLE ROW LEVEL SECURITY;

-- RLS policies for investment_valuations
CREATE POLICY "Users can view own investment valuations"
ON public.investment_valuations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own investment valuations"
ON public.investment_valuations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investment valuations"
ON public.investment_valuations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own investment valuations"
ON public.investment_valuations FOR DELETE
USING (auth.uid() = user_id);

-- Investment settings (per-user defaults)
CREATE TABLE public.investment_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  default_expected_return NUMERIC DEFAULT 8,
  show_projections BOOLEAN DEFAULT true,
  projection_range_months INTEGER DEFAULT 12,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.investment_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for investment_settings
CREATE POLICY "Users can view own investment settings"
ON public.investment_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own investment settings"
ON public.investment_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own investment settings"
ON public.investment_settings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own investment settings"
ON public.investment_settings FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_investment_settings_updated_at
BEFORE UPDATE ON public.investment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- GMAIL INTEGRATION TABLES
-- ===========================================

-- Gmail connections (OAuth tokens)
CREATE TABLE public.gmail_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies for gmail_connections
CREATE POLICY "Users can view own gmail connections"
ON public.gmail_connections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own gmail connections"
ON public.gmail_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gmail connections"
ON public.gmail_connections FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gmail connections"
ON public.gmail_connections FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_gmail_connections_updated_at
BEFORE UPDATE ON public.gmail_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Gmail receipts (extracted from emails)
CREATE TABLE public.gmail_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  gmail_connection_id UUID REFERENCES public.gmail_connections(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  subject TEXT,
  from_email TEXT,
  received_at TIMESTAMP WITH TIME ZONE,
  merchant_name TEXT,
  amount NUMERIC,
  order_reference TEXT,
  attachment_path TEXT,
  attachment_type TEXT,
  match_status TEXT DEFAULT 'pending',
  matched_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  match_confidence TEXT,
  matched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id)
);

-- Enable RLS
ALTER TABLE public.gmail_receipts ENABLE ROW LEVEL SECURITY;

-- RLS policies for gmail_receipts
CREATE POLICY "Users can view own gmail receipts"
ON public.gmail_receipts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own gmail receipts"
ON public.gmail_receipts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gmail receipts"
ON public.gmail_receipts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gmail receipts"
ON public.gmail_receipts FOR DELETE
USING (auth.uid() = user_id);

-- Gmail sync settings
CREATE TABLE public.gmail_sync_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  auto_attach BOOLEAN DEFAULT true,
  scan_days INTEGER DEFAULT 30,
  allowed_domains TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gmail_sync_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for gmail_sync_settings
CREATE POLICY "Users can view own gmail sync settings"
ON public.gmail_sync_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own gmail sync settings"
ON public.gmail_sync_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gmail sync settings"
ON public.gmail_sync_settings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gmail sync settings"
ON public.gmail_sync_settings FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_gmail_sync_settings_updated_at
BEFORE UPDATE ON public.gmail_sync_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Gmail match log (audit trail)
CREATE TABLE public.gmail_match_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  receipt_id UUID REFERENCES public.gmail_receipts(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  match_reasons JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gmail_match_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for gmail_match_log
CREATE POLICY "Users can view own gmail match log"
ON public.gmail_match_log FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own gmail match log"
ON public.gmail_match_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for gmail receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('gmail-receipts', 'gmail-receipts', false);

-- Storage policies for gmail-receipts bucket
CREATE POLICY "Users can view own gmail receipt attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'gmail-receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own gmail receipt attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'gmail-receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own gmail receipt attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'gmail-receipts' AND auth.uid()::text = (storage.foldername(name))[1]);