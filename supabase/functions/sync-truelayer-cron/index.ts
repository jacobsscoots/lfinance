import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TRUELAYER_API_URL = Deno.env.get('TRUELAYER_API_URL') || 'https://api.truelayer.com';
const TRUELAYER_AUTH_URL = Deno.env.get('TRUELAYER_AUTH_URL') || 'https://auth.truelayer.com';

const RATE_LIMIT_DELAY_MS = 500;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500) return response;
      if (attempt < retries) {
        console.log(`[retry] ${url} returned ${response.status}, retrying in ${RETRY_DELAY_MS}ms (attempt ${attempt + 1}/${retries})`);
        await sleep(RETRY_DELAY_MS);
      } else {
        return response;
      }
    } catch (err) {
      if (attempt < retries) {
        console.log(`[retry] ${url} threw error, retrying (attempt ${attempt + 1}/${retries}):`, err);
        await sleep(RETRY_DELAY_MS);
      } else {
        throw err;
      }
    }
  }
  throw new Error(`fetchWithRetry: should not reach here`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const clientId = Deno.env.get('TRUELAYER_CLIENT_ID');
  const clientSecret = Deno.env.get('TRUELAYER_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    console.error('[cron-sync] TRUELAYER_CLIENT_ID or TRUELAYER_CLIENT_SECRET not configured');
    return new Response(JSON.stringify({ error: 'TrueLayer credentials not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const serviceSupabase = createClient(supabaseUrl, serviceRoleKey);

  // Support single-user mode when called from the manual "Sync Now" button via cron function
  let singleConnectionId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    singleConnectionId = body?.connectionId || null;
  } catch { /* no body */ }

  // Fetch all active connections (or just one if specified)
  let query = serviceSupabase
    .from('bank_connections')
    .select('id, user_id, provider, status, last_synced_at')
    .in('status', ['connected', 'active']);

  if (singleConnectionId) {
    query = query.eq('id', singleConnectionId);
  }

  const { data: connections, error: connError } = await query;

  if (connError) {
    console.error('[cron-sync] Failed to fetch connections:', connError);
    return new Response(JSON.stringify({ error: 'Failed to fetch connections' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!connections || connections.length === 0) {
    console.log('[cron-sync] No active connections to sync');
    return new Response(JSON.stringify({ message: 'No active connections', synced: 0 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`[cron-sync] Processing ${connections.length} connection(s)`);

  const results: Array<{ connectionId: string; userId: string; status: string; accounts: number; transactions: number; error?: string }> = [];

  for (const connection of connections) {
    const logId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    // Create sync log entry
    await serviceSupabase.from('sync_logs').insert({
      id: logId,
      user_id: connection.user_id,
      connection_id: connection.id,
      status: 'pending',
      started_at: startedAt,
    });

    try {
      // ── Step A: Get tokens ──
      const { data: tokenRows, error: tokenErr } = await serviceSupabase
        .rpc('get_bank_connection_tokens', { p_connection_id: connection.id });

      const tokenData = tokenRows?.[0];
      if (tokenErr || !tokenData) {
        throw new Error('Failed to retrieve connection tokens');
      }

      let accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // ── Step B: Refresh token ──
      const isExpired = tokenData.token_expires_at && new Date(tokenData.token_expires_at) < new Date();
      if (isExpired || !accessToken) {
        console.log(`[cron-sync] Refreshing token for connection ${connection.id}`);

        const tokenResponse = await fetchWithRetry(`${TRUELAYER_AUTH_URL}/connect/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
          }),
        });

        const tokenResult = await tokenResponse.json();

        if (!tokenResponse.ok) {
          // Check for invalid_grant — mark as expired
          if (tokenResult.error === 'invalid_grant' || tokenResponse.status === 400) {
            await serviceSupabase
              .from('bank_connections')
              .update({
                status: 'expired',
                last_sync_error: 'Refresh token expired. Please reconnect your bank.',
                updated_at: new Date().toISOString(),
              })
              .eq('id', connection.id);

            await serviceSupabase.from('sync_logs').update({
              status: 'token_expired',
              error_message: 'Refresh token expired (invalid_grant)',
              completed_at: new Date().toISOString(),
            }).eq('id', logId);

            results.push({
              connectionId: connection.id,
              userId: connection.user_id,
              status: 'token_expired',
              accounts: 0,
              transactions: 0,
              error: 'Token expired',
            });
            continue;
          }
          throw new Error(`Token refresh failed: ${JSON.stringify(tokenResult)}`);
        }

        // Store new tokens
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + tokenResult.expires_in);

        await serviceSupabase.rpc('store_bank_connection_tokens', {
          p_connection_id: connection.id,
          p_access_token: tokenResult.access_token,
          p_refresh_token: tokenResult.refresh_token,
          p_token_expires_at: expiresAt.toISOString(),
        });

        accessToken = tokenResult.access_token;
        console.log(`[cron-sync] Token refreshed for connection ${connection.id}`);
      }

      const authHeaders = { 'Authorization': `Bearer ${accessToken}` };
      let totalAccounts = 0;
      let totalTransactions = 0;

      // ── Step C: Fetch accounts and balances ──
      const accountsResponse = await fetchWithRetry(`${TRUELAYER_API_URL}/data/v1/accounts`, {
        headers: authHeaders,
      });

      if (accountsResponse.ok) {
        const { results: accounts } = await accountsResponse.json();

        for (const account of (accounts || [])) {
          await sleep(RATE_LIMIT_DELAY_MS);

          const balanceResponse = await fetchWithRetry(
            `${TRUELAYER_API_URL}/data/v1/accounts/${account.account_id}/balance`,
            { headers: authHeaders }
          );

          let balance = 0;
          if (balanceResponse.ok) {
            const { results: balances } = await balanceResponse.json();
            balance = balances[0]?.current || 0;
          }

          const accountProvider = account.provider?.provider_id || account.provider?.display_name || connection.provider;
          const accountType = account.account_type === 'SAVINGS' ? 'savings' : 'current';
          const accountName = account.display_name || account.account_number?.number || 'Bank Account';

          // Upsert account
          const { data: existingAccount } = await serviceSupabase
            .from('bank_accounts')
            .select('id')
            .eq('external_id', account.account_id)
            .eq('provider', accountProvider)
            .eq('user_id', connection.user_id)
            .maybeSingle();

          if (existingAccount) {
            await serviceSupabase.from('bank_accounts').update({
              balance,
              name: accountName,
              provider: accountProvider,
              last_synced_at: new Date().toISOString(),
            }).eq('id', existingAccount.id);
          } else {
            await serviceSupabase.from('bank_accounts').insert({
              user_id: connection.user_id,
              name: accountName,
              account_type: accountType,
              balance,
              external_id: account.account_id,
              connection_id: connection.id,
              provider: accountProvider,
              last_synced_at: new Date().toISOString(),
            });
          }
          totalAccounts++;

          // ── Step D: Fetch transactions ──
          await sleep(RATE_LIMIT_DELAY_MS);

          // Use last_synced_at as the from date to avoid re-fetching
          const fromDate = connection.last_synced_at
            ? new Date(connection.last_synced_at).toISOString()
            : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days fallback
          const toDate = new Date().toISOString();

          const txUrl = `${TRUELAYER_API_URL}/data/v1/accounts/${account.account_id}/transactions?from=${fromDate}&to=${toDate}`;
          const txResponse = await fetchWithRetry(txUrl, { headers: authHeaders });

          if (txResponse.ok) {
            const { results: transactions } = await txResponse.json();

            const { data: bankAccount } = await serviceSupabase
              .from('bank_accounts')
              .select('id')
              .eq('external_id', account.account_id)
              .eq('user_id', connection.user_id)
              .maybeSingle();

            if (bankAccount) {
              for (const tx of (transactions || [])) {
                const txType = tx.amount < 0 ? 'expense' : 'income';
                const txDate = tx.timestamp?.split('T')[0] || new Date().toISOString().split('T')[0];

                const { data: inserted } = await serviceSupabase
                  .from('transactions')
                  .upsert({
                    user_id: connection.user_id,
                    account_id: bankAccount.id,
                    external_id: tx.transaction_id,
                    description: tx.description || 'Bank transaction',
                    amount: Math.abs(tx.amount),
                    type: txType,
                    transaction_date: txDate,
                    merchant: tx.merchant_name || null,
                  }, { onConflict: 'account_id,external_id', ignoreDuplicates: true })
                  .select('id')
                  .maybeSingle();

                if (inserted) totalTransactions++;
              }
            }
          }
        }
      }

      // ── Sync credit cards too ──
      await sleep(RATE_LIMIT_DELAY_MS);
      const cardsResponse = await fetchWithRetry(`${TRUELAYER_API_URL}/data/v1/cards`, {
        headers: authHeaders,
      });

      if (cardsResponse.ok) {
        const { results: cards } = await cardsResponse.json();

        for (const card of (cards || [])) {
          await sleep(RATE_LIMIT_DELAY_MS);

          const balanceResponse = await fetchWithRetry(
            `${TRUELAYER_API_URL}/data/v1/cards/${card.account_id}/balance`,
            { headers: authHeaders }
          );

          let balance = 0;
          if (balanceResponse.ok) {
            const { results: balances } = await balanceResponse.json();
            balance = -(balances[0]?.current || 0);
          }

          const cardProvider = card.provider?.provider_id || card.provider?.display_name || connection.provider;
          const cardName = card.display_name || card.card_network || 'Credit Card';

          const { data: existingCard } = await serviceSupabase
            .from('bank_accounts')
            .select('id')
            .eq('external_id', card.account_id)
            .eq('provider', cardProvider)
            .eq('user_id', connection.user_id)
            .maybeSingle();

          if (existingCard) {
            await serviceSupabase.from('bank_accounts').update({
              balance,
              name: cardName,
              provider: cardProvider,
              account_type: 'credit',
              last_synced_at: new Date().toISOString(),
            }).eq('id', existingCard.id);
          } else {
            await serviceSupabase.from('bank_accounts').insert({
              user_id: connection.user_id,
              name: cardName,
              account_type: 'credit',
              balance,
              external_id: card.account_id,
              connection_id: connection.id,
              provider: cardProvider,
              last_synced_at: new Date().toISOString(),
            });
          }
          totalAccounts++;

          // Card transactions
          await sleep(RATE_LIMIT_DELAY_MS);
          const fromDate = connection.last_synced_at
            ? new Date(connection.last_synced_at).toISOString()
            : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
          const toDate = new Date().toISOString();

          const txResponse = await fetchWithRetry(
            `${TRUELAYER_API_URL}/data/v1/cards/${card.account_id}/transactions?from=${fromDate}&to=${toDate}`,
            { headers: authHeaders }
          );

          if (txResponse.ok) {
            const { results: transactions } = await txResponse.json();

            const { data: bankAccount } = await serviceSupabase
              .from('bank_accounts')
              .select('id')
              .eq('external_id', card.account_id)
              .eq('user_id', connection.user_id)
              .maybeSingle();

            if (bankAccount) {
              for (const tx of (transactions || [])) {
                const txType = tx.amount > 0 ? 'expense' : 'income';
                const txDate = tx.timestamp?.split('T')[0] || new Date().toISOString().split('T')[0];

                const { data: inserted } = await serviceSupabase
                  .from('transactions')
                  .upsert({
                    user_id: connection.user_id,
                    account_id: bankAccount.id,
                    external_id: tx.transaction_id,
                    description: tx.description || 'Card transaction',
                    amount: Math.abs(tx.amount),
                    type: txType,
                    transaction_date: txDate,
                    merchant: tx.merchant_name || null,
                  }, { onConflict: 'account_id,external_id', ignoreDuplicates: true })
                  .select('id')
                  .maybeSingle();

                if (inserted) totalTransactions++;
              }
            }
          }
        }
      }

      // ── Step E: Update sync metadata ──
      await serviceSupabase.from('bank_connections').update({
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      }).eq('id', connection.id);

      await serviceSupabase.from('sync_logs').update({
        status: 'success',
        accounts_synced: totalAccounts,
        transactions_synced: totalTransactions,
        completed_at: new Date().toISOString(),
      }).eq('id', logId);

      results.push({
        connectionId: connection.id,
        userId: connection.user_id,
        status: 'success',
        accounts: totalAccounts,
        transactions: totalTransactions,
      });

      console.log(`[cron-sync] Connection ${connection.id}: ${totalAccounts} accounts, ${totalTransactions} new transactions`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[cron-sync] Connection ${connection.id} failed:`, errorMessage);

      await serviceSupabase.from('bank_connections').update({
        last_sync_error: errorMessage,
        updated_at: new Date().toISOString(),
      }).eq('id', connection.id);

      await serviceSupabase.from('sync_logs').update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      }).eq('id', logId);

      results.push({
        connectionId: connection.id,
        userId: connection.user_id,
        status: 'failed',
        accounts: 0,
        transactions: 0,
        error: errorMessage,
      });
    }

    // Rate limit between connections
    if (connections.length > 1) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  }

  const summary = {
    total: results.length,
    success: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'failed').length,
    expired: results.filter(r => r.status === 'token_expired').length,
    results,
  };

  console.log(`[cron-sync] Complete: ${summary.success}/${summary.total} succeeded`);

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
