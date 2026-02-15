
-- Table to track which shop list items have been marked as bought/collected
CREATE TABLE public.shop_list_collected (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id, week_start)
);

-- Enable RLS
ALTER TABLE public.shop_list_collected ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own collected items"
  ON public.shop_list_collected FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own collected items"
  ON public.shop_list_collected FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own collected items"
  ON public.shop_list_collected FOR DELETE
  USING (auth.uid() = user_id);
