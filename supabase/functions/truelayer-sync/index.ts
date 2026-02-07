import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TRUELAYER_API_URL = 'https://api.truelayer.com';
const TRUELAYER_AUTH_URL = 'https://auth.truelayer.com';

// Input validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string | undefined): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value);
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
    console.log(`[sync] Authenticated user: ${userId}`);

    const { connectionId } = await req.json();

    if (!connectionId) {
      return errorResponse('Missing connectionId parameter', 'validation', 400);
    }
    
    if (!isValidUUID(connectionId)) {
      return errorResponse('Invalid connectionId: must be a valid UUID', 'validation', 400);
    }

    // Get connection details server-side - tokens never exposed to client
    // Use service role to bypass RLS and access tokens securely
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: connection, error: connError } = await serviceSupabase
      .from('bank_connections')
      .select('id, user_id, access_token, refresh_token, token_expires_at, provider')
      .eq('id', connectionId)
      .single();

    if (connError || !connection) {
      return errorResponse('Connection not found', 'sync', 404);
    }

    // Verify ownership
    if (connection.user_id !== userId) {
      return errorResponse('Connection does not belong to this user', 'sync', 403);
    }

    if (!connection.access_token) {
      return errorResponse('No access token available. Please reconnect your bank.', 'sync', 400);
    }

    let accessToken = connection.access_token;
    const connectionProvider = connection.provider || 'truelayer';

    // Check if token needs refresh
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      console.log('[sync] Token expired, refreshing...');
      
      const TRUELAYER_CLIENT_ID = Deno.env.get('TRUELAYER_CLIENT_ID');
      const TRUELAYER_CLIENT_SECRET = Deno.env.get('TRUELAYER_CLIENT_SECRET');

      if (!TRUELAYER_CLIENT_ID || !TRUELAYER_CLIENT_SECRET) {
        return errorResponse('TrueLayer credentials not configured', 'sync', 500);
      }

      const tokenResponse = await fetch(`${TRUELAYER_AUTH_URL}/connect/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: TRUELAYER_CLIENT_ID,
          client_secret: TRUELAYER_CLIENT_SECRET,
          refresh_token: connection.refresh_token!,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        // Mark connection as needing reauthorization
        await serviceSupabase
          .from('bank_connections')
          .update({ status: 'expired' })
          .eq('id', connectionId);

        return errorResponse(
          'Token refresh failed. Please reconnect your bank.',
          'sync',
          401,
          tokenData
        );
      }

      // Update tokens
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

      await serviceSupabase
        .from('bank_connections')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt.toISOString(),
        })
        .eq('id', connectionId);

      accessToken = tokenData.access_token;
      console.log('[sync] Token refreshed successfully');
    }

    // Fetch accounts from TrueLayer
    const accountsResponse = await fetch(`${TRUELAYER_API_URL}/data/v1/accounts`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!accountsResponse.ok) {
      const errorData = await accountsResponse.json();
      console.error('[sync] TrueLayer accounts fetch failed:', errorData);
      return errorResponse('Failed to fetch accounts from bank', 'sync', 400, errorData);
    }

    const { results: accounts } = await accountsResponse.json();

    // Process each account using UPSERT by (provider, external_id)
    const syncedAccounts = [];
    for (const account of accounts) {
      // Fetch balance for this account
      const balanceResponse = await fetch(
        `${TRUELAYER_API_URL}/data/v1/accounts/${account.account_id}/balance`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      let balance = 0;
      if (balanceResponse.ok) {
        const { results: balances } = await balanceResponse.json();
        balance = balances[0]?.current || 0;
      }

      // Extract provider from account data if available, fallback to connection provider
      const accountProvider = account.provider?.provider_id || connectionProvider;
      const accountType = account.account_type === 'SAVINGS' ? 'savings' : 'current';
      const accountName = account.display_name || account.account_number?.number || 'Bank Account';

      // Check if account already exists using (provider, external_id) composite key
      const { data: existingAccount } = await supabase
        .from('bank_accounts')
        .select('id, display_name')
        .eq('external_id', account.account_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingAccount) {
        // Update existing account - preserve display_name if set
        const { error: updateError } = await supabase
          .from('bank_accounts')
          .update({
            balance,
            name: accountName, // Update synced name
            provider: accountProvider, // Ensure provider is set
            last_synced_at: new Date().toISOString(),
            // Note: display_name is NOT updated here to preserve user customization
          })
          .eq('id', existingAccount.id);

        if (updateError) {
          console.error('[sync] Error updating account:', updateError);
        } else {
          syncedAccounts.push({ ...account, balance, action: 'updated' });
        }
      } else {
        // Create new account with provider field
        const { error: insertError } = await supabase
          .from('bank_accounts')
          .insert({
            user_id: userId,
            name: accountName,
            account_type: accountType,
            balance,
            external_id: account.account_id,
            connection_id: connectionId,
            provider: accountProvider,
            last_synced_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('[sync] Error creating account:', insertError);
        } else {
          syncedAccounts.push({ ...account, balance, action: 'created' });
        }
      }
    }

    // Fetch transactions for each account
    let totalTransactions = 0;
    for (const account of accounts) {
      const txResponse = await fetch(
        `${TRUELAYER_API_URL}/data/v1/accounts/${account.account_id}/transactions`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (txResponse.ok) {
        const { results: transactions } = await txResponse.json();
        
        // Get the bank account ID
        const { data: bankAccount } = await supabase
          .from('bank_accounts')
          .select('id')
          .eq('external_id', account.account_id)
          .eq('user_id', userId)
          .maybeSingle();

        if (bankAccount) {
          for (const tx of transactions) {
            // Check if transaction already exists
            const { data: existingTx } = await supabase
              .from('transactions')
              .select('id')
              .eq('external_id', tx.transaction_id)
              .maybeSingle();

            if (!existingTx) {
              const txType = tx.amount < 0 ? 'expense' : 'income';
              const { error: txError } = await supabase
                .from('transactions')
                .insert({
                  account_id: bankAccount.id,
                  external_id: tx.transaction_id,
                  description: tx.description || 'Bank transaction',
                  amount: Math.abs(tx.amount),
                  type: txType,
                  transaction_date: tx.timestamp?.split('T')[0] || new Date().toISOString().split('T')[0],
                  merchant: tx.merchant_name || null,
                });

              if (!txError) {
                totalTransactions++;
              }
            }
          }
        }
      }
    }

    // Update connection status
    await supabase
      .from('bank_connections')
      .update({
        status: 'connected',
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', connectionId);

    console.log(`[sync] Completed: ${syncedAccounts.length} accounts, ${totalTransactions} new transactions`);

    return jsonResponse({
      success: true,
      accounts: syncedAccounts.length,
      transactions: totalTransactions,
    });

  } catch (error) {
    console.error('[sync] Unexpected error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      'unexpected',
      500
    );
  }
});
