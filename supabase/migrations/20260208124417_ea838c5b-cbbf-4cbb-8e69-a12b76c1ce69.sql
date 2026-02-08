-- Add monthly_contribution column to investment_accounts
ALTER TABLE public.investment_accounts 
ADD COLUMN monthly_contribution numeric DEFAULT 0;