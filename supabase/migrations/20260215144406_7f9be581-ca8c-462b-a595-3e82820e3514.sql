
-- Medicash health cash plan settings
CREATE TABLE public.medicash_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  policy_year_start_month INTEGER NOT NULL DEFAULT 1,
  policy_year_start_day INTEGER NOT NULL DEFAULT 1,
  plan_level TEXT NOT NULL DEFAULT 'level_3',
  plan_type TEXT NOT NULL DEFAULT 'solo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.medicash_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own medicash settings"
  ON public.medicash_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Medicash benefit categories (configurable per user)
CREATE TABLE public.medicash_benefit_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  yearly_max NUMERIC,
  is_per_event BOOLEAN NOT NULL DEFAULT false,
  per_event_amount NUMERIC,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.medicash_benefit_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own medicash benefit categories"
  ON public.medicash_benefit_categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Medicash claims
CREATE TABLE public.medicash_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES public.medicash_benefit_categories(id) ON DELETE CASCADE,
  claim_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.medicash_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own medicash claims"
  ON public.medicash_claims FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_medicash_claims_user_date ON public.medicash_claims(user_id, claim_date);
CREATE INDEX idx_medicash_claims_category ON public.medicash_claims(category_id);
CREATE INDEX idx_medicash_benefit_categories_user ON public.medicash_benefit_categories(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_medicash_settings_updated_at
  BEFORE UPDATE ON public.medicash_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_medicash_benefit_categories_updated_at
  BEFORE UPDATE ON public.medicash_benefit_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_medicash_claims_updated_at
  BEFORE UPDATE ON public.medicash_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
