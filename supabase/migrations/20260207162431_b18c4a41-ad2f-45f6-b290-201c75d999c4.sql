-- Feature 1: User Payday Settings
CREATE TABLE public.user_payday_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  payday_date integer NOT NULL DEFAULT 20 CHECK (payday_date BETWEEN 1 AND 28),
  adjustment_rule text NOT NULL DEFAULT 'previous_working_day'
    CHECK (adjustment_rule IN (
      'previous_working_day',
      'next_working_day',
      'closest_working_day',
      'no_adjustment'
    )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.user_payday_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read own payday settings"
  ON public.user_payday_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payday settings"
  ON public.user_payday_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payday settings"
  ON public.user_payday_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own payday settings"
  ON public.user_payday_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_payday_settings_updated_at
  BEFORE UPDATE ON public.user_payday_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Feature 2: Payslips Table
CREATE TABLE public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,

  file_path text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),

  gross_pay numeric(10,2),
  net_pay numeric(10,2),
  tax_deducted numeric(10,2),
  ni_deducted numeric(10,2),
  pension_deducted numeric(10,2),

  pay_period_start date,
  pay_period_end date,
  employer_name text,

  extraction_confidence text CHECK (extraction_confidence IN ('high','medium','low')),
  extraction_raw jsonb,

  matched_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  match_status text DEFAULT 'pending'
    CHECK (match_status IN ('pending','auto_matched','manual_matched','no_match')),
  matched_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read own payslips"
  ON public.payslips FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payslips"
  ON public.payslips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payslips"
  ON public.payslips FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own payslips"
  ON public.payslips FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_payslips_updated_at
  BEFORE UPDATE ON public.payslips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Payslips storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payslips',
  'payslips',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

-- Storage RLS policies
CREATE POLICY "Users can upload own payslips"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payslips' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own payslips"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payslips' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own payslips"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'payslips' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );