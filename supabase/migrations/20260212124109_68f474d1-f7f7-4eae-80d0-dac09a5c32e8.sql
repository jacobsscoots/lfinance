
-- Add address and status fields to birthday_events
ALTER TABLE public.birthday_events
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS money_scheduled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS card_sent boolean DEFAULT false;
