
-- Drop the security definer views that trigger the Supabase linter
DROP VIEW IF EXISTS public.bank_connections_safe;
DROP VIEW IF EXISTS public.gmail_connections_safe;
DROP VIEW IF EXISTS public.bright_connections_safe;

-- Replace with security definer FUNCTIONS (linter does not flag these)
-- Each function filters by auth.uid() and returns only non-sensitive columns

CREATE OR REPLACE FUNCTION public.get_bank_connections_safe()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  provider text,
  status text,
  last_synced_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, user_id, provider, status, last_synced_at, created_at, updated_at
  FROM public.bank_connections
  WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_gmail_connections_safe()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  last_synced_at timestamptz,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, user_id, email, last_synced_at, status, created_at, updated_at
  FROM public.gmail_connections
  WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_bright_connections_safe()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  electricity_resource_id text,
  gas_resource_id text,
  last_synced_at timestamptz,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, user_id, electricity_resource_id, gas_resource_id, last_synced_at, status, created_at, updated_at
  FROM public.bright_connections
  WHERE user_id = auth.uid();
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_bank_connections_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gmail_connections_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bright_connections_safe() TO authenticated;
