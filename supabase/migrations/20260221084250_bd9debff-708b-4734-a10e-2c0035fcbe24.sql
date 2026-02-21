
-- Add encrypted columns alongside existing text columns
ALTER TABLE public.bank_accounts 
  ADD COLUMN IF NOT EXISTS external_id_encrypted bytea,
  ADD COLUMN IF NOT EXISTS display_name_encrypted bytea;

ALTER TABLE public.gmail_connections
  ADD COLUMN IF NOT EXISTS email_encrypted bytea;

ALTER TABLE public.grocery_orders
  ADD COLUMN IF NOT EXISTS order_reference_encrypted bytea;

ALTER TABLE public.debt_transactions
  ADD COLUMN IF NOT EXISTS reference_encrypted bytea,
  ADD COLUMN IF NOT EXISTS description_encrypted bytea;

-- Migrate existing plaintext data to encrypted columns
UPDATE public.bank_accounts 
SET external_id_encrypted = public.encrypt_token(external_id),
    display_name_encrypted = public.encrypt_token(display_name)
WHERE external_id IS NOT NULL OR display_name IS NOT NULL;

UPDATE public.gmail_connections
SET email_encrypted = public.encrypt_token(email)
WHERE email IS NOT NULL;

UPDATE public.grocery_orders
SET order_reference_encrypted = public.encrypt_token(order_reference)
WHERE order_reference IS NOT NULL;

UPDATE public.debt_transactions
SET reference_encrypted = public.encrypt_token(reference),
    description_encrypted = public.encrypt_token(description)
WHERE reference IS NOT NULL OR description IS NOT NULL;

-- Create safe read functions that return decrypted data

CREATE OR REPLACE FUNCTION public.get_bank_accounts_decrypted()
RETURNS TABLE(
  id uuid, user_id uuid, name text, balance numeric, 
  account_type text, is_primary boolean, is_hidden boolean,
  provider text, connection_id uuid, created_at timestamptz, updated_at timestamptz,
  last_synced_at timestamptz, deleted_at timestamptz,
  external_id text, display_name text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ba.id, ba.user_id, ba.name, ba.balance,
    ba.account_type, ba.is_primary, ba.is_hidden,
    ba.provider, ba.connection_id, ba.created_at, ba.updated_at,
    ba.last_synced_at, ba.deleted_at,
    CASE WHEN ba.external_id_encrypted IS NOT NULL THEN public.decrypt_token(ba.external_id_encrypted) ELSE ba.external_id END,
    CASE WHEN ba.display_name_encrypted IS NOT NULL THEN public.decrypt_token(ba.display_name_encrypted) ELSE ba.display_name END
  FROM public.bank_accounts ba
  WHERE ba.user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_gmail_connections_decrypted()
RETURNS TABLE(
  id uuid, user_id uuid, email text, 
  last_synced_at timestamptz, status text, 
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gc.id, gc.user_id,
    CASE WHEN gc.email_encrypted IS NOT NULL THEN public.decrypt_token(gc.email_encrypted) ELSE gc.email END,
    gc.last_synced_at, gc.status, gc.created_at, gc.updated_at
  FROM public.gmail_connections gc
  WHERE gc.user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_debt_transactions_decrypted()
RETURNS TABLE(
  id uuid, user_id uuid, amount numeric, transaction_date text,
  description text, reference text, account_name text, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dt.id, dt.user_id, dt.amount, dt.transaction_date,
    CASE WHEN dt.description_encrypted IS NOT NULL THEN public.decrypt_token(dt.description_encrypted) ELSE dt.description END,
    CASE WHEN dt.reference_encrypted IS NOT NULL THEN public.decrypt_token(dt.reference_encrypted) ELSE dt.reference END,
    dt.account_name, dt.created_at
  FROM public.debt_transactions dt
  WHERE dt.user_id = auth.uid();
END;
$$;

-- Clear plaintext after successful encryption (only where encrypted version exists)
UPDATE public.bank_accounts 
SET external_id = NULL, display_name = NULL
WHERE external_id_encrypted IS NOT NULL;

UPDATE public.gmail_connections
SET email = '***'
WHERE email_encrypted IS NOT NULL;

UPDATE public.grocery_orders
SET order_reference = NULL
WHERE order_reference_encrypted IS NOT NULL;

UPDATE public.debt_transactions
SET reference = NULL, description = '***'
WHERE reference_encrypted IS NOT NULL OR description_encrypted IS NOT NULL;
