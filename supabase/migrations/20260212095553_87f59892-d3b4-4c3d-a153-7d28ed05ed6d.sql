
-- Birthday/occasion events (people/occasions to buy for)
CREATE TABLE public.birthday_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  person_name TEXT NOT NULL,
  occasion TEXT NOT NULL DEFAULT 'birthday', -- birthday, christmas, anniversary, other
  event_month INT NOT NULL CHECK (event_month BETWEEN 1 AND 12),
  event_day INT CHECK (event_day BETWEEN 1 AND 31),
  budget NUMERIC DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Birthday/occasion expense items (what you plan to buy/have bought)
CREATE TABLE public.birthday_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES public.birthday_events(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  year INT NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  is_purchased BOOLEAN DEFAULT false,
  purchase_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.birthday_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.birthday_expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies for birthday_events
CREATE POLICY "Users can view own birthday events" ON public.birthday_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own birthday events" ON public.birthday_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own birthday events" ON public.birthday_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own birthday events" ON public.birthday_events FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for birthday_expenses
CREATE POLICY "Users can view own birthday expenses" ON public.birthday_expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own birthday expenses" ON public.birthday_expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own birthday expenses" ON public.birthday_expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own birthday expenses" ON public.birthday_expenses FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_birthday_events_user ON public.birthday_events(user_id);
CREATE INDEX idx_birthday_expenses_event ON public.birthday_expenses(event_id);
CREATE INDEX idx_birthday_expenses_user ON public.birthday_expenses(user_id);

-- Triggers for updated_at
CREATE TRIGGER update_birthday_events_updated_at BEFORE UPDATE ON public.birthday_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_birthday_expenses_updated_at BEFORE UPDATE ON public.birthday_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
