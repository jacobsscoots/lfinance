-- Add calculator input fields to user_nutrition_settings
ALTER TABLE public.user_nutrition_settings
ADD COLUMN IF NOT EXISTS age integer,
ADD COLUMN IF NOT EXISTS sex text CHECK (sex IN ('male', 'female')),
ADD COLUMN IF NOT EXISTS height_cm numeric,
ADD COLUMN IF NOT EXISTS weight_kg numeric,
ADD COLUMN IF NOT EXISTS body_fat_percent numeric,
ADD COLUMN IF NOT EXISTS activity_level text CHECK (activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active')),
ADD COLUMN IF NOT EXISTS formula text DEFAULT 'mifflin_st_jeor' CHECK (formula IN ('mifflin_st_jeor', 'harris_benedict', 'katch_mcardle')),
ADD COLUMN IF NOT EXISTS goal_type text DEFAULT 'maintain' CHECK (goal_type IN ('maintain', 'cut', 'bulk')),
ADD COLUMN IF NOT EXISTS protein_per_kg numeric DEFAULT 2.2,
ADD COLUMN IF NOT EXISTS fat_per_kg numeric DEFAULT 0.8,
ADD COLUMN IF NOT EXISTS last_calculated_at timestamptz;