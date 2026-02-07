-- Add bi-annual frequency to the enum
ALTER TYPE bill_frequency ADD VALUE IF NOT EXISTS 'biannual';

-- Add variable bill support columns
ALTER TABLE public.bills 
ADD COLUMN IF NOT EXISTS is_variable boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS bill_type text DEFAULT 'fixed' CHECK (bill_type IN ('fixed', 'variable')),
ADD COLUMN IF NOT EXISTS is_subscription boolean DEFAULT false;