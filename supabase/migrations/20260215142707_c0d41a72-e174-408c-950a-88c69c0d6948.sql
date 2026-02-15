
-- Add day_eligibility column to products table for day-of-week restrictions
-- e.g., ["saturday", "sunday"] means weekends only; empty/null means all days allowed
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS day_eligibility TEXT[] DEFAULT NULL;
