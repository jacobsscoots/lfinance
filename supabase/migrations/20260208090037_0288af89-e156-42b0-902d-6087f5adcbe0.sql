-- Phase 1: Meal Plan Generator V2 Schema Updates

-- Add new columns to products table for portion constraints and solver behaviour
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS editable_mode text NOT NULL DEFAULT 'FREE',
ADD COLUMN IF NOT EXISTS min_portion_grams integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_portion_grams integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS portion_step_grams integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS rounding_rule text NOT NULL DEFAULT 'nearest_1g',
ADD COLUMN IF NOT EXISTS eaten_factor numeric NOT NULL DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS seasoning_rate_per_100g numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS default_unit_type text NOT NULL DEFAULT 'grams',
ADD COLUMN IF NOT EXISTS unit_size_g integer DEFAULT NULL;

-- Add check constraint for editable_mode
ALTER TABLE public.products
ADD CONSTRAINT products_editable_mode_check 
CHECK (editable_mode IN ('LOCKED', 'BOUNDED', 'FREE'));

-- Add check constraint for rounding_rule
ALTER TABLE public.products
ADD CONSTRAINT products_rounding_rule_check 
CHECK (rounding_rule IN ('nearest_1g', 'nearest_5g', 'nearest_10g', 'whole_unit_only'));

-- Add check constraint for default_unit_type
ALTER TABLE public.products
ADD CONSTRAINT products_default_unit_type_check 
CHECK (default_unit_type IN ('grams', 'whole_unit'));

-- Add check constraint for eaten_factor (0-1)
ALTER TABLE public.products
ADD CONSTRAINT products_eaten_factor_check 
CHECK (eaten_factor >= 0 AND eaten_factor <= 1);

-- Create meal_templates table for balanced meal definitions
CREATE TABLE public.meal_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  meal_type text NOT NULL,
  slot_definitions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add check constraint for meal_type
ALTER TABLE public.meal_templates
ADD CONSTRAINT meal_templates_meal_type_check 
CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack'));

-- Enable RLS on meal_templates
ALTER TABLE public.meal_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for meal_templates
CREATE POLICY "Users can view their own meal templates"
ON public.meal_templates FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own meal templates"
ON public.meal_templates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meal templates"
ON public.meal_templates FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meal templates"
ON public.meal_templates FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at on meal_templates
CREATE TRIGGER update_meal_templates_updated_at
BEFORE UPDATE ON public.meal_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing products based on current heuristics
-- Set editable_mode based on existing product_type and name patterns
UPDATE public.products
SET editable_mode = CASE
  -- Fixed products become LOCKED
  WHEN product_type = 'fixed' THEN 'LOCKED'
  -- Known locked items by name
  WHEN LOWER(name) LIKE '%broccoli%' THEN 'LOCKED'
  WHEN LOWER(name) LIKE '%veg%' THEN 'LOCKED'
  WHEN LOWER(name) LIKE '%cookie%' THEN 'LOCKED'
  WHEN LOWER(name) LIKE '%hunters chicken%' THEN 'LOCKED'
  -- Seasonings become BOUNDED
  WHEN LOWER(name) LIKE '%seasoning%' THEN 'BOUNDED'
  WHEN LOWER(name) LIKE '%schwartz%' THEN 'BOUNDED'
  WHEN LOWER(name) LIKE '%spice%' THEN 'BOUNDED'
  -- Default to FREE
  ELSE 'FREE'
END;

-- Set portion constraints based on food type patterns
-- Dairy (yoghurt)
UPDATE public.products
SET min_portion_grams = 100, max_portion_grams = 350, portion_step_grams = 10
WHERE (LOWER(name) LIKE '%yogurt%' OR LOWER(name) LIKE '%yoghurt%')
AND min_portion_grams IS NULL;

-- Granola/muesli
UPDATE public.products
SET min_portion_grams = 25, max_portion_grams = 60, portion_step_grams = 5
WHERE (LOWER(name) LIKE '%granola%' OR LOWER(name) LIKE '%muesli%')
AND min_portion_grams IS NULL;

-- Protein sources
UPDATE public.products
SET min_portion_grams = 100, max_portion_grams = 300, portion_step_grams = 10
WHERE (LOWER(name) LIKE '%chicken%' OR LOWER(name) LIKE '%fish%' OR LOWER(name) LIKE '%salmon%' OR LOWER(name) LIKE '%beef%' OR LOWER(name) LIKE '%turkey%')
AND min_portion_grams IS NULL;

-- Carb sources
UPDATE public.products
SET min_portion_grams = 80, max_portion_grams = 250, portion_step_grams = 10
WHERE (LOWER(name) LIKE '%rice%' OR LOWER(name) LIKE '%pasta%')
AND min_portion_grams IS NULL;

-- Seasonings
UPDATE public.products
SET min_portion_grams = 1, max_portion_grams = 15, portion_step_grams = 1
WHERE (LOWER(name) LIKE '%seasoning%' OR LOWER(name) LIKE '%schwartz%' OR LOWER(name) LIKE '%spice%')
AND min_portion_grams IS NULL;

-- Fruit
UPDATE public.products
SET min_portion_grams = 50, max_portion_grams = 300, portion_step_grams = 10
WHERE food_type = 'fruit'
AND min_portion_grams IS NULL;