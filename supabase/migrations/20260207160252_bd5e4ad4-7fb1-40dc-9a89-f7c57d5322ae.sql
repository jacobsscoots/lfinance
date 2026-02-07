-- Fix unique index: use (provider, external_id) as the composite key
-- COALESCE handles NULL provider values to ensure uniqueness works

-- Drop the single-column index (doesn't prevent duplicates when provider varies)
DROP INDEX IF EXISTS public.bank_accounts_external_id_unique;

-- Create proper composite unique index
-- NULL providers are treated as 'unknown' for uniqueness purposes
CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_provider_external_id_key
ON public.bank_accounts (COALESCE(provider, 'unknown'), external_id)
WHERE external_id IS NOT NULL;

-- Add a comment on the index for documentation
COMMENT ON INDEX bank_accounts_provider_external_id_key IS 
  'Source of truth for bank account uniqueness: (provider, external_id). UI deduplication is defensive only.';