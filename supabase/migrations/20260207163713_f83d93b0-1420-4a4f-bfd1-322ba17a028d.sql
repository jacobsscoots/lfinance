-- Extend toiletry_items with weight tracking columns
ALTER TABLE toiletry_items
ADD COLUMN IF NOT EXISTS opened_at date,
ADD COLUMN IF NOT EXISTS finished_at date,
ADD COLUMN IF NOT EXISTS empty_weight_grams numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS full_weight_grams numeric,
ADD COLUMN IF NOT EXISTS current_weight_grams numeric,
ADD COLUMN IF NOT EXISTS calculated_usage_rate numeric,
ADD COLUMN IF NOT EXISTS last_weighed_at timestamptz;

-- Create toiletry_purchases junction table for purchase/receipt linking
CREATE TABLE public.toiletry_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  toiletry_item_id uuid NOT NULL REFERENCES toiletry_items(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  
  purchase_date date NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  discount_type text DEFAULT 'none' CHECK (discount_type IN ('none', 'tesco_benefits', 'easysaver', 'clubcard', 'other')),
  discount_amount numeric(10,2) DEFAULT 0,
  final_price numeric(10,2) NOT NULL,
  
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on toiletry_purchases
ALTER TABLE public.toiletry_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own toiletry purchases"
  ON public.toiletry_purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own toiletry purchases"
  ON public.toiletry_purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own toiletry purchases"
  ON public.toiletry_purchases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own toiletry purchases"
  ON public.toiletry_purchases FOR DELETE
  USING (auth.uid() = user_id);

-- Create toiletry_orders table for online order tracking
CREATE TABLE public.toiletry_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  
  order_date date NOT NULL,
  retailer text NOT NULL,
  order_reference text,
  
  subtotal numeric(10,2) NOT NULL,
  delivery_cost numeric(10,2) DEFAULT 0,
  total_amount numeric(10,2) NOT NULL,
  
  dispatch_date date,
  estimated_delivery date,
  actual_delivery date,
  
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  notes text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on toiletry_orders
ALTER TABLE public.toiletry_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own toiletry orders"
  ON public.toiletry_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own toiletry orders"
  ON public.toiletry_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own toiletry orders"
  ON public.toiletry_orders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own toiletry orders"
  ON public.toiletry_orders FOR DELETE
  USING (auth.uid() = user_id);

-- Add order_id to link purchases to orders
ALTER TABLE public.toiletry_purchases
ADD COLUMN order_id uuid REFERENCES toiletry_orders(id) ON DELETE SET NULL;