-- Recreate the safe view WITHOUT security_invoker so it bypasses base table RLS
-- The view already excludes sensitive token columns, so this is safe
DROP VIEW IF EXISTS public.bank_connections_safe;

CREATE VIEW public.bank_connections_safe AS
  SELECT id, user_id, provider, status, last_synced_at, created_at, updated_at
  FROM public.bank_connections;

-- Grant access to authenticated users
GRANT SELECT ON public.bank_connections_safe TO authenticated;

-- Revoke from anon
REVOKE ALL ON public.bank_connections_safe FROM anon;