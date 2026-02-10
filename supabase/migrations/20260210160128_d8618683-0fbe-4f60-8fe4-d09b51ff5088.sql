
-- Remove overly permissive service role policies (service role bypasses RLS anyway)
DROP POLICY "Service role full access on shipments" ON public.shipments;
DROP POLICY "Service role full access on shipment_events" ON public.shipment_events;
