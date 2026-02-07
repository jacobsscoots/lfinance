-- Add retailer and default discount type to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS retailer text,
ADD COLUMN IF NOT EXISTS default_discount_type text
  CHECK (default_discount_type IN ('none','tesco_benefits','easysaver','clubcard','other'));

-- Create grocery_orders table for online orders
CREATE TABLE IF NOT EXISTS public.grocery_orders (
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

ALTER TABLE public.grocery_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own grocery orders"
  ON public.grocery_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own grocery orders"
  ON public.grocery_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own grocery orders"
  ON public.grocery_orders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own grocery orders"
  ON public.grocery_orders FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS grocery_orders_user_id_idx ON public.grocery_orders(user_id);
CREATE INDEX IF NOT EXISTS grocery_orders_transaction_id_idx ON public.grocery_orders(transaction_id);

-- Create grocery_purchases junction table
CREATE TABLE IF NOT EXISTS public.grocery_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  order_id uuid REFERENCES grocery_orders(id) ON DELETE SET NULL,
  
  purchase_date date NOT NULL,
  
  quantity integer NOT NULL DEFAULT 1,
  
  unit_price numeric(10,2),
  gross_cost numeric(10,2),
  discount_type text CHECK (discount_type IN ('none','tesco_benefits','easysaver','clubcard','other')),
  discount_amount numeric(10,2) DEFAULT 0,
  final_cost numeric(10,2),
  
  grams_purchased numeric,
  retailer text,
  
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grocery_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own grocery purchases"
  ON public.grocery_purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own grocery purchases"
  ON public.grocery_purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own grocery purchases"
  ON public.grocery_purchases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own grocery purchases"
  ON public.grocery_purchases FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS grocery_purchases_user_id_idx ON public.grocery_purchases(user_id);
CREATE INDEX IF NOT EXISTS grocery_purchases_transaction_id_idx ON public.grocery_purchases(transaction_id);
CREATE INDEX IF NOT EXISTS grocery_purchases_product_id_idx ON public.grocery_purchases(product_id);
CREATE INDEX IF NOT EXISTS grocery_purchases_order_id_idx ON public.grocery_purchases(order_id);