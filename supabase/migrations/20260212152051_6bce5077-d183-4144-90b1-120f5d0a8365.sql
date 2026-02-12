
-- Step 1: Remove unnecessary client-side policies on bank_connections
DROP POLICY IF EXISTS "Users can create own bank connections" ON public.bank_connections;
DROP POLICY IF EXISTS "Users can update own bank connections" ON public.bank_connections;
DROP POLICY IF EXISTS "Users can delete own bank connections" ON public.bank_connections;

-- Step 2: Add encrypted token columns
ALTER TABLE public.bank_connections 
  ADD COLUMN IF NOT EXISTS access_token_encrypted bytea,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted bytea;

-- Step 3: Create encryption/decryption functions using pgcrypto from extensions schema
CREATE OR REPLACE FUNCTION public.encrypt_token(plain_text text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  encryption_key bytea;
BEGIN
  IF plain_text IS NULL THEN RETURN NULL; END IF;
  encryption_key := extensions.digest(current_setting('app.settings.jwt_secret', true) || 'bank_token_encryption_v1', 'sha256');
  RETURN extensions.pgp_sym_encrypt(plain_text, encode(encryption_key, 'hex'));
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted_data bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  encryption_key bytea;
BEGIN
  IF encrypted_data IS NULL THEN RETURN NULL; END IF;
  encryption_key := extensions.digest(current_setting('app.settings.jwt_secret', true) || 'bank_token_encryption_v1', 'sha256');
  RETURN extensions.pgp_sym_decrypt(encrypted_data, encode(encryption_key, 'hex'));
END;
$$;

-- Step 4: Secure token retrieval function (used by edge functions via service role)
CREATE OR REPLACE FUNCTION public.get_bank_connection_tokens(p_connection_id uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  access_token text,
  refresh_token text,
  token_expires_at timestamp with time zone,
  provider text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bc.id,
    bc.user_id,
    CASE 
      WHEN bc.access_token_encrypted IS NOT NULL THEN public.decrypt_token(bc.access_token_encrypted)
      ELSE bc.access_token
    END as access_token,
    CASE 
      WHEN bc.refresh_token_encrypted IS NOT NULL THEN public.decrypt_token(bc.refresh_token_encrypted)
      ELSE bc.refresh_token
    END as refresh_token,
    bc.token_expires_at,
    bc.provider,
    bc.status
  FROM public.bank_connections bc
  WHERE bc.id = p_connection_id;
END;
$$;

-- Step 5: Secure token storage function (used by edge functions via service role)
CREATE OR REPLACE FUNCTION public.store_bank_connection_tokens(
  p_connection_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_token_expires_at timestamp with time zone DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.bank_connections SET
    access_token = NULL,
    refresh_token = NULL,
    access_token_encrypted = public.encrypt_token(p_access_token),
    refresh_token_encrypted = public.encrypt_token(p_refresh_token),
    token_expires_at = COALESCE(p_token_expires_at, token_expires_at),
    status = COALESCE(p_status, status),
    updated_at = now()
  WHERE id = p_connection_id;
END;
$$;

-- Step 6: Encrypt any existing plaintext tokens
UPDATE public.bank_connections 
SET 
  access_token_encrypted = public.encrypt_token(access_token),
  refresh_token_encrypted = public.encrypt_token(refresh_token),
  access_token = NULL,
  refresh_token = NULL
WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL;
