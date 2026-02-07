-- Create meal plan blackout/holiday ranges table
CREATE TABLE IF NOT EXISTS public.meal_plan_blackout_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

ALTER TABLE public.meal_plan_blackout_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own blackout ranges"
  ON public.meal_plan_blackout_ranges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own blackout ranges"
  ON public.meal_plan_blackout_ranges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own blackout ranges"
  ON public.meal_plan_blackout_ranges FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own blackout ranges"
  ON public.meal_plan_blackout_ranges FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS blackout_ranges_user_id_idx
  ON public.meal_plan_blackout_ranges(user_id);

CREATE INDEX IF NOT EXISTS blackout_ranges_date_idx
  ON public.meal_plan_blackout_ranges(start_date, end_date);