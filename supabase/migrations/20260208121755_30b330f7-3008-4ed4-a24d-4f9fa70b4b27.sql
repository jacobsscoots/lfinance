-- Fix bank_accounts soft-delete failing due to UPDATE policy WITH CHECK defaulting to deleted_at IS NULL

-- Remove the redundant soft-delete policy (we'll handle soft-delete via the main update policy)
DROP POLICY IF EXISTS "Users can soft delete their own accounts" ON public.bank_accounts;

-- Recreate the main update policy with an explicit WITH CHECK that allows changing deleted_at
DROP POLICY IF EXISTS "Users can update their own accounts" ON public.bank_accounts;

CREATE POLICY "Users can update their own accounts"
ON public.bank_accounts
FOR UPDATE
USING (auth.uid() = user_id AND deleted_at IS NULL)
WITH CHECK (auth.uid() = user_id);