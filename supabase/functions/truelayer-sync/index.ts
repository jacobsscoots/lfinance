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

// Transfer detection: match transactions across accounts by amount/date
interface SyncedTransaction {
  account_id: string;
  external_id: string;
  amount: number;
  type: string;
  transaction_date: string;
  description: string;
  merchant: string | null;
  db_id?: string;
}

function detectTransfers(transactions: SyncedTransaction[]): Set<string> {
  const transferExternalIds = new Set<string>();

  // Group by date
  const byDate = new Map<string, SyncedTransaction[]>();
  for (const tx of transactions) {
    const group = byDate.get(tx.transaction_date) || [];
    group.push(tx);
    byDate.set(tx.transaction_date, group);
  }

  for (const [, dayTxs] of byDate) {
    // For each expense, look for a matching income on a different account with same amount
    const expenses = dayTxs.filter(t => t.type === 'expense');
    const incomes = dayTxs.filter(t => t.type === 'income');

    for (const exp of expenses) {
      for (const inc of incomes) {
        if (
          exp.account_id !== inc.account_id &&
          Math.abs(exp.amount - inc.amount) < 0.01
        ) {
          transferExternalIds.add(exp.external_id);
          transferExternalIds.add(inc.external_id);
        }
      }
    }
  }

  return transferExternalIds;
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

    // Get connection details server-side using encrypted token retrieval
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: connectionRows, error: connError } = await serviceSupabase
      .rpc('get_bank_connection_tokens', { p_connection_id: connectionId });

    const connection = connectionRows?.[0];

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

      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

      const tokenExpiresAt = expiresAt.toISOString();
      await serviceSupabase.rpc('store_bank_connection_tokens', {
        p_connection_id: connectionId,
        p_access_token: tokenData.access_token,
        p_refresh_token: tokenData.refresh_token,
        p_token_expires_at: tokenExpiresAt,
      });

      accessToken = tokenData.access_token;
      console.log('[sync] Token refreshed successfully');
    }

    const syncedAccounts: Array<{ account_id: string; balance: number; action: string; type: string }> = [];
    const allNewTransactions: SyncedTransaction[] = [];

    // ── 1. Sync CURRENT / SAVINGS accounts (/data/v1/accounts) ──
    const accountsResponse = await fetch(`${TRUELAYER_API_URL}/data/v1/accounts`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (accountsResponse.ok) {
      const { results: accounts } = await accountsResponse.json();
      console.log(`[sync] Found ${accounts?.length || 0} bank accounts`);

      for (const account of (accounts || [])) {
        const balanceResponse = await fetch(
          `${TRUELAYER_API_URL}/data/v1/accounts/${account.account_id}/balance`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        let balance = 0;
        if (balanceResponse.ok) {
          const { results: balances } = await balanceResponse.json();
          balance = balances[0]?.current || 0;
        }

        const accountProvider = account.provider?.provider_id || 
                                account.provider?.display_name || 
                                connectionProvider;
        const accountType = account.account_type === 'SAVINGS' ? 'savings' : 'current';
        const accountName = account.display_name || account.account_number?.number || 'Bank Account';

        const { data: existingAccount } = await supabase
          .from('bank_accounts')
          .select('id, display_name, provider')
          .eq('external_id', account.account_id)
          .eq('provider', accountProvider)
          .eq('user_id', userId)
          .maybeSingle();

        if (existingAccount) {
          await supabase
            .from('bank_accounts')
            .update({
              balance,
              name: accountName,
              provider: accountProvider,
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', existingAccount.id);
          syncedAccounts.push({ account_id: account.account_id, balance, action: 'updated', type: 'account' });
        } else {
          await supabase
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
          syncedAccounts.push({ account_id: account.account_id, balance, action: 'created', type: 'account' });
        }

        // Fetch settled + pending transactions for this account
        const [txResponse, pendingTxResponse] = await Promise.all([
          fetch(`${TRUELAYER_API_URL}/data/v1/accounts/${account.account_id}/transactions`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }),
          fetch(`${TRUELAYER_API_URL}/data/v1/accounts/${account.account_id}/transactions/pending`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }).catch(() => null),
        ]);

        if (txResponse.ok) {
          const { results: transactions } = await txResponse.json();
          console.log(`[sync] Account ${account.account_id}: ${transactions?.length || 0} transactions from TrueLayer`);
          const { data: bankAccount } = await supabase
            .from('bank_accounts')
            .select('id')
            .eq('external_id', account.account_id)
            .eq('user_id', userId)
            .maybeSingle();

          if (bankAccount) {
            let insertedCount = 0;
            let skippedCount = 0;
            for (const tx of (transactions || [])) {
              const txType = tx.amount < 0 ? 'expense' : 'income';
              const txDate = tx.timestamp?.split('T')[0] || new Date().toISOString().split('T')[0];
              const { data: newTx, error: insertErr } = await supabase
                .from('transactions')
                .upsert({
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

              if (insertErr) {
                console.error(`[sync] Failed to upsert tx ${tx.transaction_id}:`, insertErr.message);
                skippedCount++;
              } else if (newTx) {
                insertedCount++;
              } else {
                skippedCount++;
              }

              allNewTransactions.push({
                account_id: bankAccount.id,
                external_id: tx.transaction_id,
                amount: Math.abs(tx.amount),
                type: txType,
                transaction_date: txDate,
                description: tx.description || '',
                merchant: tx.merchant_name || null,
                db_id: newTx?.id,
              });
            }
            console.log(`[sync] Account ${account.account_id}: ${insertedCount} inserted, ${skippedCount} skipped (already exist)`);

            // Process pending transactions
            if (pendingTxResponse?.ok) {
              const { results: pendingTxs } = await pendingTxResponse.json();
              console.log(`[sync] Account ${account.account_id}: ${pendingTxs?.length || 0} pending transactions`);
              let pendingInserted = 0;
              for (const tx of (pendingTxs || [])) {
                const pendingExtId = `pending_${tx.transaction_id}`;
                const txType = tx.amount < 0 ? 'expense' : 'income';
                const txDate = tx.timestamp?.split('T')[0] || new Date().toISOString().split('T')[0];
                const { data: inserted } = await supabase
                  .from('transactions')
                  .upsert({
                    account_id: bankAccount.id,
                    external_id: pendingExtId,
                    description: tx.description || 'Pending transaction',
                    amount: Math.abs(tx.amount),
                    type: txType,
                    transaction_date: txDate,
                    merchant: tx.merchant_name || null,
                    is_pending: true,
                  }, { onConflict: 'account_id,external_id', ignoreDuplicates: true })
                  .select('id')
                  .maybeSingle();
                if (inserted) pendingInserted++;
              }
              if (pendingInserted > 0) {
                console.log(`[sync] Account ${account.account_id}: ${pendingInserted} pending inserted`);
              }
            }
          }
        } else {
          console.error(`[sync] Failed to fetch transactions for account ${account.account_id}: ${txResponse.status}`);
        }
      }
    } else {
      console.log('[sync] No bank accounts or accounts fetch failed');
    }

    // ── 2. Sync CREDIT CARDS (/data/v1/cards) ──
    const cardsResponse = await fetch(`${TRUELAYER_API_URL}/data/v1/cards`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (cardsResponse.ok) {
      const { results: cards } = await cardsResponse.json();
      console.log(`[sync] Found ${cards?.length || 0} credit cards`);

      for (const card of (cards || [])) {
        const balanceResponse = await fetch(
          `${TRUELAYER_API_URL}/data/v1/cards/${card.account_id}/balance`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        let balance = 0;
        if (balanceResponse.ok) {
          const { results: balances } = await balanceResponse.json();
          // For credit cards, current = amount owed (show as negative)
          balance = -(balances[0]?.current || 0);
        }

        const cardProvider = card.provider?.provider_id || 
                             card.provider?.display_name || 
                             connectionProvider;
        const cardName = card.display_name || card.card_network || 'Credit Card';

        const { data: existingCard } = await supabase
          .from('bank_accounts')
          .select('id, display_name, provider')
          .eq('external_id', card.account_id)
          .eq('provider', cardProvider)
          .eq('user_id', userId)
          .maybeSingle();

        if (existingCard) {
          await supabase
            .from('bank_accounts')
            .update({
              balance,
              name: cardName,
              provider: cardProvider,
              account_type: 'credit',
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', existingCard.id);
          syncedAccounts.push({ account_id: card.account_id, balance, action: 'updated', type: 'card' });
        } else {
          await supabase
            .from('bank_accounts')
            .insert({
              user_id: userId,
              name: cardName,
              account_type: 'credit',
              balance,
              external_id: card.account_id,
              connection_id: connectionId,
              provider: cardProvider,
              last_synced_at: new Date().toISOString(),
            });
          syncedAccounts.push({ account_id: card.account_id, balance, action: 'created', type: 'card' });
        }

        // Fetch card transactions
        const txResponse = await fetch(
          `${TRUELAYER_API_URL}/data/v1/cards/${card.account_id}/transactions`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );

        if (txResponse.ok) {
          const { results: transactions } = await txResponse.json();
          console.log(`[sync] Card ${card.account_id}: ${transactions?.length || 0} transactions from TrueLayer`);
          const { data: bankAccount } = await supabase
            .from('bank_accounts')
            .select('id')
            .eq('external_id', card.account_id)
            .eq('user_id', userId)
            .maybeSingle();

          if (bankAccount) {
            let insertedCount = 0;
            let skippedCount = 0;
            for (const tx of (transactions || [])) {
              // Credit card: positive amount = purchase (expense), negative = payment/refund (income)
              const txType = tx.amount > 0 ? 'expense' : 'income';
              const txDate = tx.timestamp?.split('T')[0] || new Date().toISOString().split('T')[0];
              const { data: newTx, error: insertErr } = await supabase
                .from('transactions')
                .upsert({
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

              if (insertErr) {
                console.error(`[sync] Failed to upsert card tx ${tx.transaction_id}:`, insertErr.message);
                skippedCount++;
              } else if (newTx) {
                insertedCount++;
              } else {
                skippedCount++;
              }

              allNewTransactions.push({
                account_id: bankAccount.id,
                external_id: tx.transaction_id,
                amount: Math.abs(tx.amount),
                type: txType,
                transaction_date: txDate,
                description: tx.description || '',
                merchant: tx.merchant_name || null,
                db_id: newTx?.id,
              });
            }
            console.log(`[sync] Card ${card.account_id}: ${insertedCount} inserted, ${skippedCount} skipped`);
          }
        }
      }
    } else {
      console.log('[sync] No credit cards or cards fetch failed');
    }

    // ── 3. Detect inter-account transfers ──
    if (allNewTransactions.length > 0) {
      const transferIds = detectTransfers(allNewTransactions);
      if (transferIds.size > 0) {
        console.log(`[sync] Detected ${transferIds.size / 2} transfer pair(s)`);
        // Tag transfer transactions with a "Transfer" description suffix
        for (const tx of allNewTransactions) {
          if (transferIds.has(tx.external_id) && tx.db_id) {
            const transferLabel = tx.type === 'expense' ? 'Transfer Out' : 'Transfer In';
            // Update the description to indicate it's a transfer
            await supabase
              .from('transactions')
              .update({ 
                description: tx.description ? `${tx.description} [${transferLabel}]` : transferLabel,
                // Don't change type — keep as income/expense so balances stay correct
              })
              .eq('id', tx.db_id);
          }
        }
      }
    }

    // Detect the real bank provider from synced accounts
    const detectedProvider = syncedAccounts.length > 0
      ? syncedAccounts[0].type === 'card'
        ? (syncedAccounts.find(a => a.type === 'account')?.account_id ? connectionProvider : connectionProvider)
        : connectionProvider
      : connectionProvider;

    // For provider detection, re-check from TrueLayer response
    let finalProvider = connectionProvider;
    if (accountsResponse.ok) {
      const { results: accounts } = await accountsResponse.json().catch(() => ({ results: [] }));
      // Already consumed, use syncedAccounts data instead
    }
    // Use the provider we already detected during account sync
    const providerFromAccounts = syncedAccounts.length > 0 ? connectionProvider : connectionProvider;

    // Update connection status
    await serviceSupabase
      .from('bank_connections')
      .update({
        status: 'connected',
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', connectionId);

    const totalTransactions = allNewTransactions.length;
    console.log(`[sync] Completed: ${syncedAccounts.length} accounts/cards, ${totalTransactions} new transactions`);

    return jsonResponse({
      success: true,
      accounts: syncedAccounts.filter(a => a.type === 'account').length,
      cards: syncedAccounts.filter(a => a.type === 'card').length,
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
