import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

interface DealSource {
  id: string;
  user_id: string;
  name: string;
  type: 'rss' | 'api' | 'html' | 'manual';
  base_url: string;
  scan_url: string;
  enabled: boolean;
  scan_frequency_minutes: number;
  last_scan_at: string | null;
  etag: string | null;
  last_modified: string | null;
  rate_limit_ms: number;
  max_pages: number;
  config: Record<string, unknown>;
}

interface NormalizedDeal {
  source_id: string;
  source_name: string;
  title: string;
  price: number;
  old_price: number | null;
  discount_percent: number | null;
  currency: string;
  url: string;
  image_url: string | null;
  store: string | null;
  category: string | null;
  description_snippet: string | null;
  hash: string;
}

interface DealRule {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  keywords_include: string[];
  keywords_exclude: string[];
  category: string | null;
  min_price: number | null;
  max_price: number | null;
  min_discount_percent: number | null;
  store_whitelist: string[];
  store_blacklist: string[];
  notify_email: boolean;
  notify_in_app: boolean;
  alert_cooldown_minutes: number;
  last_notified_at: string | null;
}

// Simple hash function for deduplication
async function hashDeal(title: string, price: number, store: string | null, url: string): Promise<string> {
  const normalized = `${title.toLowerCase().trim()}|${price}|${(store || '').toLowerCase()}|${url}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Parse RSS/Atom feed
async function parseRSSFeed(url: string, etag: string | null, lastModified: string | null): Promise<{
  items: Array<{ title: string; link: string; description?: string; pubDate?: string }>;
  newEtag: string | null;
  newLastModified: string | null;
}> {
  const headers: Record<string, string> = {};
  if (etag) headers['If-None-Match'] = etag;
  if (lastModified) headers['If-Modified-Since'] = lastModified;

  const response = await fetch(url, { headers });
  
  if (response.status === 304) {
    return { items: [], newEtag: etag, newLastModified: lastModified };
  }

  const text = await response.text();
  const newEtag = response.headers.get('ETag');
  const newLastModified = response.headers.get('Last-Modified');

  // Simple RSS/Atom parsing
  const items: Array<{ title: string; link: string; description?: string; pubDate?: string }> = [];
  
  // Try RSS format first
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(text)) !== null) {
    const itemXml = match[1];
    const title = itemXml.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)?.[1] || '';
    const link = itemXml.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i)?.[1] || 
                 itemXml.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] || '';
    const description = itemXml.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/is)?.[1];
    const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/i)?.[1];
    
    if (title && link) {
      items.push({ title: title.trim(), link: link.trim(), description: description?.trim(), pubDate });
    }
  }

  // Try Atom format if no RSS items found
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(text)) !== null) {
      const entryXml = match[1];
      const title = entryXml.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)?.[1] || '';
      const link = entryXml.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] || '';
      const summary = entryXml.match(/<summary[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/summary>/is)?.[1];
      const updated = entryXml.match(/<updated>(.*?)<\/updated>/i)?.[1];
      
      if (title && link) {
        items.push({ title: title.trim(), link: link.trim(), description: summary?.trim(), pubDate: updated });
      }
    }
  }

  return { items, newEtag, newLastModified };
}

// Extract price from text
function extractPrice(text: string): { price: number; oldPrice: number | null; currency: string } | null {
  // Match prices like £19.99, $29.99, €15.00
  const priceRegex = /([£$€])\s*(\d+(?:[.,]\d{1,2})?)/g;
  const prices: number[] = [];
  let currency = 'GBP';
  let match;
  
  while ((match = priceRegex.exec(text)) !== null) {
    currency = match[1] === '£' ? 'GBP' : match[1] === '$' ? 'USD' : 'EUR';
    prices.push(parseFloat(match[2].replace(',', '.')));
  }

  if (prices.length === 0) return null;
  
  // Sort prices - lowest is likely current, highest is likely old
  prices.sort((a, b) => a - b);
  
  return {
    price: prices[0],
    oldPrice: prices.length > 1 ? prices[prices.length - 1] : null,
    currency,
  };
}

// Check if deal matches a rule
function dealMatchesRule(deal: NormalizedDeal, rule: DealRule): boolean {
  const titleLower = deal.title.toLowerCase();
  const storeLower = (deal.store || '').toLowerCase();

  // Check keywords include (any match)
  if (rule.keywords_include.length > 0) {
    const hasInclude = rule.keywords_include.some(kw => titleLower.includes(kw.toLowerCase()));
    if (!hasInclude) return false;
  }

  // Check keywords exclude (none match)
  if (rule.keywords_exclude.length > 0) {
    const hasExclude = rule.keywords_exclude.some(kw => titleLower.includes(kw.toLowerCase()));
    if (hasExclude) return false;
  }

  // Check category
  if (rule.category && deal.category && deal.category.toLowerCase() !== rule.category.toLowerCase()) {
    return false;
  }

  // Check price range
  if (rule.min_price !== null && deal.price < rule.min_price) return false;
  if (rule.max_price !== null && deal.price > rule.max_price) return false;

  // Check discount
  if (rule.min_discount_percent !== null && (deal.discount_percent === null || deal.discount_percent < rule.min_discount_percent)) {
    return false;
  }

  // Check store whitelist
  if (rule.store_whitelist.length > 0) {
    const inWhitelist = rule.store_whitelist.some(s => storeLower.includes(s.toLowerCase()));
    if (!inWhitelist) return false;
  }

  // Check store blacklist
  if (rule.store_blacklist.length > 0) {
    const inBlacklist = rule.store_blacklist.some(s => storeLower.includes(s.toLowerCase()));
    if (inBlacklist) return false;
  }

  return true;
}

// Send deal notification email
async function sendDealEmail(
  resend: InstanceType<typeof Resend>,
  email: string,
  deals: Array<NormalizedDeal & { id: string }>,
  ruleName: string
): Promise<boolean> {
  const dealList = deals.map(d => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        ${d.image_url ? `<img src="${d.image_url}" alt="" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;" />` : ''}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <a href="${d.url}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${d.title}</a>
        <br />
        <span style="color: #6b7280; font-size: 14px;">${d.store || 'Unknown store'}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
        <span style="color: #059669; font-weight: 700; font-size: 18px;">£${d.price.toFixed(2)}</span>
        ${d.old_price ? `<br /><span style="color: #9ca3af; text-decoration: line-through;">£${d.old_price.toFixed(2)}</span>` : ''}
        ${d.discount_percent ? `<br /><span style="background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 12px;">${d.discount_percent.toFixed(0)}% off</span>` : ''}
      </td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🎯 New Deals Found!</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">Matching rule: ${ruleName}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${dealList}
        </table>
        <div style="padding: 16px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>You're receiving this because you set up deal alerts in LFinance.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await resend.emails.send({
      from: "Deal Alerts <onboarding@resend.dev>",
      to: [email],
      subject: `🎯 ${deals.length} new deal${deals.length > 1 ? 's' : ''} found matching "${ruleName}"`,
      html,
    });
    
    if (result.error) {
      console.error("Resend error:", result.error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Email send error:", e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { sourceId } = await req.json().catch(() => ({}));

    // Fetch sources to scan
    let sourcesQuery = supabase
      .from('deal_sources')
      .select('*')
      .eq('user_id', user.id)
      .eq('enabled', true);
    
    if (sourceId) {
      sourcesQuery = sourcesQuery.eq('id', sourceId);
    }

    const { data: sources, error: sourcesError } = await sourcesQuery;
    if (sourcesError) throw sourcesError;

    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No sources to scan', scanned: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user's deal rules
    const { data: rules } = await supabase
      .from('deal_rules')
      .select('*')
      .eq('user_id', user.id)
      .eq('enabled', true);

    const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
    const results: Array<{ sourceId: string; sourceName: string; status: string; dealsFound: number; dealsInserted: number; error?: string }> = [];
    const allNewDeals: Array<NormalizedDeal & { id: string }> = [];

    // Process each source
    for (const source of sources as DealSource[]) {
      const logId = crypto.randomUUID();
      
      // Create scan log entry
      await supabase.from('deal_scan_logs').insert({
        id: logId,
        user_id: user.id,
        source_id: source.id,
        status: 'running',
      });

      try {
        let deals: NormalizedDeal[] = [];

        if (source.type === 'rss') {
          const { items, newEtag, newLastModified } = await parseRSSFeed(
            source.scan_url,
            source.etag,
            source.last_modified
          );

          for (const item of items) {
            const priceInfo = extractPrice(item.title + ' ' + (item.description || ''));
            if (!priceInfo) continue; // Skip items without prices

            const discountPercent = priceInfo.oldPrice 
              ? Math.round((1 - priceInfo.price / priceInfo.oldPrice) * 100)
              : null;

            const hash = await hashDeal(item.title, priceInfo.price, null, item.link);

            deals.push({
              source_id: source.id,
              source_name: source.name,
              title: item.title,
              price: priceInfo.price,
              old_price: priceInfo.oldPrice,
              discount_percent: discountPercent,
              currency: priceInfo.currency,
              url: item.link,
              image_url: null,
              store: new URL(source.base_url).hostname.replace('www.', ''),
              category: null,
              description_snippet: item.description?.substring(0, 200) || null,
              hash,
            });
          }

          // Update source with new etag/last-modified
          await supabase
            .from('deal_sources')
            .update({
              etag: newEtag,
              last_modified: newLastModified,
              last_scan_at: new Date().toISOString(),
              last_scan_status: 'success',
              last_error: null,
            })
            .eq('id', source.id);
        }

        // Insert deals with deduplication
        let inserted = 0;
        let updated = 0;

        for (const deal of deals) {
          // Check if deal exists
          const { data: existing } = await supabase
            .from('deals')
            .select('id, price')
            .eq('user_id', user.id)
            .eq('hash', deal.hash)
            .maybeSingle();

          if (existing) {
            // Check for price drop
            if (deal.price < existing.price) {
              const dropPercent = Math.round((1 - deal.price / existing.price) * 100);
              
              // Record price history
              await supabase.from('deal_price_history').insert({
                deal_id: existing.id,
                user_id: user.id,
                price: deal.price,
              });

              // Update deal
              await supabase
                .from('deals')
                .update({
                  price: deal.price,
                  old_price: existing.price,
                  discount_percent: dropPercent,
                  price_dropped: true,
                  last_seen_at: new Date().toISOString(),
                })
                .eq('id', existing.id);

              updated++;
              allNewDeals.push({ ...deal, id: existing.id });
            } else {
              // Just update last_seen_at
              await supabase
                .from('deals')
                .update({ last_seen_at: new Date().toISOString(), is_new: false })
                .eq('id', existing.id);
            }
          } else {
            // Insert new deal
            const { data: newDeal, error: insertError } = await supabase
              .from('deals')
              .insert({ ...deal, user_id: user.id })
              .select('id')
              .single();

            if (!insertError && newDeal) {
              inserted++;
              allNewDeals.push({ ...deal, id: newDeal.id });
            }
          }

          // Rate limiting between deals
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Update scan log
        await supabase
          .from('deal_scan_logs')
          .update({
            status: 'success',
            ended_at: new Date().toISOString(),
            deals_found: deals.length,
            deals_inserted: inserted,
            deals_updated: updated,
            request_time_ms: Date.now() - startTime,
          })
          .eq('id', logId);

        results.push({
          sourceId: source.id,
          sourceName: source.name,
          status: 'success',
          dealsFound: deals.length,
          dealsInserted: inserted,
        });
      } catch (sourceError: any) {
        console.error(`Error scanning source ${source.name}:`, sourceError);

        await supabase
          .from('deal_sources')
          .update({
            last_scan_at: new Date().toISOString(),
            last_scan_status: 'fail',
            last_error: sourceError.message,
          })
          .eq('id', source.id);

        await supabase
          .from('deal_scan_logs')
          .update({
            status: 'fail',
            ended_at: new Date().toISOString(),
            error_message: sourceError.message,
            request_time_ms: Date.now() - startTime,
          })
          .eq('id', logId);

        results.push({
          sourceId: source.id,
          sourceName: source.name,
          status: 'fail',
          dealsFound: 0,
          dealsInserted: 0,
          error: sourceError.message,
        });
      }
    }

    // Match deals against rules and send notifications
    if (rules && rules.length > 0 && allNewDeals.length > 0) {
      for (const rule of rules as DealRule[]) {
        // Check cooldown
        if (rule.last_notified_at) {
          const cooldownMs = rule.alert_cooldown_minutes * 60 * 1000;
          const lastNotified = new Date(rule.last_notified_at).getTime();
          if (Date.now() - lastNotified < cooldownMs) {
            continue; // Skip this rule, still in cooldown
          }
        }

        const matchingDeals = allNewDeals.filter(d => dealMatchesRule(d, rule));

        if (matchingDeals.length === 0) continue;

        // Create in-app notifications
        if (rule.notify_in_app) {
          for (const deal of matchingDeals) {
            await supabase.from('deal_notifications').insert({
              user_id: user.id,
              deal_id: deal.id,
              rule_id: rule.id,
              title: `New deal: ${deal.title}`,
              message: `£${deal.price.toFixed(2)}${deal.discount_percent ? ` (${deal.discount_percent}% off)` : ''} at ${deal.store || 'Unknown'}`,
              notification_type: deal.price_dropped ? 'price_drop' : 'new_deal',
            });
          }
        }

        // Send email notification
        if (rule.notify_email && resend) {
          const success = await sendDealEmail(resend, user.email!, matchingDeals, rule.name);
          if (success) {
            await supabase
              .from('deal_rules')
              .update({ last_notified_at: new Date().toISOString() })
              .eq('id', rule.id);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        scanned: sources.length,
        results,
        newDeals: allNewDeals.length,
        elapsedMs: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Scan deals error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
