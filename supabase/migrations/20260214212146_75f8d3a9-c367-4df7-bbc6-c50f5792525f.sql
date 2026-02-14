-- Add macro columns for eating out meals (protein, carbs, fat per meal slot)
-- Plus a restaurant/label field per meal slot
ALTER TABLE public.meal_plans
  ADD COLUMN eating_out_breakfast_protein numeric DEFAULT 0,
  ADD COLUMN eating_out_breakfast_carbs numeric DEFAULT 0,
  ADD COLUMN eating_out_breakfast_fat numeric DEFAULT 0,
  ADD COLUMN eating_out_breakfast_label text,
  ADD COLUMN eating_out_lunch_protein numeric DEFAULT 0,
  ADD COLUMN eating_out_lunch_carbs numeric DEFAULT 0,
  ADD COLUMN eating_out_lunch_fat numeric DEFAULT 0,
  ADD COLUMN eating_out_lunch_label text,
  ADD COLUMN eating_out_dinner_protein numeric DEFAULT 0,
  ADD COLUMN eating_out_dinner_carbs numeric DEFAULT 0,
  ADD COLUMN eating_out_dinner_fat numeric DEFAULT 0,
  ADD COLUMN eating_out_dinner_label text,
  ADD COLUMN eating_out_snack_protein numeric DEFAULT 0,
  ADD COLUMN eating_out_snack_carbs numeric DEFAULT 0,
  ADD COLUMN eating_out_snack_fat numeric DEFAULT 0,
  ADD COLUMN eating_out_snack_label text;