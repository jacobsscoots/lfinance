-- Clean up duplicate bank accounts, keeping the oldest by created_at for each external_id
DELETE FROM public.bank_accounts
WHERE id NOT IN (
  SELECT DISTINCT ON (external_id) id
  FROM public.bank_accounts
  WHERE external_id IS NOT NULL
  ORDER BY external_id, created_at ASC
);

-- Drop the old composite index if it exists (NULL provider values bypass it)
DROP INDEX IF EXISTS public.bank_accounts_provider_external_id;

-- Create a proper unique index on external_id alone (where not null)
CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_external_id_unique 
ON public.bank_accounts(external_id) WHERE external_id IS NOT NULL;