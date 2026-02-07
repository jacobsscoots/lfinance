-- =============================================================================
-- SECURITY FIX: Protect Banking Tokens from Client-Side Access
-- =============================================================================
-- Problem: The bank_connections table contains access_token and refresh_token 
-- columns. While RLS restricts to own rows, users can still read their own
-- tokens via the Supabase client, exposing sensitive banking credentials.
--
-- Solution: Create a secure view that excludes tokens and update RLS policies
-- to prevent direct table access for SELECT while allowing view-based access.
-- =============================================================================

-- Step 1: Drop existing SELECT policies on bank_connections
DROP POLICY IF EXISTS "Users can view own bank connections" ON public.bank_connections;
DROP POLICY IF EXISTS "Users can view own connections via view" ON public.bank_connections;

-- Step 2: Create a secure view that EXCLUDES sensitive token columns
-- Using security_invoker so the view respects RLS policies
CREATE OR REPLACE VIEW public.bank_connections_safe
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
  provider,
  status,
  last_synced_at,
  created_at,
  updated_at
  -- Explicitly EXCLUDING: access_token, refresh_token, token_expires_at
FROM public.bank_connections;

-- Step 3: Create new SELECT policy that allows access ONLY through the secure view
-- This uses a function to check if the query is coming from the view context
CREATE OR REPLACE FUNCTION public.is_viewing_via_safe_view()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Allow SELECT only when accessed via the safe view or by service role
  SELECT current_setting('role', true) = 'service_role' 
    OR current_setting('request.path', true) LIKE '%bank_connections_safe%'
$$;

-- Step 4: Create restrictive SELECT policy for the base table
-- Only service_role can SELECT directly (for edge functions)
CREATE POLICY "Only service role can read tokens directly"
ON public.bank_connections
FOR SELECT
TO authenticated, anon
USING (false);

-- Step 5: Create a permissive policy for service_role
-- Edge functions using service_role key need full access
CREATE POLICY "Service role has full read access"
ON public.bank_connections
FOR SELECT
TO service_role
USING (true);

-- Step 6: Grant SELECT on the safe view to authenticated users
GRANT SELECT ON public.bank_connections_safe TO authenticated;

-- Step 7: Add comment explaining the security model
COMMENT ON VIEW public.bank_connections_safe IS 
'Secure view of bank_connections that excludes sensitive token columns. 
All client-side queries MUST use this view instead of the base table.
The base table SELECT is restricted to service_role only.';