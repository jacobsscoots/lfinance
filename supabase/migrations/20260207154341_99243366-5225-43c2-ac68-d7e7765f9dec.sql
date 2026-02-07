-- Add display_name and is_hidden columns to bank_accounts
ALTER TABLE bank_accounts
ADD COLUMN IF NOT EXISTS display_name text,
ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- Add provider column if it doesn't exist (for account-level provider tracking)
ALTER TABLE bank_accounts
ADD COLUMN IF NOT EXISTS provider text;

-- Create unique index on (provider, external_id) to prevent duplicate accounts
-- Only applies when both provider and external_id are not null (Open Banking accounts)
CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_provider_external_id_unique
ON bank_accounts(provider, external_id)
WHERE provider IS NOT NULL AND external_id IS NOT NULL;