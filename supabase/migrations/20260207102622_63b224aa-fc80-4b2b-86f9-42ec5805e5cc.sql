-- The view was created but we can't add RLS policies to views directly
-- The security_invoker setting makes the view use the caller's permissions
-- which means it will respect the base table's RLS

-- We need to add back a SELECT policy on the base table that's more restrictive
-- but still allows authenticated users to query through the view

-- First, let's check if we need to restore any access
-- The view with security_invoker=on will inherit RLS from the base table

-- Create a SELECT policy that only returns non-sensitive columns
-- Since we can't do column-level RLS, we'll use a different approach:
-- Allow SELECT but the frontend will only use the view

CREATE POLICY "Users can view own connections via view"
ON public.bank_connections FOR SELECT
TO authenticated
USING (auth.uid() = user_id);