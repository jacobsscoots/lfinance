-- Fix 1: Enable RLS on the view (views inherit RLS from base table with security_invoker)
-- The view already has security_invoker=on, but we need to allow authenticated users
-- to SELECT from base table ONLY via the view

-- Drop the problematic policies
DROP POLICY IF EXISTS "Only service role can read tokens directly" ON public.bank_connections;
DROP POLICY IF EXISTS "Service role has full read access" ON public.bank_connections;

-- Create proper RLS policy: users can only read their own connections
-- The view with security_invoker will respect this policy
CREATE POLICY "Users can view own bank connections"
ON public.bank_connections
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Service role still gets full access (needed for edge functions)
CREATE POLICY "Service role full access"
ON public.bank_connections
FOR SELECT
TO service_role
USING (true);