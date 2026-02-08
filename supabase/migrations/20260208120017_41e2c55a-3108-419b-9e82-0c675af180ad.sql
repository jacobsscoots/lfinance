-- Drop the overly permissive policy that's overriding the soft-delete filter
DROP POLICY IF EXISTS "Users can view own accounts" ON bank_accounts;