
-- Allow manual meal items without a product
ALTER TABLE public.meal_plan_items ALTER COLUMN product_id DROP NOT NULL;

-- Add fields for manual/custom entries
ALTER TABLE public.meal_plan_items
  ADD COLUMN custom_name text,
  ADD COLUMN custom_calories numeric DEFAULT 0,
  ADD COLUMN custom_protein numeric DEFAULT 0,
  ADD COLUMN custom_carbs numeric DEFAULT 0,
  ADD COLUMN custom_fat numeric DEFAULT 0;

-- Add a check: either product_id or custom_name must be set
ALTER TABLE public.meal_plan_items
  ADD CONSTRAINT chk_product_or_custom CHECK (product_id IS NOT NULL OR custom_name IS NOT NULL);
