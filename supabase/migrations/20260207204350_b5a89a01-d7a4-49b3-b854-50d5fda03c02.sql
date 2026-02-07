-- Create table to store price checks for toiletry items
CREATE TABLE public.toiletry_price_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  toiletry_item_id uuid NOT NULL REFERENCES public.toiletry_items(id) ON DELETE CASCADE,
  retailer text NOT NULL,
  price numeric(10,2) NOT NULL,
  offer_price numeric(10,2),
  offer_label text,
  product_url text,
  product_name text,
  dispatch_days integer,
  delivery_days integer,
  total_lead_time integer GENERATED ALWAYS AS (COALESCE(dispatch_days, 0) + COALESCE(delivery_days, 0)) STORED,
  in_stock boolean DEFAULT true,
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.toiletry_price_checks ENABLE ROW LEVEL SECURITY;

-- Users can only view their own price checks
CREATE POLICY "Users can view their own price checks"
ON public.toiletry_price_checks
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own price checks
CREATE POLICY "Users can insert their own price checks"
ON public.toiletry_price_checks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own price checks
CREATE POLICY "Users can update their own price checks"
ON public.toiletry_price_checks
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own price checks
CREATE POLICY "Users can delete their own price checks"
ON public.toiletry_price_checks
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for faster lookups by toiletry item
CREATE INDEX idx_toiletry_price_checks_item ON public.toiletry_price_checks(toiletry_item_id);

-- Add index for recent checks
CREATE INDEX idx_toiletry_price_checks_checked_at ON public.toiletry_price_checks(checked_at DESC);