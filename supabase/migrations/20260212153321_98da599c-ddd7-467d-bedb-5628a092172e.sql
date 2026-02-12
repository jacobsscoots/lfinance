-- Unique index for bank-synced transactions (have external_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_id_account
  ON public.transactions (account_id, external_id)
  WHERE external_id IS NOT NULL;

-- Unique index for manual/imported transactions (no external_id)
-- Prevents same description+amount+date+type on same account
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_no_extid_dedup
  ON public.transactions (account_id, transaction_date, description, amount, type)
  WHERE external_id IS NULL;