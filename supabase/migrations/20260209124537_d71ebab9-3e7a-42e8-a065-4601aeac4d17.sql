-- Add missing frequency values to the bill_frequency enum
ALTER TYPE bill_frequency ADD VALUE IF NOT EXISTS 'daily';
ALTER TYPE bill_frequency ADD VALUE IF NOT EXISTS 'bimonthly';