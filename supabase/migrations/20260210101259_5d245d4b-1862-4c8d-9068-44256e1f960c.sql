
-- Add broadband comparison fields to tracked_services
ALTER TABLE public.tracked_services ADD COLUMN IF NOT EXISTS current_speed_mbps integer;
ALTER TABLE public.tracked_services ADD COLUMN IF NOT EXISTS preferred_contract_months integer;

-- Add daily_budget to user_payday_settings
ALTER TABLE public.user_payday_settings ADD COLUMN IF NOT EXISTS daily_budget numeric DEFAULT 15;
