-- Add pay_date and other_deductions to payslips
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS pay_date date,
  ADD COLUMN IF NOT EXISTS other_deductions jsonb DEFAULT '[]'::jsonb;