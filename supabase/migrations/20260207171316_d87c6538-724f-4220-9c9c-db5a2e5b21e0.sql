-- Create weekly_nutrition_targets table for week-scoped calorie/macro targets with zigzag support
CREATE TABLE IF NOT EXISTS public.weekly_nutrition_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start_date date NOT NULL, -- Always a Monday
  -- Selected plan mode
  plan_mode text NOT NULL DEFAULT 'maintain', -- maintain, mild_loss, loss, extreme_loss
  -- Zigzag settings
  zigzag_enabled boolean NOT NULL DEFAULT false,
  zigzag_schedule text, -- 'schedule_1' (high weekend) or 'schedule_2' (varied)
  -- Daily calorie values for the week (Mon-Sun)
  monday_calories integer NOT NULL,
  tuesday_calories integer NOT NULL,
  wednesday_calories integer NOT NULL,
  thursday_calories integer NOT NULL,
  friday_calories integer NOT NULL,
  saturday_calories integer NOT NULL,
  sunday_calories integer NOT NULL,
  -- Macro targets (protein stays fixed, carbs/fat can vary with calories)
  protein_target_grams integer,
  carbs_target_grams integer,
  fat_target_grams integer,
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Ensure one entry per user per week
  UNIQUE (user_id, week_start_date)
);

-- Enable RLS
ALTER TABLE public.weekly_nutrition_targets ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own weekly targets"
  ON public.weekly_nutrition_targets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own weekly targets"
  ON public.weekly_nutrition_targets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly targets"
  ON public.weekly_nutrition_targets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weekly targets"
  ON public.weekly_nutrition_targets FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS weekly_nutrition_targets_user_week_idx 
  ON public.weekly_nutrition_targets(user_id, week_start_date);

-- Trigger for updated_at
CREATE TRIGGER update_weekly_nutrition_targets_updated_at
  BEFORE UPDATE ON public.weekly_nutrition_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();