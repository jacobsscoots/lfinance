-- Fix encrypt_token: fall back to plain-text storage when jwt_secret is unavailable
CREATE OR REPLACE FUNCTION public.encrypt_token(plain_text text)
 RETURNS bytea
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  jwt_secret text;
  encryption_key bytea;
BEGIN
  IF plain_text IS NULL THEN RETURN NULL; END IF;
  
  jwt_secret := current_setting('app.settings.jwt_secret', true);
  
  -- If jwt_secret is not available, return NULL so the caller
  -- knows encryption is unavailable and can fall back to plain storage
  IF jwt_secret IS NULL OR jwt_secret = '' THEN
    RETURN NULL;
  END IF;
  
  encryption_key := extensions.digest(jwt_secret || 'bank_token_encryption_v1', 'sha256');
  RETURN extensions.pgp_sym_encrypt(plain_text, encode(encryption_key, 'hex'));
END;
$function$;

-- Fix store_bank_connection_tokens: keep plain tokens when encryption is unavailable
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
 SET search_path TO 'public'
AS $function$
DECLARE
  encrypted_access bytea;
  encrypted_refresh bytea;
BEGIN
  encrypted_access := public.encrypt_token(p_access_token);
  encrypted_refresh := public.encrypt_token(p_refresh_token);
  
  IF encrypted_access IS NOT NULL THEN
    -- Encryption worked: store encrypted, clear plain
    UPDATE public.bank_connections SET
      access_token = NULL,
      refresh_token = NULL,
      access_token_encrypted = encrypted_access,
      refresh_token_encrypted = encrypted_refresh,
      token_expires_at = COALESCE(p_token_expires_at, token_expires_at),
      status = COALESCE(p_status, status),
      updated_at = now()
    WHERE id = p_connection_id;
  ELSE
    -- Encryption unavailable: store plain, clear encrypted
    UPDATE public.bank_connections SET
      access_token = p_access_token,
      refresh_token = p_refresh_token,
      access_token_encrypted = NULL,
      refresh_token_encrypted = NULL,
      token_expires_at = COALESCE(p_token_expires_at, token_expires_at),
      status = COALESCE(p_status, status),
      updated_at = now()
    WHERE id = p_connection_id;
  END IF;
END;
$function$;