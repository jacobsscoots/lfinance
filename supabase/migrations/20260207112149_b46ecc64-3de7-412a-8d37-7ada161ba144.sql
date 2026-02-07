-- Add meal eligibility and food type to products table
-- meal_eligibility: array of allowed meal types (breakfast, lunch, dinner, snack)
-- food_type: categorization for smart portioning (protein, carb, fat, veg, fruit, dairy, sauce, treat, other)
ALTER TABLE public.products 
ADD COLUMN meal_eligibility text[] DEFAULT ARRAY['breakfast', 'lunch', 'dinner', 'snack']::text[],
ADD COLUMN food_type text DEFAULT 'other';

-- Add comments for documentation
COMMENT ON COLUMN public.products.meal_eligibility IS 'Array of meal types this product is allowed in: breakfast, lunch, dinner, snack';
COMMENT ON COLUMN public.products.food_type IS 'Food category for portioning: protein, carb, fat, veg, fruit, dairy, sauce, treat, other';

-- Add portioning settings to user_nutrition_settings
ALTER TABLE public.user_nutrition_settings
ADD COLUMN min_grams_per_item numeric DEFAULT 10,
ADD COLUMN max_grams_per_item numeric DEFAULT 500,
ADD COLUMN portion_rounding numeric DEFAULT 5,
ADD COLUMN target_tolerance_percent numeric DEFAULT 2;

-- Add comments
COMMENT ON COLUMN public.user_nutrition_settings.min_grams_per_item IS 'Minimum grams when auto-portioning an item';
COMMENT ON COLUMN public.user_nutrition_settings.max_grams_per_item IS 'Maximum grams when auto-portioning an item';
COMMENT ON COLUMN public.user_nutrition_settings.portion_rounding IS 'Round portion to nearest X grams (e.g. 5, 10)';
COMMENT ON COLUMN public.user_nutrition_settings.target_tolerance_percent IS 'Acceptable % deviation from target (e.g. 2 = within 2%)';