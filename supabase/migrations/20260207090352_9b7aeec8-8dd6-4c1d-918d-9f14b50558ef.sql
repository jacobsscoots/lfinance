-- Create toiletry_items table for inventory tracking
CREATE TABLE public.toiletry_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  total_size NUMERIC NOT NULL,
  size_unit TEXT NOT NULL DEFAULT 'ml',
  cost_per_item NUMERIC NOT NULL DEFAULT 0,
  pack_size INTEGER NOT NULL DEFAULT 1,
  usage_rate_per_day NUMERIC NOT NULL DEFAULT 1,
  current_remaining NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  last_restocked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT toiletry_items_total_size_positive CHECK (total_size > 0),
  CONSTRAINT toiletry_items_cost_non_negative CHECK (cost_per_item >= 0),
  CONSTRAINT toiletry_items_pack_size_positive CHECK (pack_size >= 1),
  CONSTRAINT toiletry_items_usage_rate_positive CHECK (usage_rate_per_day > 0),
  CONSTRAINT toiletry_items_remaining_non_negative CHECK (current_remaining >= 0),
  CONSTRAINT toiletry_items_remaining_within_total CHECK (current_remaining <= total_size),
  CONSTRAINT toiletry_items_category_valid CHECK (category IN ('body', 'hair', 'oral', 'household', 'cleaning', 'other')),
  CONSTRAINT toiletry_items_size_unit_valid CHECK (size_unit IN ('ml', 'g', 'units')),
  CONSTRAINT toiletry_items_status_valid CHECK (status IN ('active', 'out_of_stock', 'discontinued'))
);

-- Enable Row Level Security
ALTER TABLE public.toiletry_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own toiletry items"
ON public.toiletry_items
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own toiletry items"
ON public.toiletry_items
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own toiletry items"
ON public.toiletry_items
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own toiletry items"
ON public.toiletry_items
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_toiletry_items_updated_at
BEFORE UPDATE ON public.toiletry_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();