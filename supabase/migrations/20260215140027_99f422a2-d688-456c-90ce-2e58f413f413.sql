
-- Store persistent Easy Saver card balance per user
CREATE TABLE public.easysaver_balance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  card_balance NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.easysaver_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own balance"
  ON public.easysaver_balance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own balance"
  ON public.easysaver_balance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own balance"
  ON public.easysaver_balance FOR UPDATE
  USING (auth.uid() = user_id);
