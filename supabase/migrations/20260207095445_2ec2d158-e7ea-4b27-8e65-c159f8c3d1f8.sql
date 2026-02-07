-- Extend user_nutrition_settings with weekday/weekend targets
ALTER TABLE public.user_nutrition_settings 
ADD COLUMN IF NOT EXISTS weekend_calorie_target numeric,
ADD COLUMN IF NOT EXISTS weekend_protein_target_grams numeric,
ADD COLUMN IF NOT EXISTS weekend_carbs_target_grams numeric,
ADD COLUMN IF NOT EXISTS weekend_fat_target_grams numeric,
ADD COLUMN IF NOT EXISTS weekend_targets_enabled boolean NOT NULL DEFAULT false;

-- Extend products table with full UK nutrition label fields
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS energy_kj_per_100g numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS saturates_per_100g numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS sugars_per_100g numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS fibre_per_100g numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS salt_per_100g numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS brand text,
ADD COLUMN IF NOT EXISTS offer_price numeric,
ADD COLUMN IF NOT EXISTS offer_label text,
ADD COLUMN IF NOT EXISTS source_url text,
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS storage_notes text,
ADD COLUMN IF NOT EXISTS serving_basis text NOT NULL DEFAULT 'per_100g',
ADD COLUMN IF NOT EXISTS serving_size_grams numeric;

-- Add check constraint for serving_basis
ALTER TABLE public.products
ADD CONSTRAINT products_serving_basis_check 
CHECK (serving_basis IN ('per_100g', 'per_serving', 'as_sold'));