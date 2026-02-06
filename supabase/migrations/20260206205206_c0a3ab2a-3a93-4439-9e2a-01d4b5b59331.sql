-- Create function to seed default categories for new users
CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, icon, color, is_default) VALUES
    (NEW.id, 'Groceries', 'shopping-cart', '#22c55e', true),
    (NEW.id, 'Bills & Utilities', 'file-text', '#f59e0b', true),
    (NEW.id, 'Transport', 'car', '#3b82f6', true),
    (NEW.id, 'Entertainment', 'tv', '#8b5cf6', true),
    (NEW.id, 'Eating Out', 'utensils', '#ec4899', true),
    (NEW.id, 'Shopping', 'shopping-bag', '#06b6d4', true),
    (NEW.id, 'Health', 'heart', '#ef4444', true),
    (NEW.id, 'Income', 'trending-up', '#10b981', true),
    (NEW.id, 'Subscriptions', 'repeat', '#6366f1', true),
    (NEW.id, 'Personal Care', 'user', '#f97316', true),
    (NEW.id, 'Transfers', 'arrow-right-left', '#64748b', true),
    (NEW.id, 'Other', 'circle', '#94a3b8', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to run on new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_categories();