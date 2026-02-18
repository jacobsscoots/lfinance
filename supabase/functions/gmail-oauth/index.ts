import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const postBodySchema = z.object({
  action: z.enum(["get_auth_url", "exchange_token", "refresh_token"]),
  code: z.string().max(2048).optional(),
  redirect_uri: z.string().url().max(2048).optional(),
  origin: z.string().url().max(2048).optional(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Get the app URL from environment or construct from Supabase URL
function getAppUrl(): string {
  return 'https://id-preview--36524aa1-2514-4747-886c-3289071195f0.lovable.app';
}

serve(async (req) => {
  const url = new URL(req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for required secrets
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({
          error: 'Gmail integration not configured',
          message: 'Google OAuth credentials are not set up. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET secrets.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Handle GET requests (OAuth callback from Google)
    if (req.method === 'GET') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      // Try to extract origin from state, fall back to getAppUrl()
      let appUrl = getAppUrl();
      if (state) {
        try {
          const stateData = JSON.parse(atob(state));
          if (stateData.origin) {
            appUrl = stateData.origin;
          }
        } catch (e) {
          // Fall through to use default appUrl
        }
      }

      if (error) {
        // User denied access or other error
        return Response.redirect(`${appUrl}/settings?gmail_error=${encodeURIComponent(error)}`, 302);
      }

      if (!code || !state) {
        return Response.redirect(`${appUrl}/settings?gmail_error=missing_code`, 302);
      }

      // Decode state to get user ID
      let userId: string;
      try {
        const stateData = JSON.parse(atob(state));
        userId = stateData.userId;
        if (!userId) throw new Error('No user ID in state');
      } catch (e) {
        return Response.redirect(`${appUrl}/settings?gmail_error=invalid_state`, 302);
      }

      // Exchange authorization code for tokens
      const redirectUri = `${SUPABASE_URL}/functions/v1/gmail-oauth`;
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange failed:', errorText);
        return Response.redirect(`${appUrl}/settings?gmail_error=token_exchange_failed`, 302);
      }

      const tokens = await tokenResponse.json();

      if (!tokens.refresh_token) {
        console.error('No refresh token received - user may need to re-authorize');
      }

      // Get user email from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userInfoResponse.ok) {
        return Response.redirect(`${appUrl}/settings?gmail_error=user_info_failed`, 302);
      }

      const userInfo = await userInfoResponse.json();

      // Store/update the Gmail connection
      const { error: upsertError } = await supabase
        .from('gmail_connections')
        .upsert({
          user_id: userId,
          email: userInfo.email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          status: 'active',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (upsertError) {
        console.error('Failed to store connection:', upsertError);
        return Response.redirect(`${appUrl}/settings?gmail_error=storage_failed`, 302);
      }

      // Create default sync settings if not exists
      await supabase
        .from('gmail_sync_settings')
        .upsert({
          user_id: userId,
          auto_attach: true,
          scan_days: 30,
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: true,
        });

      // Redirect back to settings with success
      return Response.redirect(`${appUrl}/settings?gmail_connected=true`, 302);
    }

    // Handle POST requests (API calls from frontend)
    const rawBody = await req.json();
    const parseResult = postBodySchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parseResult.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const body = parseResult.data;
    const { action, code, redirect_uri } = body;

    if (action === 'get_auth_url') {
      // Get the authorization header to identify the user
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('No authorization header - user must be logged in');
      }

      // Verify the JWT and get user
      const jwt = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

      if (authError || !user) {
        throw new Error('Unauthorized');
      }

      // Generate state with user ID and origin for callback redirect
      const appOrigin = body.origin || getAppUrl();
      const state = btoa(JSON.stringify({ userId: user.id, timestamp: Date.now(), origin: appOrigin }));

      // Generate OAuth URL for Gmail
      const scopes = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ];

      const callbackUrl = `${SUPABASE_URL}/functions/v1/gmail-oauth`;
      
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', callbackUrl);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', scopes.join(' '));
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('state', state);

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'exchange_token') {
      // Exchange authorization code for tokens (used for custom redirect flows)
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code: code ?? '',
          grant_type: 'authorization_code',
          redirect_uri: redirect_uri || `${SUPABASE_URL}/functions/v1/gmail-oauth`,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const tokens = await tokenResponse.json();

      // Get user email from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userInfoResponse.ok) {
        throw new Error('Failed to get user info');
      }

      const userInfo = await userInfoResponse.json();

      return new Response(
        JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          email: userInfo.email,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'refresh_token') {
      // Get the authorization header
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('No authorization header');
      }

      // Verify the JWT and get user
      const jwt = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

      if (authError || !user) {
        throw new Error('Unauthorized');
      }

      // Get the user's Gmail connection
      const { data: connection, error: connError } = await supabase
        .from('gmail_connections')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (connError || !connection?.refresh_token) {
        throw new Error('No Gmail connection found');
      }

      // Refresh the token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: connection.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!tokenResponse.ok) {
        // Mark connection as error
        await supabase
          .from('gmail_connections')
          .update({ status: 'error' })
          .eq('id', connection.id);

        throw new Error('Token refresh failed');
      }

      const tokens = await tokenResponse.json();

      // Update the connection with new access token
      await supabase
        .from('gmail_connections')
        .update({
          access_token: tokens.access_token,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          status: 'active',
        })
        .eq('id', connection.id);

      return new Response(
        JSON.stringify({
          access_token: tokens.access_token,
          expires_in: tokens.expires_in,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Gmail OAuth error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});