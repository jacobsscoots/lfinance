
-- Table to log processed shipping emails and extracted tracking info
CREATE TABLE public.email_tracking_extractions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider_message_id TEXT NOT NULL,
  received_at TIMESTAMPTZ,
  from_email TEXT,
  subject TEXT,
  raw_excerpt TEXT, -- max ~200 chars for debugging
  extracted_tracking_number TEXT,
  extracted_carrier_code TEXT,
  parse_confidence REAL, -- 0.0 to 1.0
  created_shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one extraction per message per user
CREATE UNIQUE INDEX idx_email_tracking_dedup
  ON public.email_tracking_extractions(user_id, provider_message_id);

-- RLS
ALTER TABLE public.email_tracking_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own extractions"
  ON public.email_tracking_extractions FOR SELECT
  USING (auth.uid() = user_id);

-- Add source column to shipments to track how it was created
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
