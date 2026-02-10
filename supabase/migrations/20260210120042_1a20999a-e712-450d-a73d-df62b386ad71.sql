-- Fix: Recreate bank_connections_safe view with user scoping
-- The view is SECURITY DEFINER (intentionally, to bypass base table's USING(false) policy)
-- but it MUST filter rows to only the authenticated user's own data
DROP VIEW IF EXISTS public.bank_connections_safe;

CREATE VIEW public.bank_connections_safe AS
  SELECT id, user_id, provider, status, last_synced_at, created_at, updated_at
  FROM public.bank_connections
  WHERE auth.uid() = user_id;

-- Drop the is_viewing_via_safe_view function as it's no longer needed
-- (the base table SELECT policy already blocks direct access via USING(false))
DROP FUNCTION IF EXISTS public.is_viewing_via_safe_view();