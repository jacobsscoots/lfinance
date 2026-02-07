-- Add new columns to existing bills table
ALTER TABLE bills ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES bank_accounts(id);
ALTER TABLE bills ADD COLUMN IF NOT EXISTS due_date_rule text NOT NULL DEFAULT 'day-of-month';

-- Create bill_occurrences table for tracking paid/skipped status
CREATE TABLE bill_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  expected_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'due',
  paid_transaction_id uuid REFERENCES transactions(id),
  paid_at timestamp with time zone,
  match_confidence text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(bill_id, due_date)
);

-- Enable RLS on bill_occurrences
ALTER TABLE bill_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bill occurrences" ON bill_occurrences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bill occurrences" ON bill_occurrences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bill occurrences" ON bill_occurrences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bill occurrences" ON bill_occurrences
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at on bill_occurrences
CREATE TRIGGER update_bill_occurrences_updated_at
  BEFORE UPDATE ON bill_occurrences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create uk_bank_holidays table
CREATE TABLE uk_bank_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS with public read access
ALTER TABLE uk_bank_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read bank holidays" ON uk_bank_holidays FOR SELECT USING (true);

-- Seed UK bank holidays 2024-2030
INSERT INTO uk_bank_holidays (date, name) VALUES
  -- 2024
  ('2024-01-01', 'New Year''s Day'),
  ('2024-03-29', 'Good Friday'),
  ('2024-04-01', 'Easter Monday'),
  ('2024-05-06', 'Early May Bank Holiday'),
  ('2024-05-27', 'Spring Bank Holiday'),
  ('2024-08-26', 'Summer Bank Holiday'),
  ('2024-12-25', 'Christmas Day'),
  ('2024-12-26', 'Boxing Day'),
  -- 2025
  ('2025-01-01', 'New Year''s Day'),
  ('2025-04-18', 'Good Friday'),
  ('2025-04-21', 'Easter Monday'),
  ('2025-05-05', 'Early May Bank Holiday'),
  ('2025-05-26', 'Spring Bank Holiday'),
  ('2025-08-25', 'Summer Bank Holiday'),
  ('2025-12-25', 'Christmas Day'),
  ('2025-12-26', 'Boxing Day'),
  -- 2026
  ('2026-01-01', 'New Year''s Day'),
  ('2026-04-03', 'Good Friday'),
  ('2026-04-06', 'Easter Monday'),
  ('2026-05-04', 'Early May Bank Holiday'),
  ('2026-05-25', 'Spring Bank Holiday'),
  ('2026-08-31', 'Summer Bank Holiday'),
  ('2026-12-25', 'Christmas Day'),
  ('2026-12-28', 'Boxing Day (substitute)'),
  -- 2027
  ('2027-01-01', 'New Year''s Day'),
  ('2027-03-26', 'Good Friday'),
  ('2027-03-29', 'Easter Monday'),
  ('2027-05-03', 'Early May Bank Holiday'),
  ('2027-05-31', 'Spring Bank Holiday'),
  ('2027-08-30', 'Summer Bank Holiday'),
  ('2027-12-27', 'Christmas Day (substitute)'),
  ('2027-12-28', 'Boxing Day (substitute)'),
  -- 2028
  ('2028-01-03', 'New Year''s Day (substitute)'),
  ('2028-04-14', 'Good Friday'),
  ('2028-04-17', 'Easter Monday'),
  ('2028-05-01', 'Early May Bank Holiday'),
  ('2028-05-29', 'Spring Bank Holiday'),
  ('2028-08-28', 'Summer Bank Holiday'),
  ('2028-12-25', 'Christmas Day'),
  ('2028-12-26', 'Boxing Day'),
  -- 2029
  ('2029-01-01', 'New Year''s Day'),
  ('2029-03-30', 'Good Friday'),
  ('2029-04-02', 'Easter Monday'),
  ('2029-05-07', 'Early May Bank Holiday'),
  ('2029-05-28', 'Spring Bank Holiday'),
  ('2029-08-27', 'Summer Bank Holiday'),
  ('2029-12-25', 'Christmas Day'),
  ('2029-12-26', 'Boxing Day'),
  -- 2030
  ('2030-01-01', 'New Year''s Day'),
  ('2030-04-19', 'Good Friday'),
  ('2030-04-22', 'Easter Monday'),
  ('2030-05-06', 'Early May Bank Holiday'),
  ('2030-05-27', 'Spring Bank Holiday'),
  ('2030-08-26', 'Summer Bank Holiday'),
  ('2030-12-25', 'Christmas Day'),
  ('2030-12-26', 'Boxing Day')
ON CONFLICT (date) DO NOTHING;