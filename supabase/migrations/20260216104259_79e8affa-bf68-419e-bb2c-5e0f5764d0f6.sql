
-- Custom tags for transactions
CREATE TABLE public.transaction_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tags" ON public.transaction_tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tags" ON public.transaction_tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON public.transaction_tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON public.transaction_tags FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_transaction_tags_updated_at
  BEFORE UPDATE ON public.transaction_tags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Junction table for many-to-many relationship
CREATE TABLE public.transaction_tag_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.transaction_tags(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(transaction_id, tag_id)
);

ALTER TABLE public.transaction_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assignments" ON public.transaction_tag_assignments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own assignments" ON public.transaction_tag_assignments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own assignments" ON public.transaction_tag_assignments FOR DELETE USING (auth.uid() = user_id);

-- Seed default tags for new users via a function
CREATE OR REPLACE FUNCTION public.create_default_tags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.transaction_tags (user_id, name, color) VALUES
    (NEW.id, 'Moved to grocery pot', '#22c55e'),
    (NEW.id, 'Savings transfer', '#3b82f6'),
    (NEW.id, 'Bill payment', '#f59e0b'),
    (NEW.id, 'Discretionary spend', '#8b5cf6');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_tags
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_tags();
