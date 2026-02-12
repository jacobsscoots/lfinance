
-- Fix gmail_connections_safe view: must be security definer to bypass base table RLS
-- Drop and recreate without security_invoker (Postgres 15 defaults to security_invoker=on)
DROP VIEW IF EXISTS public.gmail_connections_safe;
CREATE VIEW public.gmail_connections_safe
WITH (security_invoker=off) AS
  SELECT id, user_id, email, last_synced_at, status, created_at, updated_at
  FROM public.gmail_connections
  WHERE user_id = (SELECT auth.uid());

-- Grant access to the view
GRANT SELECT ON public.gmail_connections_safe TO authenticated;

-- Also fix bright_connections_safe if it has the same issue
DROP VIEW IF EXISTS public.bright_connections_safe;
CREATE VIEW public.bright_connections_safe
WITH (security_invoker=off) AS
  SELECT id, user_id, electricity_resource_id, gas_resource_id, last_synced_at, status, created_at, updated_at
  FROM public.bright_connections
  WHERE user_id = (SELECT auth.uid());

GRANT SELECT ON public.bright_connections_safe TO authenticated;
