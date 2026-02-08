-- Fix conflicting RLS UPDATE policies on bank_accounts table
-- Problem: Multiple UPDATE policies with conflicting WITH CHECK conditions block soft-delete

-- Drop the duplicate update policy from the initial migration
DROP POLICY IF EXISTS "Users can update own accounts" ON bank_accounts;

-- Drop and recreate the soft-delete policy with proper WITH CHECK that allows setting deleted_at
DROP POLICY IF EXISTS "Users can soft delete their own accounts" ON bank_accounts;

CREATE POLICY "Users can soft delete their own accounts"
ON public.bank_accounts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);