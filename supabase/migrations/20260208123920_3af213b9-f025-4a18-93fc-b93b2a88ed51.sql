-- Step 1: Remove orphaned soft-deleted accounts so sync can recreate them
DELETE FROM public.bank_accounts 
WHERE deleted_at IS NOT NULL;

-- Step 2: Drop existing partial unique indexes
DROP INDEX IF EXISTS bank_accounts_provider_external_id_unique;
DROP INDEX IF EXISTS bank_accounts_provider_external_id_key;

-- Step 3: Recreate unique index that only applies to active accounts
-- This prevents future conflicts if any soft-deleted rows somehow remain
CREATE UNIQUE INDEX bank_accounts_provider_external_id_unique 
ON public.bank_accounts (provider, external_id) 
WHERE provider IS NOT NULL 
  AND external_id IS NOT NULL 
  AND deleted_at IS NULL;