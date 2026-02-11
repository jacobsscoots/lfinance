-- Prevent duplicate transactions from repeated imports
-- This index covers transactions with an external_id (bank-synced)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_id_unique 
ON public.transactions (account_id, external_id) 
WHERE external_id IS NOT NULL;

-- For non-bank-synced transactions, prevent exact duplicates
-- (same account, date, description, amount, type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_dedup
ON public.transactions (account_id, transaction_date, description, amount, type)
WHERE external_id IS NULL;