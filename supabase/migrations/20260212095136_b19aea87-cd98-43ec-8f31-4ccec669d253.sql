
-- Fix bright_connections_safe view: remove security_invoker so authenticated users can read through it
-- The base table RLS blocks direct access (good), but security_invoker=on prevents the view from working too
CREATE OR REPLACE VIEW public.bright_connections_safe AS
SELECT id, user_id, electricity_resource_id, gas_resource_id,
       last_synced_at, status, created_at, updated_at
FROM public.bright_connections;

-- Same fix for gmail_connections_safe
CREATE OR REPLACE VIEW public.gmail_connections_safe AS
SELECT id, user_id, email, last_synced_at, status, created_at, updated_at
FROM public.gmail_connections;

-- Add RLS-like filtering via the view itself (restrict to own rows)
-- We need to re-grant access
GRANT SELECT ON public.bright_connections_safe TO authenticated;
GRANT SELECT ON public.gmail_connections_safe TO authenticated;

-- Create security-definer functions to filter by user
CREATE OR REPLACE FUNCTION public.get_requesting_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

-- Recreate views with user filtering built in
CREATE OR REPLACE VIEW public.bright_connections_safe AS
SELECT id, user_id, electricity_resource_id, gas_resource_id,
       last_synced_at, status, created_at, updated_at
FROM public.bright_connections
WHERE user_id = public.get_requesting_user_id();

CREATE OR REPLACE VIEW public.gmail_connections_safe AS
SELECT id, user_id, email, last_synced_at, status, created_at, updated_at
FROM public.gmail_connections
WHERE user_id = public.get_requesting_user_id();

GRANT SELECT ON public.bright_connections_safe TO authenticated;
GRANT SELECT ON public.gmail_connections_safe TO authenticated;
