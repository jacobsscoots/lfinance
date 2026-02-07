-- Add deleted_at column to bank_accounts for soft delete
ALTER TABLE public.bank_accounts 
ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Create index for efficient filtering of non-deleted accounts
CREATE INDEX idx_bank_accounts_deleted_at ON public.bank_accounts (deleted_at)
WHERE deleted_at IS NULL;

-- Update RLS policies to filter out deleted accounts by default
DROP POLICY IF EXISTS "Users can view their own accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can update their own accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can delete their own accounts" ON public.bank_accounts;

-- View policy: only show non-deleted accounts
CREATE POLICY "Users can view their own active accounts"
ON public.bank_accounts
FOR SELECT
USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Update policy: only allow updating non-deleted accounts  
CREATE POLICY "Users can update their own accounts"
ON public.bank_accounts
FOR UPDATE
USING (auth.uid() = user_id AND deleted_at IS NULL);

-- "Delete" policy now sets deleted_at instead of actual delete
-- We keep the original delete policy but users should use soft delete
CREATE POLICY "Users can soft delete their own accounts"
ON public.bank_accounts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Make bills.account_id nullable to support soft-deleted accounts display
ALTER TABLE public.bills ALTER COLUMN account_id DROP NOT NULL;