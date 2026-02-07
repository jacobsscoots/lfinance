-- ===========================================
-- CHEAPER BILLS TABLES
-- ===========================================

-- Tracked services (energy, broadband, mobile, etc.)
CREATE TABLE public.tracked_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  service_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  plan_name TEXT,
  monthly_cost NUMERIC DEFAULT 0,
  contract_start_date DATE,
  contract_end_date DATE,
  is_tracking_enabled BOOLEAN DEFAULT true,
  last_scan_date TIMESTAMP WITH TIME ZONE,
  last_recommendation TEXT,
  last_recommendation_reason TEXT,
  estimated_savings_annual NUMERIC DEFAULT 0,
  exit_fee NUMERIC DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tracked_services ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own tracked services"
ON public.tracked_services FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tracked services"
ON public.tracked_services FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tracked services"
ON public.tracked_services FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tracked services"
ON public.tracked_services FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_tracked_services_updated_at
BEFORE UPDATE ON public.tracked_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Service allowances (broadband speed, mobile data, etc.)
CREATE TABLE public.service_allowances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tracked_service_id UUID NOT NULL REFERENCES public.tracked_services(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  allowance_type TEXT NOT NULL,
  allowance_value NUMERIC DEFAULT 0,
  is_unlimited BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_allowances ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own service allowances"
ON public.service_allowances FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own service allowances"
ON public.service_allowances FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own service allowances"
ON public.service_allowances FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own service allowances"
ON public.service_allowances FOR DELETE
USING (auth.uid() = user_id);

-- Energy readings (smart meter or manual)
CREATE TABLE public.energy_readings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reading_date DATE NOT NULL,
  fuel_type TEXT NOT NULL,
  consumption_kwh NUMERIC DEFAULT 0,
  cost_estimate NUMERIC,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, reading_date, fuel_type)
);

-- Enable RLS
ALTER TABLE public.energy_readings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own energy readings"
ON public.energy_readings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own energy readings"
ON public.energy_readings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own energy readings"
ON public.energy_readings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own energy readings"
ON public.energy_readings FOR DELETE
USING (auth.uid() = user_id);

-- Energy tariffs
CREATE TABLE public.energy_tariffs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tariff_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  fuel_type TEXT NOT NULL,
  unit_rate_kwh NUMERIC NOT NULL,
  standing_charge_daily NUMERIC DEFAULT 0,
  is_fixed BOOLEAN DEFAULT false,
  fix_end_date DATE,
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.energy_tariffs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own energy tariffs"
ON public.energy_tariffs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own energy tariffs"
ON public.energy_tariffs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own energy tariffs"
ON public.energy_tariffs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own energy tariffs"
ON public.energy_tariffs FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_energy_tariffs_updated_at
BEFORE UPDATE ON public.energy_tariffs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comparison results
CREATE TABLE public.comparison_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tracked_service_id UUID REFERENCES public.tracked_services(id) ON DELETE SET NULL,
  service_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  plan_name TEXT,
  monthly_cost NUMERIC NOT NULL,
  annual_cost NUMERIC,
  features JSONB,
  source TEXT DEFAULT 'manual',
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_best_offer BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.comparison_results ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own comparison results"
ON public.comparison_results FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own comparison results"
ON public.comparison_results FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comparison results"
ON public.comparison_results FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comparison results"
ON public.comparison_results FOR DELETE
USING (auth.uid() = user_id);

-- Cheaper bills settings
CREATE TABLE public.cheaper_bills_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  savings_threshold NUMERIC DEFAULT 50,
  preferred_contract_type TEXT DEFAULT 'any',
  risk_preference TEXT DEFAULT 'balanced',
  scan_frequency TEXT DEFAULT 'monthly',
  email_notifications BOOLEAN DEFAULT true,
  in_app_notifications BOOLEAN DEFAULT true,
  postcode TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cheaper_bills_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own cheaper bills settings"
ON public.cheaper_bills_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own cheaper bills settings"
ON public.cheaper_bills_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cheaper bills settings"
ON public.cheaper_bills_settings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cheaper bills settings"
ON public.cheaper_bills_settings FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_cheaper_bills_settings_updated_at
BEFORE UPDATE ON public.cheaper_bills_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Bill reports history
CREATE TABLE public.bill_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  report_date DATE NOT NULL,
  report_type TEXT NOT NULL,
  content JSONB,
  sent_via TEXT DEFAULT 'in_app',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bill_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own bill reports"
ON public.bill_reports FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bill reports"
ON public.bill_reports FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bill reports"
ON public.bill_reports FOR DELETE
USING (auth.uid() = user_id);