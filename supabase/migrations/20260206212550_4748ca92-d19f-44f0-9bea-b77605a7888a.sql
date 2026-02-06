-- Create products table for storing food items with nutritional data
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  calories_per_100g NUMERIC NOT NULL DEFAULT 0,
  protein_per_100g NUMERIC NOT NULL DEFAULT 0,
  carbs_per_100g NUMERIC NOT NULL DEFAULT 0,
  fat_per_100g NUMERIC NOT NULL DEFAULT 0,
  price NUMERIC NOT NULL DEFAULT 0,
  pack_size_grams NUMERIC,
  product_type TEXT NOT NULL DEFAULT 'editable' CHECK (product_type IN ('editable', 'fixed')),
  fixed_portion_grams NUMERIC,
  ignore_macros BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user nutrition settings table
CREATE TABLE public.user_nutrition_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  mode TEXT NOT NULL DEFAULT 'manual' CHECK (mode IN ('target_based', 'manual')),
  daily_calorie_target NUMERIC,
  protein_target_grams NUMERIC,
  carbs_target_grams NUMERIC,
  fat_target_grams NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meal plan items table for detailed meal tracking
CREATE TABLE public.meal_plan_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  meal_plan_id UUID NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  quantity_grams NUMERIC NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add status columns to meal_plans for tracking skipped/eating out
ALTER TABLE public.meal_plans 
  ADD COLUMN breakfast_status TEXT NOT NULL DEFAULT 'planned' CHECK (breakfast_status IN ('planned', 'skipped', 'eating_out')),
  ADD COLUMN lunch_status TEXT NOT NULL DEFAULT 'planned' CHECK (lunch_status IN ('planned', 'skipped', 'eating_out')),
  ADD COLUMN dinner_status TEXT NOT NULL DEFAULT 'planned' CHECK (dinner_status IN ('planned', 'skipped', 'eating_out')),
  ADD COLUMN snack_status TEXT NOT NULL DEFAULT 'planned' CHECK (snack_status IN ('planned', 'skipped', 'eating_out')),
  ADD COLUMN eating_out_breakfast_calories NUMERIC DEFAULT 0,
  ADD COLUMN eating_out_lunch_calories NUMERIC DEFAULT 0,
  ADD COLUMN eating_out_dinner_calories NUMERIC DEFAULT 0,
  ADD COLUMN eating_out_snack_calories NUMERIC DEFAULT 0;

-- Enable RLS on all new tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_nutrition_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_items ENABLE ROW LEVEL SECURITY;

-- Products RLS policies
CREATE POLICY "Users can view own products" ON public.products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own products" ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON public.products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON public.products FOR DELETE USING (auth.uid() = user_id);

-- User nutrition settings RLS policies
CREATE POLICY "Users can view own settings" ON public.user_nutrition_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own settings" ON public.user_nutrition_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_nutrition_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own settings" ON public.user_nutrition_settings FOR DELETE USING (auth.uid() = user_id);

-- Meal plan items RLS policies
CREATE POLICY "Users can view own meal plan items" ON public.meal_plan_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own meal plan items" ON public.meal_plan_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meal plan items" ON public.meal_plan_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meal plan items" ON public.meal_plan_items FOR DELETE USING (auth.uid() = user_id);

-- Add updated_at triggers
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_nutrition_settings_updated_at BEFORE UPDATE ON public.user_nutrition_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_meal_plan_items_updated_at BEFORE UPDATE ON public.meal_plan_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();