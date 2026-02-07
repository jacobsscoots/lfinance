import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TRUELAYER_AUTH_URL = 'https://auth.truelayer.com';

// Input validation helpers
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_URL_LENGTH = 2048;
const MAX_CODE_LENGTH = 2048;

function isValidUUID(value: string | undefined): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function isValidHttpsUrl(value: string | undefined): boolean {
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidCode(value: string | undefined): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_CODE_LENGTH;
}

interface RequestBody {
  action?: 'auth-url' | 'exchange-code' | 'refresh-token';
  redirectUri?: string;
  code?: string;
  connectionId?: string;
}

function jsonResponse(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(error: string, stage: string, status = 400, details?: unknown) {
  console.error(`[${stage}] ${error}`, details || '');
  return jsonResponse({ error, stage, details }, status);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TRUELAYER_CLIENT_ID = Deno.env.get('TRUELAYER_CLIENT_ID');
    const TRUELAYER_CLIENT_SECRET = Deno.env.get('TRUELAYER_CLIENT_SECRET');

    if (!TRUELAYER_CLIENT_ID || !TRUELAYER_CLIENT_SECRET) {
      return errorResponse(
        'TrueLayer credentials not configured. Please add TRUELAYER_CLIENT_ID and TRUELAYER_CLIENT_SECRET secrets.',
        'config',
        500
      );
    }

    // Validate JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('Missing or invalid Authorization header', 'auth', 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return errorResponse('Invalid or expired token', 'auth', 401);
    }

    const userId = claimsData.claims.sub as string;
    console.log(`[auth] Authenticated user: ${userId}`);

    // Parse action from query string OR body (body takes precedence)
    const url = new URL(req.url);
    let action = url.searchParams.get('action') as RequestBody['action'] | null;
    
    let body: RequestBody = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch {
        // Body might be empty or not JSON, that's okay
      }
    }

    // Body action overrides query string
    if (body.action) {
      action = body.action;
    }

    // Validate action
    const validActions = ['auth-url', 'exchange-code', 'refresh-token'];
    if (!action || !validActions.includes(action)) {
      return errorResponse(
        `Missing or invalid action. Expected one of: ${validActions.join(', ')}`,
        'validation',
        400
      );
    }

    // Generate auth URL for user to connect their bank
    if (action === 'auth-url') {
      const redirectUri = body.redirectUri || url.searchParams.get('redirectUri');
      
      if (!redirectUri) {
        return errorResponse('Missing redirectUri parameter', 'auth-url', 400);
      }

      if (!isValidHttpsUrl(redirectUri)) {
        return errorResponse('Invalid redirectUri: must be a valid HTTPS URL', 'auth-url', 400);
      }

      const scopes = [
        'info',
        'accounts',
        'balance',
        'transactions',
        'offline_access'
      ].join('%20');

      const authUrl = `${TRUELAYER_AUTH_URL}/?` +
        `response_type=code&` +
        `client_id=${TRUELAYER_CLIENT_ID}&` +
        `scope=${scopes}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `providers=uk-ob-all%20uk-oauth-all`;

      console.log('[auth-url] Generated auth URL for redirect:', redirectUri);
      return jsonResponse({ authUrl });
    }

    // Exchange authorization code for tokens - stores tokens server-side only
    if (action === 'exchange-code') {
      const code = body.code || url.searchParams.get('code');
      const redirectUri = body.redirectUri || url.searchParams.get('redirectUri');
      const connectionId = body.connectionId;

      if (!code) {
        return errorResponse('Missing code parameter', 'exchange-code', 400);
      }
      if (!isValidCode(code)) {
        return errorResponse('Invalid code format', 'exchange-code', 400);
      }
      if (!redirectUri) {
        return errorResponse('Missing redirectUri parameter', 'exchange-code', 400);
      }
      if (!isValidHttpsUrl(redirectUri)) {
        return errorResponse('Invalid redirectUri: must be a valid HTTPS URL', 'exchange-code', 400);
      }
      if (!connectionId) {
        return errorResponse('Missing connectionId parameter', 'exchange-code', 400);
      }
      if (!isValidUUID(connectionId)) {
        return errorResponse('Invalid connectionId: must be a valid UUID', 'exchange-code', 400);
      }

      // Verify the connection belongs to this user
      const { data: connection, error: connError } = await supabase
        .from('bank_connections')
        .select('id, user_id')
        .eq('id', connectionId)
        .single();

      if (connError || !connection) {
        return errorResponse('Connection not found', 'exchange-code', 404);
      }

      if (connection.user_id !== userId) {
        return errorResponse('Connection does not belong to this user', 'exchange-code', 403);
      }

      console.log('[exchange-code] Exchanging code for tokens...');

      const tokenResponse = await fetch(`${TRUELAYER_AUTH_URL}/connect/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: TRUELAYER_CLIENT_ID,
          client_secret: TRUELAYER_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        return errorResponse(
          'Failed to exchange code for tokens',
          'exchange-code',
          400,
          tokenData
        );
      }

      // Store tokens server-side in the database - NEVER send to client
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

      const { error: updateError } = await supabase
        .from('bank_connections')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          status: 'connected',
        })
        .eq('id', connectionId);

      if (updateError) {
        console.error('[exchange-code] Failed to store tokens:', updateError);
        return errorResponse('Failed to store connection tokens', 'exchange-code', 500);
      }

      console.log('[exchange-code] Token exchange and storage successful');
      // Return success but NOT the tokens - they stay server-side
      return jsonResponse({ 
        success: true,
        connectionId,
      });
    }

    // Refresh access token - only called server-side by sync function
    if (action === 'refresh-token') {
      const connectionId = body.connectionId;

      if (!connectionId) {
        return errorResponse('Missing connectionId parameter', 'refresh-token', 400);
      }
      if (!isValidUUID(connectionId)) {
        return errorResponse('Invalid connectionId: must be a valid UUID', 'refresh-token', 400);
      }

      // Get the connection and verify ownership
      const { data: connection, error: connError } = await supabase
        .from('bank_connections')
        .select('id, user_id, refresh_token')
        .eq('id', connectionId)
        .single();

      if (connError || !connection) {
        return errorResponse('Connection not found', 'refresh-token', 404);
      }

      if (connection.user_id !== userId) {
        return errorResponse('Connection does not belong to this user', 'refresh-token', 403);
      }

      if (!connection.refresh_token) {
        return errorResponse('No refresh token available', 'refresh-token', 400);
      }

      console.log('[refresh-token] Refreshing access token...');

      const tokenResponse = await fetch(`${TRUELAYER_AUTH_URL}/connect/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: TRUELAYER_CLIENT_ID,
          client_secret: TRUELAYER_CLIENT_SECRET,
          refresh_token: connection.refresh_token,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        return errorResponse(
          'Failed to refresh token',
          'refresh-token',
          400,
          tokenData
        );
      }

      // Update tokens in database
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

      await supabase
        .from('bank_connections')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt.toISOString(),
        })
        .eq('id', connectionId);

      console.log('[refresh-token] Token refresh successful');
      return jsonResponse({ success: true });
    }

    return errorResponse('Invalid action', 'validation', 400);

  } catch (error) {
    console.error('[unexpected]', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      'unexpected',
      500
    );
  }
});
