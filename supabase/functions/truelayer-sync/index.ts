import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TRUELAYER_API_URL = 'https://api.truelayer.com';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    const { connectionId, accessToken } = await req.json();

    // Fetch accounts from TrueLayer
    const accountsResponse = await fetch(`${TRUELAYER_API_URL}/data/v1/accounts`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!accountsResponse.ok) {
      const errorData = await accountsResponse.json();
      console.error('TrueLayer accounts fetch failed:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch accounts from bank', details: errorData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { results: accounts } = await accountsResponse.json();

    // Process each account
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

      // Check if account already exists
      const { data: existingAccount } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('external_id', account.account_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingAccount) {
        // Update existing account
        const { error: updateError } = await supabase
          .from('bank_accounts')
          .update({
            balance,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', existingAccount.id);

        if (updateError) {
          console.error('Error updating account:', updateError);
        } else {
          syncedAccounts.push({ ...account, balance, action: 'updated' });
        }
      } else {
        // Create new account
        const accountType = account.account_type === 'SAVINGS' ? 'savings' : 'current';
        const { data: newAccount, error: insertError } = await supabase
          .from('bank_accounts')
          .insert({
            user_id: userId,
            name: account.display_name || account.account_number?.number || 'Bank Account',
            account_type: accountType,
            balance,
            external_id: account.account_id,
            connection_id: connectionId,
            last_synced_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating account:', insertError);
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

    return new Response(
      JSON.stringify({
        success: true,
        accounts: syncedAccounts.length,
        transactions: totalTransactions,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
