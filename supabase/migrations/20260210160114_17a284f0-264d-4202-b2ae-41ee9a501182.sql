
-- Create shipments table with all required fields
CREATE TABLE public.shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  order_id UUID REFERENCES public.online_orders(id) ON DELETE SET NULL,
  carrier_code TEXT,
  tracking_number TEXT NOT NULL,
  trackingmore_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  last_event_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  raw_latest JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_shipments_order_id ON public.shipments(order_id);
CREATE INDEX idx_shipments_tracking_number ON public.shipments(tracking_number);
CREATE INDEX idx_shipments_status_synced ON public.shipments(status, last_synced_at);

-- RLS
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own shipments"
  ON public.shipments FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own shipments"
  ON public.shipments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shipments"
  ON public.shipments FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shipments"
  ON public.shipments FOR DELETE USING (auth.uid() = user_id);

-- Service role needs full access for webhook/poller
CREATE POLICY "Service role full access on shipments"
  ON public.shipments FOR ALL USING (true) WITH CHECK (true);

-- Create shipment_events table for timeline
CREATE TABLE public.shipment_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  event_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  message TEXT,
  status TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint to avoid duplicate events
CREATE UNIQUE INDEX idx_shipment_events_dedup 
  ON public.shipment_events(shipment_id, event_time, COALESCE(message, ''));

-- RLS
ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events for their shipments"
  ON public.shipment_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.shipments s WHERE s.id = shipment_id AND s.user_id = auth.uid()
  ));

-- Service role needs full access for webhook/poller
CREATE POLICY "Service role full access on shipment_events"
  ON public.shipment_events FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger for shipments
CREATE TRIGGER update_shipments_updated_at
  BEFORE UPDATE ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
