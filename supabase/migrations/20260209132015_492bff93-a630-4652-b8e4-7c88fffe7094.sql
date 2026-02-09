
-- ============================================================
-- 1. bright_connections: create safe view, restrict base table SELECT
-- ============================================================

-- Create secure view excluding token columns
CREATE OR REPLACE VIEW public.bright_connections_safe
WITH (security_invoker = on) AS
SELECT id, user_id, electricity_resource_id, gas_resource_id,
       last_synced_at, status, created_at, updated_at
FROM public.bright_connections;

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own bright connection" ON public.bright_connections;

-- Block direct SELECT for authenticated/anon users
CREATE POLICY "No direct select on bright_connections"
ON public.bright_connections FOR SELECT TO authenticated, anon USING (false);

-- Allow service role full SELECT access for edge functions
CREATE POLICY "Service role select bright_connections"
ON public.bright_connections FOR SELECT TO service_role USING (true);

-- Grant view access
GRANT SELECT ON public.bright_connections_safe TO authenticated;

-- ============================================================
-- 2. gmail_connections: create safe view, restrict base table SELECT
-- ============================================================

-- Create secure view excluding token columns
CREATE OR REPLACE VIEW public.gmail_connections_safe
WITH (security_invoker = on) AS
SELECT id, user_id, email, last_synced_at, status, created_at, updated_at
FROM public.gmail_connections;

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view own gmail connections" ON public.gmail_connections;

-- Block direct SELECT for authenticated/anon users
CREATE POLICY "No direct select on gmail_connections"
ON public.gmail_connections FOR SELECT TO authenticated, anon USING (false);

-- Allow service role full SELECT access for edge functions
CREATE POLICY "Service role select gmail_connections"
ON public.gmail_connections FOR SELECT TO service_role USING (true);

-- Grant view access
GRANT SELECT ON public.gmail_connections_safe TO authenticated;

-- ============================================================
-- 3. bank_connections: fix the SELECT policy for authenticated users
-- The existing "Users can view own bank connections" policy allows
-- authenticated users to read tokens directly. Replace with deny.
-- They should use bank_connections_safe view instead.
-- ============================================================

DROP POLICY IF EXISTS "Users can view own bank connections" ON public.bank_connections;

CREATE POLICY "No direct select on bank_connections"
ON public.bank_connections FOR SELECT TO authenticated, anon USING (false);
