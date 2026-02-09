-- Add current_weight_grams to products for weight-based stock tracking
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS current_weight_grams numeric DEFAULT NULL;
