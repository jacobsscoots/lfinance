
-- Cell-level overrides for Yearly Planner inline editing
-- These override individual cell values without affecting source data
CREATE TABLE public.yearly_planner_cell_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL, -- 0-11
  row_key TEXT NOT NULL,  -- e.g. 'bill:<bill_id>', 'income', 'income:<source>', 'grocery', 'birthday', 'toiletry'
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, month, row_key)
);

ALTER TABLE public.yearly_planner_cell_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cell overrides"
  ON public.yearly_planner_cell_overrides FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cell overrides"
  ON public.yearly_planner_cell_overrides FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cell overrides"
  ON public.yearly_planner_cell_overrides FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cell overrides"
  ON public.yearly_planner_cell_overrides FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_yearly_cell_overrides_user_year
  ON public.yearly_planner_cell_overrides(user_id, year);
