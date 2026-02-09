
-- Table 1: toiletry_usage_logs
CREATE TABLE public.toiletry_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  toiletry_item_id UUID NOT NULL REFERENCES public.toiletry_items(id) ON DELETE CASCADE,
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_used NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (toiletry_item_id, logged_date)
);

ALTER TABLE public.toiletry_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage logs"
  ON public.toiletry_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage logs"
  ON public.toiletry_usage_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage logs"
  ON public.toiletry_usage_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own usage logs"
  ON public.toiletry_usage_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Table 2: retailer_shipping_profiles
CREATE TABLE public.retailer_shipping_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  retailer_name TEXT NOT NULL,
  dispatch_days_min INT NOT NULL DEFAULT 0,
  dispatch_days_max INT NOT NULL DEFAULT 1,
  delivery_days_min INT NOT NULL DEFAULT 1,
  delivery_days_max INT NOT NULL DEFAULT 3,
  dispatches_weekends BOOLEAN NOT NULL DEFAULT false,
  delivers_weekends BOOLEAN NOT NULL DEFAULT false,
  cutoff_time TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, retailer_name)
);

ALTER TABLE public.retailer_shipping_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own retailer profiles"
  ON public.retailer_shipping_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own retailer profiles"
  ON public.retailer_shipping_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own retailer profiles"
  ON public.retailer_shipping_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own retailer profiles"
  ON public.retailer_shipping_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Alter toiletry_items: add retailer and safety_buffer_days
ALTER TABLE public.toiletry_items
  ADD COLUMN IF NOT EXISTS retailer TEXT,
  ADD COLUMN IF NOT EXISTS safety_buffer_days INT NOT NULL DEFAULT 2;

-- Table 3: online_orders
CREATE TABLE public.online_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  retailer_name TEXT NOT NULL,
  order_number TEXT,
  order_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'detected',
  source TEXT NOT NULL DEFAULT 'manual',
  source_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, source_message_id)
);

ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own online orders"
  ON public.online_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own online orders"
  ON public.online_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own online orders"
  ON public.online_orders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own online orders"
  ON public.online_orders FOR DELETE
  USING (auth.uid() = user_id);

-- Table 4: order_shipments
CREATE TABLE public.order_shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES public.online_orders(id) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL,
  carrier TEXT,
  tracking_provider TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending',
  last_event_at TIMESTAMPTZ,
  last_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tracking_number)
);

ALTER TABLE public.order_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own order shipments"
  ON public.order_shipments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own order shipments"
  ON public.order_shipments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own order shipments"
  ON public.order_shipments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own order shipments"
  ON public.order_shipments FOR DELETE
  USING (auth.uid() = user_id);

-- Table 5: order_items
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES public.online_orders(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  matched_toiletry_item_id UUID REFERENCES public.toiletry_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own order items"
  ON public.order_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own order items"
  ON public.order_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own order items"
  ON public.order_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own order items"
  ON public.order_items FOR DELETE
  USING (auth.uid() = user_id);
