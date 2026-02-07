import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TRUELAYER_AUTH_URL = 'https://auth.truelayer.com';

interface RequestBody {
  action?: 'auth-url' | 'exchange-code' | 'refresh-token';
  redirectUri?: string;
  code?: string;
  refreshToken?: string;
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

    // Exchange authorization code for tokens
    if (action === 'exchange-code') {
      const code = body.code || url.searchParams.get('code');
      const redirectUri = body.redirectUri || url.searchParams.get('redirectUri');

      if (!code) {
        return errorResponse('Missing code parameter', 'exchange-code', 400);
      }
      if (!redirectUri) {
        return errorResponse('Missing redirectUri parameter', 'exchange-code', 400);
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

      console.log('[exchange-code] Token exchange successful');
      return jsonResponse({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
      });
    }

    // Refresh access token
    if (action === 'refresh-token') {
      const refreshToken = body.refreshToken || url.searchParams.get('refreshToken');

      if (!refreshToken) {
        return errorResponse('Missing refreshToken parameter', 'refresh-token', 400);
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
          refresh_token: refreshToken,
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

      console.log('[refresh-token] Token refresh successful');
      return jsonResponse({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
      });
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
