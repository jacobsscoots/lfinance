
-- Create import_logs table
CREATE TABLE public.import_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  file_name TEXT NOT NULL,
  settings_sheet_name TEXT,
  layout_detected TEXT,
  mapping_signature TEXT,
  bills_added INT NOT NULL DEFAULT 0,
  bills_updated INT NOT NULL DEFAULT 0,
  bills_skipped INT NOT NULL DEFAULT 0,
  subs_added INT NOT NULL DEFAULT 0,
  subs_updated INT NOT NULL DEFAULT 0,
  subs_skipped INT NOT NULL DEFAULT 0,
  debts_added INT NOT NULL DEFAULT 0,
  debts_updated INT NOT NULL DEFAULT 0,
  debts_skipped INT NOT NULL DEFAULT 0,
  details JSONB
);

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own import logs"
  ON public.import_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own import logs"
  ON public.import_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add import_key columns for idempotent imports
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS import_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS bills_user_import_key_idx ON public.bills (user_id, import_key) WHERE import_key IS NOT NULL;

ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS import_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS debts_user_import_key_idx ON public.debts (user_id, import_key) WHERE import_key IS NOT NULL;
