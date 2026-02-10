
-- Add ticker_symbol to investment_accounts
ALTER TABLE public.investment_accounts ADD COLUMN ticker_symbol text;

-- Add units to investment_transactions
ALTER TABLE public.investment_transactions ADD COLUMN units numeric;

-- Create yearly_planner_overrides table
CREATE TABLE public.yearly_planner_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  label text NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.yearly_planner_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own overrides"
  ON public.yearly_planner_overrides FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own overrides"
  ON public.yearly_planner_overrides FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own overrides"
  ON public.yearly_planner_overrides FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own overrides"
  ON public.yearly_planner_overrides FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_yearly_planner_overrides_updated_at
  BEFORE UPDATE ON public.yearly_planner_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
