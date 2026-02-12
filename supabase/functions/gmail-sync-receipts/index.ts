import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const syncInputSchema = z.object({
  action: z.enum(["sync"]),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Receipt-related search keywords
const RECEIPT_KEYWORDS = [
  'receipt',
  'order confirmation',
  'invoice',
  'thank you for your order',
  'payment received',
  'purchase confirmation',
  'your order',
];

// Common receipt senders
const RECEIPT_SENDERS = [
  'amazon',
  'tesco',
  'sainsburys',
  'asda',
  'waitrose',
  'ocado',
  'morrisons',
  'paypal',
  'ebay',
  'deliveroo',
  'uber',
  'justeat',
  'netflix',
  'spotify',
  'apple',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    const parseResult = syncInputSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input. Expected { action: 'sync' }" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { action } = parseResult.data;

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the JWT and get user
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    if (action === 'sync') {
      // Get user's Gmail connection
      const { data: connection, error: connError } = await supabase
        .from('gmail_connections')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (connError || !connection) {
        throw new Error('No Gmail connection found');
      }

      // Check if token is expired and refresh if needed
      if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
        // Call refresh token endpoint
        const refreshResponse = await fetch(`${SUPABASE_URL}/functions/v1/gmail-oauth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({ action: 'refresh_token' }),
        });

        if (!refreshResponse.ok) {
          throw new Error('Failed to refresh Gmail token');
        }

        // Get updated connection
        const { data: updatedConnection } = await supabase
          .from('gmail_connections')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (updatedConnection) {
          connection.access_token = updatedConnection.access_token;
        }
      }

      // Get sync settings
      const { data: settings } = await supabase
        .from('gmail_sync_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const scanDays = settings?.scan_days || 30;
      const afterDate = new Date();
      afterDate.setDate(afterDate.getDate() - scanDays);

      // Build Gmail search query
      const searchParts = [
        `after:${afterDate.toISOString().split('T')[0].replace(/-/g, '/')}`,
        `(${RECEIPT_KEYWORDS.map(k => `subject:${k}`).join(' OR ')})`,
      ];

      if (settings?.allowed_domains?.length > 0) {
        searchParts.push(`(${settings.allowed_domains.map((d: string) => `from:${d}`).join(' OR ')})`);
      }

      const searchQuery = searchParts.join(' ');

      // Search Gmail for messages
      const searchResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=50`,
        {
          headers: { Authorization: `Bearer ${connection.access_token}` },
        }
      );

      if (!searchResponse.ok) {
        const error = await searchResponse.text();
        console.error('Gmail search error:', error);
        throw new Error('Failed to search Gmail');
      }

      const searchResult = await searchResponse.json();
      const messages = searchResult.messages || [];

      let receiptsFound = 0;
      let receiptsMatched = 0;

      // Process each message
      for (const msg of messages.slice(0, 20)) { // Limit to 20 for performance
        // Check if we already processed this message
        const { data: existing } = await supabase
          .from('gmail_receipts')
          .select('id')
          .eq('user_id', user.id)
          .eq('message_id', msg.id)
          .single();

        if (existing) continue;

        // Get message details
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          {
            headers: { Authorization: `Bearer ${connection.access_token}` },
          }
        );

        if (!msgResponse.ok) continue;

        const msgData = await msgResponse.json();
        const headers = msgData.payload?.headers || [];

        const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
        const from = headers.find((h: any) => h.name === 'From')?.value || '';
        const date = headers.find((h: any) => h.name === 'Date')?.value;

        // Extract merchant name from sender
        let merchantName = null;
        const fromLower = from.toLowerCase();
        for (const sender of RECEIPT_SENDERS) {
          if (fromLower.includes(sender)) {
            merchantName = sender.charAt(0).toUpperCase() + sender.slice(1);
            break;
          }
        }

        // Try to extract amount from subject or snippet
        let amount = null;
        const amountPatterns = [
          /£\s*([\d,]+\.?\d*)/,
          /GBP\s*([\d,]+\.?\d*)/i,
          /\$\s*([\d,]+\.?\d*)/,
        ];

        const textToSearch = `${subject} ${msgData.snippet || ''}`;
        for (const pattern of amountPatterns) {
          const match = textToSearch.match(pattern);
          if (match) {
            amount = parseFloat(match[1].replace(',', ''));
            break;
          }
        }

        // Extract order reference
        let orderReference = null;
        const orderPatterns = [
          /order\s*#?\s*(\w+[-\w]*)/i,
          /reference\s*:?\s*(\w+[-\w]*)/i,
          /invoice\s*#?\s*(\w+[-\w]*)/i,
        ];

        for (const pattern of orderPatterns) {
          const match = textToSearch.match(pattern);
          if (match) {
            orderReference = match[1];
            break;
          }
        }

        // Check for attachments
        let attachmentPath = null;
        let attachmentType = null;
        const parts = msgData.payload?.parts || [];
        for (const part of parts) {
          if (part.filename && (part.filename.endsWith('.pdf') || part.mimeType?.startsWith('image/'))) {
            attachmentType = part.filename.endsWith('.pdf') ? 'pdf' : 'image';
            // Note: Actual attachment download would require additional API calls
            // and storage bucket upload - simplified for now
            break;
          }
        }

        // Insert receipt record
        const { error: insertError } = await supabase
          .from('gmail_receipts')
          .insert({
            user_id: user.id,
            gmail_connection_id: connection.id,
            message_id: msg.id,
            subject,
            from_email: from,
            received_at: date ? new Date(date).toISOString() : null,
            merchant_name: merchantName,
            amount,
            order_reference: orderReference,
            attachment_path: attachmentPath,
            attachment_type: attachmentType,
            match_status: 'pending',
          });

        if (!insertError) {
          receiptsFound++;
        }
      }

      // Run matching algorithm
      const { data: pendingReceipts } = await supabase
        .from('gmail_receipts')
        .select('*')
        .eq('user_id', user.id)
        .eq('match_status', 'pending');

      if (pendingReceipts && pendingReceipts.length > 0) {
        // Get user's transactions from last 90 days
        const { data: transactions } = await supabase
          .from('transactions')
          .select('*, bank_accounts!inner(*)')
          .eq('bank_accounts.user_id', user.id)
          .gte('transaction_date', afterDate.toISOString().split('T')[0]);

        if (transactions) {
          for (const receipt of pendingReceipts) {
            // Find best matching transaction
            let bestMatch = null;
            let bestScore = 0;

            for (const tx of transactions) {
              if (tx.type === 'income') continue;
              if (tx.receipt_path) continue; // Already has a receipt

              let score = 0;
              const reasons: string[] = [];

              // Amount matching
              if (receipt.amount !== null) {
                const diff = Math.abs(receipt.amount - tx.amount);
                if (diff < 0.01) {
                  score += 40;
                  reasons.push('Exact amount match');
                } else if (diff <= 0.50) {
                  score += 25;
                  reasons.push('Amount within £0.50');
                }
              }

              // Date matching
              if (receipt.received_at) {
                const receiptDate = new Date(receipt.received_at);
                const txDate = new Date(tx.transaction_date);
                const daysDiff = Math.abs(Math.floor((receiptDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)));

                if (daysDiff === 0) {
                  score += 30;
                  reasons.push('Same day');
                } else if (daysDiff <= 3) {
                  score += 15;
                  reasons.push('Within 3 days');
                }
              }

              // Merchant matching
              if (receipt.merchant_name && tx.merchant) {
                if (tx.merchant.toLowerCase().includes(receipt.merchant_name.toLowerCase())) {
                  score += 30;
                  reasons.push('Merchant match');
                }
              }

              if (score > bestScore) {
                bestScore = score;
                bestMatch = { transaction: tx, reasons };
              }
            }

            // Determine match status
            let matchStatus = 'no_match';
            let matchConfidence = null;

            if (bestMatch && bestScore >= 80) {
              matchStatus = 'matched';
              matchConfidence = 'high';
            } else if (bestMatch && bestScore >= 50) {
              matchStatus = 'review';
              matchConfidence = 'medium';
            }

            // Update receipt with match info
            if (matchStatus !== 'pending') {
              await supabase
                .from('gmail_receipts')
                .update({
                  match_status: matchStatus,
                  match_confidence: matchConfidence,
                  matched_transaction_id: matchStatus === 'matched' ? bestMatch?.transaction.id : null,
                  matched_at: matchStatus === 'matched' ? new Date().toISOString() : null,
                })
                .eq('id', receipt.id);

              if (matchStatus === 'matched') {
                receiptsMatched++;

                // Log the match
                await supabase
                  .from('gmail_match_log')
                  .insert({
                    user_id: user.id,
                    receipt_id: receipt.id,
                    transaction_id: bestMatch?.transaction.id,
                    action: 'auto_matched',
                    match_reasons: bestMatch?.reasons,
                  });
              }
            }
          }
        }
      }

      // Update last synced timestamp
      await supabase
        .from('gmail_connections')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', connection.id);

      return new Response(
        JSON.stringify({
          success: true,
          receiptsFound,
          receiptsMatched,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Gmail sync error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
