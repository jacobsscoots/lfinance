
-- Remove redundant service role SELECT policies from sensitive token tables
-- The service_role_key already bypasses RLS by default, so these policies are unnecessary
-- and create a larger attack surface if the key is compromised

DROP POLICY IF EXISTS "Service role full access" ON public.bank_connections;
DROP POLICY IF EXISTS "Service role select gmail_connections" ON public.gmail_connections;
DROP POLICY IF EXISTS "Service role select bright_connections" ON public.bright_connections;
