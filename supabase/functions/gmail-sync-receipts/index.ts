import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const syncInputSchema = z.object({
  action: z.enum(["sync"]),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Receipt-related search keywords — broadened to catch all transactional emails
const RECEIPT_KEYWORDS = [
  'receipt',
  'order confirmation',
  'invoice',
  'thank you for your order',
  'payment received',
  'purchase confirmation',
  'your order',
  'payment confirmation',
  'billing statement',
  'payment successful',
  'transaction',
  'subscription',
  'renewal',
  'charge',
  'your payment',
  'your purchase',
  'dispatched',
  'shipped',
  'delivery confirmation',
  'billing',
  'amount due',
  'paid',
  'statement',
];

/**
 * Extract merchant name from email From header.
 * Uses the display name first (e.g. "Myprotein <service@t.myprotein.com>")
 * then falls back to domain parsing.
 */
function extractMerchant(from: string): string | null {
  if (!from) return null;

  // Try display name first: "Myprotein <service@...>"
  const displayMatch = from.match(/^([^<]+)</);
  if (displayMatch) {
    const name = displayMatch[1].trim();
    // Filter out generic names like "no-reply", "noreply", "info"
    if (name && !/^(no-?reply|info|service|support|orders?|notifications?)$/i.test(name)) {
      return name;
    }
  }

  // Fall back to domain extraction: service@t.myprotein.com → myprotein
  const domainMatch = from.match(/@(?:[^.]+\.)*([^.]+)\.[a-z]{2,}>/i) 
    || from.match(/@(?:[^.]+\.)*([^.]+)\.[a-z]{2,}$/i);
  if (domainMatch) {
    const domain = domainMatch[1];
    // Skip generic domains
    if (domain && !['gmail', 'yahoo', 'outlook', 'hotmail', 'googlemail'].includes(domain.toLowerCase())) {
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    }
  }

  return null;
}

/**
 * Extract amounts from email text (subject + snippet + body snippet).
 * Returns the most likely order total.
 */
function extractAmount(text: string): number | null {
  const patterns = [
    /(?:total|order total|amount|charged|paid)[:\s]*£\s*([\d,]+\.?\d*)/i,
    /£\s*([\d,]+\.?\d*)\s*(?:total|paid|charged)/i,
    /(?:total|order total|amount)[:\s]*(?:GBP)?\s*([\d,]+\.?\d*)/i,
    /£\s*([\d,]+\.?\d*)/g, // fallback: any £ amount
  ];

  // Try specific patterns first
  for (let i = 0; i < patterns.length - 1; i++) {
    const match = text.match(patterns[i]);
    if (match) {
      const amount = parseFloat(match[1].replace(',', ''));
      if (!isNaN(amount) && amount > 0 && amount < 10000) return amount;
    }
  }

  // Fallback: collect all £ amounts, take the largest (likely the total)
  const allAmounts: number[] = [];
  const globalPattern = /£\s*([\d,]+\.?\d*)/g;
  let m;
  while ((m = globalPattern.exec(text)) !== null) {
    const val = parseFloat(m[1].replace(',', ''));
    if (!isNaN(val) && val > 0 && val < 10000) allAmounts.push(val);
  }
  if (allAmounts.length > 0) {
    return Math.max(...allAmounts);
  }

  return null;
}

/**
 * Decode email body from base64url parts
 */
function decodeBody(payload: any): string {
  const parts: string[] = [];

  function walk(node: any) {
    if (node.body?.data) {
      try {
        // base64url → base64 → decode
        const b64 = node.body.data.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = atob(b64);
        parts.push(decoded);
      } catch { /* ignore decode errors */ }
    }
    if (node.parts) {
      for (const p of node.parts) walk(p);
    }
  }

  walk(payload);
  return parts.join(' ');
}

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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) throw new Error('Unauthorized');

    // Get user's Gmail connection
    const { data: connection, error: connError } = await supabase
      .from('gmail_connections')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (connError || !connection) throw new Error('No Gmail connection found');

    // Refresh token if expired
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      const refreshResponse = await fetch(`${SUPABASE_URL}/functions/v1/gmail-oauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({ action: 'refresh_token' }),
      });
      if (!refreshResponse.ok) throw new Error('Failed to refresh Gmail token');

      const { data: updatedConnection } = await supabase
        .from('gmail_connections')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (updatedConnection) connection.access_token = updatedConnection.access_token;
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

    // Build Gmail search query — search subject OR body for receipt indicators
    // Using broader matching: subject keywords + category:purchases (Gmail's built-in label)
    const subjectPart = RECEIPT_KEYWORDS.map(k => `subject:"${k}"`).join(' OR ');
    const searchParts = [
      `after:${afterDate.toISOString().split('T')[0].replace(/-/g, '/')}`,
      `(${subjectPart} OR category:purchases OR category:updates OR label:receipts)`,
    ];
    if (settings?.allowed_domains?.length > 0) {
      searchParts.push(`(${settings.allowed_domains.map((d: string) => `from:${d}`).join(' OR ')})`);
    }
    const searchQuery = searchParts.join(' ');
    console.log('[gmail] Search query:', searchQuery);

    // Search Gmail — fetch up to 100 messages
    const searchResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=100`,
      { headers: { Authorization: `Bearer ${connection.access_token}` } }
    );
    if (!searchResponse.ok) {
      console.error('Gmail search error:', await searchResponse.text());
      throw new Error('Failed to search Gmail');
    }

    const searchResult = await searchResponse.json();
    const messages = searchResult.messages || [];
    console.log(`[gmail] Found ${messages.length} candidate messages`);

    let receiptsFound = 0;
    let receiptsMatched = 0;

    // Process each message (up to 50 per sync)
    for (const msg of messages.slice(0, 50)) {
      const { data: existing } = await supabase
        .from('gmail_receipts')
        .select('id')
        .eq('user_id', user.id)
        .eq('message_id', msg.id)
        .single();
      if (existing) continue;

      const msgResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${connection.access_token}` } }
      );
      if (!msgResponse.ok) continue;

      const msgData = await msgResponse.json();
      const headers = msgData.payload?.headers || [];

      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const date = headers.find((h: any) => h.name === 'Date')?.value;

      // Smart merchant extraction from From header
      const merchantName = extractMerchant(from);

      // Extract amount from subject + snippet + body
      const bodyText = decodeBody(msgData.payload);
      const textToSearch = `${subject} ${msgData.snippet || ''} ${bodyText.slice(0, 2000)}`;
      const amount = extractAmount(textToSearch);

      // Extract order reference
      let orderReference = null;
      const orderPatterns = [
        /order\s*(?:number|#|no\.?|ref(?:erence)?)?\s*:?\s*([A-Z0-9][-A-Z0-9]{3,})/i,
        /reference\s*:?\s*([A-Z0-9][-A-Z0-9]{3,})/i,
        /invoice\s*#?\s*([A-Z0-9][-A-Z0-9]{3,})/i,
      ];
      for (const pattern of orderPatterns) {
        const match = textToSearch.match(pattern);
        if (match) { orderReference = match[1]; break; }
      }

      // Check for attachments
      let attachmentType = null;
      const parts = msgData.payload?.parts || [];
      for (const part of parts) {
        if (part.filename && (part.filename.endsWith('.pdf') || part.mimeType?.startsWith('image/'))) {
          attachmentType = part.filename.endsWith('.pdf') ? 'pdf' : 'image';
          break;
        }
      }

      console.log(`Receipt: merchant=${merchantName}, amount=${amount}, subject="${subject.slice(0, 50)}"`);

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
          attachment_path: null,
          attachment_type: attachmentType,
          match_status: 'pending',
        });

      if (!insertError) receiptsFound++;
    }

    // --- Auto-matching ---
    // Include receipts that are 'pending' OR 'matched' but missing a matched_transaction_id (stale matches)
    console.log(`[match] Looking for pending/unlinked receipts for user ${user.id}`);
    const { data: pendingReceipts, error: pendingError } = await supabase
      .from('gmail_receipts')
      .select('*')
      .eq('user_id', user.id)
      .or('match_status.eq.pending,and(match_status.eq.matched,matched_transaction_id.is.null)');

    console.log(`[match] Found ${pendingReceipts?.length ?? 0} pending receipts, error: ${pendingError?.message ?? 'none'}`);
    if (pendingReceipts && pendingReceipts.length > 0) {
      // Use earliest pending receipt date (minus 7 day buffer) for transaction lookup
      const earliestReceipt = pendingReceipts.reduce((earliest, r) => {
        if (!r.received_at) return earliest;
        const d = new Date(r.received_at);
        return d < earliest ? d : earliest;
      }, afterDate);
      const txLookbackDate = new Date(earliestReceipt);
      txLookbackDate.setDate(txLookbackDate.getDate() - 7);

      // Transactions don't have user_id — they belong to bank_accounts
      // First get the user's account IDs
      const { data: userAccounts } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      const accountIds = (userAccounts || []).map(a => a.id);
      console.log(`[match] User has ${accountIds.length} accounts`);

      const { data: transactions } = accountIds.length > 0
        ? await supabase
            .from('transactions')
            .select('*')
            .in('account_id', accountIds)
            .eq('type', 'expense')
            .gte('transaction_date', txLookbackDate.toISOString().split('T')[0])
        : { data: [] as any[] };

      console.log(`[match] Found ${transactions?.length ?? 0} candidate transactions from ${txLookbackDate.toISOString().split('T')[0]}`);
      if (transactions && transactions.length > 0) {
        // Get already-matched transaction IDs to avoid double-matching
        const { data: alreadyMatched } = await supabase
          .from('gmail_receipts')
          .select('matched_transaction_id')
          .eq('user_id', user.id)
          .eq('match_status', 'matched')
          .not('matched_transaction_id', 'is', null);
        
        const matchedTxIds = new Set((alreadyMatched || []).map(r => r.matched_transaction_id));

        for (const receipt of pendingReceipts) {
          let bestMatch: { transaction: any; score: number; reasons: string[] } | null = null;

          for (const tx of transactions) {
            if (matchedTxIds.has(tx.id)) continue;

            let score = 0;
            const reasons: string[] = [];

            // Amount matching
            if (receipt.amount !== null) {
              const diff = Math.abs(receipt.amount - tx.amount);
              if (diff < 0.01) { score += 40; reasons.push('Exact amount'); }
              else if (diff <= 0.50) { score += 25; reasons.push('Amount ±£0.50'); }
              else if (diff <= 2.00) { score += 10; reasons.push('Amount ±£2'); }
            }

            // Date matching
            if (receipt.received_at) {
              const rDate = new Date(receipt.received_at);
              const tDate = new Date(tx.transaction_date);
              const daysDiff = Math.abs(Math.floor((rDate.getTime() - tDate.getTime()) / 86400000));
              if (daysDiff === 0) { score += 30; reasons.push('Same day'); }
              else if (daysDiff <= 1) { score += 25; reasons.push('±1 day'); }
              else if (daysDiff <= 3) { score += 15; reasons.push('±3 days'); }
              else if (daysDiff <= 7) { score += 5; reasons.push('±7 days'); }
            }

            // Merchant matching — check against description (primary) AND from_email domain
            const merchantLower = (receipt.merchant_name || '').toLowerCase();
            const descLower = (tx.description || '').toLowerCase();
            const txMerchantLower = (tx.merchant || '').toLowerCase();

            // Normalise for comparison: strip whitespace, lowercase
            const normMerchant = merchantLower.replace(/\s+/g, '');
            const normDesc = descLower.replace(/\s+/g, '');
            const normTxMerchant = txMerchantLower.replace(/\s+/g, '');

            if (normMerchant) {
              // Check description
              if (normDesc && (normDesc.includes(normMerchant) || normMerchant.includes(normDesc))) {
                score += 30; reasons.push('Merchant in description');
              }
              // Check tx.merchant field too
              else if (normTxMerchant && (normTxMerchant.includes(normMerchant) || normMerchant.includes(normTxMerchant))) {
                score += 30; reasons.push('Merchant field match');
              }
              else if (descLower) {
                // Word overlap (handles "MyProtein Manchester" matching "Myprotein")
                const mWords = merchantLower.split(/\s+/);
                const dWords = descLower.split(/\s+/);
                const overlap = mWords.filter(w => w.length >= 3 && dWords.some(d => d.includes(w) || w.includes(d)));
                if (overlap.length > 0) { score += 20; reasons.push('Partial merchant match'); }
              }
            }

            // Email domain vs description
            if (receipt.from_email && (descLower || txMerchantLower)) {
              const domainMatch = receipt.from_email.match(/@(?:[^.]+\.)*([^.]+)\.[a-z]{2,}/i);
              if (domainMatch) {
                const domain = domainMatch[1].toLowerCase();
                if ((descLower && descLower.includes(domain)) || (txMerchantLower && txMerchantLower.includes(domain))) {
                  score += 15; reasons.push('Email domain match');
                }
              }
            }

            // Boost: if merchant matches strongly but no amount on receipt, still allow match
            // (handles emails where amount extraction failed)
            if (receipt.amount === null && score >= 40) {
              score += 10; reasons.push('No-amount merchant+date boost');
            }

            if (!bestMatch || score > bestMatch.score) {
              bestMatch = { transaction: tx, score, reasons };
            }
          }

          console.log(`[match] Receipt ${receipt.id} (${receipt.merchant_name}): best score=${bestMatch?.score ?? 0}, reasons=${bestMatch?.reasons?.join(',')}`, bestMatch ? `tx=${bestMatch.transaction.description} £${bestMatch.transaction.amount}` : '');
          // Determine match status
          let matchStatus = 'no_match';
          let matchConfidence = null;
          if (bestMatch && bestMatch.score >= 50) {
            matchStatus = 'matched';
            matchConfidence = bestMatch.score >= 80 ? 'high' : bestMatch.score >= 60 ? 'medium' : 'low';
          } else if (bestMatch && bestMatch.score >= 35) {
            matchStatus = 'review';
            matchConfidence = 'low';
          }

          await supabase
            .from('gmail_receipts')
            .update({
              match_status: matchStatus,
              match_confidence: matchConfidence,
              matched_transaction_id: matchStatus === 'matched' ? bestMatch?.transaction.id : null,
              matched_at: matchStatus === 'matched' ? new Date().toISOString() : null,
            })
            .eq('id', receipt.id);

          if (matchStatus === 'matched' && bestMatch) {
            receiptsMatched++;
            matchedTxIds.add(bestMatch.transaction.id);

            await supabase
              .from('gmail_match_log')
              .insert({
                user_id: user.id,
                receipt_id: receipt.id,
                transaction_id: bestMatch.transaction.id,
                action: 'auto_matched',
                match_reasons: bestMatch.reasons,
              });
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
      JSON.stringify({ success: true, receiptsFound, receiptsMatched }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Gmail sync error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
