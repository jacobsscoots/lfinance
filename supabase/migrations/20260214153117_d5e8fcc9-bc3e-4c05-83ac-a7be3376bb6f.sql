-- Drop the duplicate partial unique indexes (keep just one set)
DROP INDEX IF EXISTS idx_transactions_external_id_unique;
DROP INDEX IF EXISTS idx_transactions_dedup;

-- Replace the partial unique index with a non-partial one so ON CONFLICT works
-- We need to handle NULL external_id values, so we use COALESCE
-- Actually, the simplest approach: just make the existing partial index work
-- by creating a proper unique constraint that Postgres ON CONFLICT can reference.

-- Drop the old partial indexes
DROP INDEX IF EXISTS idx_transactions_external_id_account;
DROP INDEX IF EXISTS idx_transactions_no_extid_dedup;

-- Create a non-partial unique index on (account_id, external_id) 
-- For rows with NULL external_id, each NULL is considered distinct, so no conflict
-- This allows ON CONFLICT (account_id, external_id) to work for non-NULL external_id rows
CREATE UNIQUE INDEX idx_transactions_external_id_account 
ON public.transactions (account_id, external_id);
