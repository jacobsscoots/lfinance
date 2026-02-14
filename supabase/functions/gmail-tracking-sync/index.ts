import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Shipping-related subject keywords ──
const SHIPPING_KEYWORDS = [
  "shipped", "dispatched", "delivery", "on the way", "on its way",
  "tracking", "your order", "out for delivery", "has been sent",
  "order confirmed", "we've sent", "parcel", "consignment",
  "your package", "shipment",
];

// ── Known carrier/retailer domains for filtering ──
const SHIPPING_DOMAINS = [
  "amazon", "royalmail", "royal-mail", "evri", "hermes", "dpd", "dhl",
  "yodel", "parcelforce", "ups", "fedex", "tnt", "boots", "superdrug",
  "asos", "argos", "currys", "ebay", "myprotein", "gymshark",
];

// ── Tracking number patterns (carrier detection from email body/links) ──
const TRACKING_PATTERNS: { pattern: RegExp; carrierCode: string; carrier: string }[] = [
  { pattern: /\b([A-Z]{2}\d{9}GB)\b/gi, carrierCode: "royal-mail", carrier: "Royal Mail" },
  { pattern: /\b(H[A-Z0-9]{15,20})\b/gi, carrierCode: "evri", carrier: "Evri" },
  { pattern: /\b(JD\d{16,18})\b/gi, carrierCode: "yodel", carrier: "Yodel" },
  { pattern: /\b(1Z[A-Z0-9]{16})\b/gi, carrierCode: "ups", carrier: "UPS" },
  // DPD: 14-digit numbers — only match near "dpd" context
  { pattern: /dpd[^a-z]*(\d{14})/gi, carrierCode: "dpd", carrier: "DPD" },
];

// ── Carrier detection from links ──
const CARRIER_LINK_PATTERNS: { pattern: RegExp; carrierCode: string }[] = [
  { pattern: /royalmail\.com/i, carrierCode: "royal-mail" },
  { pattern: /evri\.com|myhermes\.co\.uk/i, carrierCode: "evri" },
  { pattern: /dpd\.co\.uk|track\.dpd/i, carrierCode: "dpd" },
  { pattern: /dhl\.\w+/i, carrierCode: "dhl" },
  { pattern: /yodel\.co\.uk/i, carrierCode: "yodel" },
  { pattern: /parcelforce\.com/i, carrierCode: "parcelforce" },
  { pattern: /ups\.com/i, carrierCode: "ups" },
  { pattern: /fedex\.com/i, carrierCode: "fedex" },
];

// ── Generic tracking number pattern (fallback) ──
const GENERIC_TRACKING = /tracking\s*(?:#|number|no\.?|ref\.?|:)\s*[:.]?\s*([A-Z0-9]{8,30})/gi;

// ── URL-encoded tracking (common in retailer emails) ──
const URL_TRACKING = /(?:track|tracking)[^"']*?(?:number|id|code|ref)=([A-Z0-9-]{8,30})/gi;

interface ExtractionResult {
  trackingNumber: string;
  carrierCode: string | null;
  confidence: number;
}

function extractTrackingFromText(text: string): ExtractionResult[] {
  const results: ExtractionResult[] = [];
  const seen = new Set<string>();

  // 1. Try carrier-specific patterns (high confidence)
  for (const { pattern, carrierCode } of TRACKING_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const tn = match[1].toUpperCase();
      if (!seen.has(tn)) {
        seen.add(tn);
        results.push({ trackingNumber: tn, carrierCode, confidence: 0.9 });
      }
    }
  }

  // 2. Try detecting carrier from links + nearby tracking number
  let linkCarrier: string | null = null;
  for (const { pattern, carrierCode } of CARRIER_LINK_PATTERNS) {
    if (pattern.test(text)) {
      linkCarrier = carrierCode;
      break;
    }
  }

  // 3. Try URL-embedded tracking numbers (medium confidence)
  URL_TRACKING.lastIndex = 0;
  let urlMatch;
  while ((urlMatch = URL_TRACKING.exec(text)) !== null) {
    const tn = urlMatch[1].toUpperCase();
    if (!seen.has(tn) && tn.length >= 8) {
      seen.add(tn);
      results.push({ trackingNumber: tn, carrierCode: linkCarrier, confidence: 0.7 });
    }
  }

  // 4. Generic "tracking number" label (lower confidence)
  GENERIC_TRACKING.lastIndex = 0;
  let genMatch;
  while ((genMatch = GENERIC_TRACKING.exec(text)) !== null) {
    const tn = genMatch[1].toUpperCase();
    if (!seen.has(tn) && tn.length >= 8) {
      seen.add(tn);
      results.push({ trackingNumber: tn, carrierCode: linkCarrier, confidence: 0.5 });
    }
  }

  return results;
}

function decodeEmailBody(payload: any): string {
  const parts: string[] = [];

  function walk(node: any) {
    if (node.body?.data) {
      try {
        // Gmail base64url encoding
        const decoded = atob(node.body.data.replace(/-/g, "+").replace(/_/g, "/"));
        parts.push(decoded);
      } catch (_) { /* ignore decode errors */ }
    }
    if (node.parts) {
      for (const part of node.parts) walk(part);
    }
  }

  walk(payload);
  return parts.join("\n");
}

async function refreshGmailToken(
  supabase: any,
  connectionId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret || !refreshToken) return null;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      await supabase.from("gmail_connections").update({ status: "error" }).eq("id", connectionId);
      return null;
    }

    const tokens = await res.json();
    await supabase.from("gmail_connections").update({
      access_token: tokens.access_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      status: "active",
    }).eq("id", connectionId);

    return tokens.access_token;
  } catch (err) {
    console.error("Token refresh error:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const trackingMoreKey = Deno.env.get("TRACKINGMORE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Support two modes:
    // 1. User-triggered (with auth header) — syncs that user
    // 2. Cron-triggered (no auth) — syncs all active connections
    const authHeader = req.headers.get("authorization");
    let userIds: string[] = [];

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userIds = [user.id];
    } else {
      // Cron mode: get all active gmail connections
      const { data: connections } = await supabase
        .from("gmail_connections")
        .select("user_id")
        .eq("status", "active");
      userIds = (connections || []).map((c: any) => c.user_id);
    }

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalExtracted = 0;
    let totalShipments = 0;

    for (const userId of userIds) {
      try {
        // Get connection
        const { data: conn } = await supabase
          .from("gmail_connections")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();

        if (!conn) continue;

        // Refresh token if needed
        let accessToken = conn.access_token;
        if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
          accessToken = await refreshGmailToken(supabase, conn.id, conn.refresh_token);
          if (!accessToken) continue;
        }

        // Build search query for shipping emails
        const afterDate = new Date();
        afterDate.setDate(afterDate.getDate() - 30); // Look back 30 days
        const afterStr = afterDate.toISOString().split("T")[0].replace(/-/g, "/");

        const subjectTerms = SHIPPING_KEYWORDS.map((k) => `subject:${k}`).join(" OR ");
        const searchQuery = `after:${afterStr} (${subjectTerms})`;

        const searchRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=30`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!searchRes.ok) {
          console.error(`Gmail search failed for user ${userId}:`, await searchRes.text());
          continue;
        }

        const searchData = await searchRes.json();
        const messages = searchData.messages || [];

        for (const msg of messages) {
          // Dedupe: already processed?
          const { data: existing } = await supabase
            .from("email_tracking_extractions")
            .select("id")
            .eq("user_id", userId)
            .eq("provider_message_id", msg.id)
            .maybeSingle();

          if (existing) continue;

          // Fetch message
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (!msgRes.ok) continue;

          const msgData = await msgRes.json();
          const headers = msgData.payload?.headers || [];
          const subject = headers.find((h: any) => h.name === "Subject")?.value || "";
          const from = headers.find((h: any) => h.name === "From")?.value || "";
          const date = headers.find((h: any) => h.name === "Date")?.value;

          // Check if from a known shipping domain (optional boost)
          const fromLower = from.toLowerCase();
          const isKnownDomain = SHIPPING_DOMAINS.some((d) => fromLower.includes(d));

          // Decode body
          const bodyText = decodeEmailBody(msgData.payload);
          const fullText = `${subject}\n${bodyText}`;

          // Extract tracking
          const extractions = extractTrackingFromText(fullText);
          const snippet = (msgData.snippet || "").slice(0, 200);

          if (extractions.length === 0) {
            // Log that we processed but found nothing
            await supabase.from("email_tracking_extractions").upsert({
              user_id: userId,
              provider_message_id: msg.id,
              received_at: date ? new Date(date).toISOString() : null,
              from_email: from.slice(0, 200),
              subject: subject.slice(0, 300),
              raw_excerpt: snippet,
              parse_confidence: 0,
            }, { onConflict: "user_id,provider_message_id" });
            continue;
          }

          // Process best extraction (highest confidence)
          const best = extractions.sort((a, b) => b.confidence - a.confidence)[0];
          const confidence = isKnownDomain ? Math.min(best.confidence + 0.1, 1.0) : best.confidence;

          // Check if shipment already exists
          const { data: existingShipment } = await supabase
            .from("shipments")
            .select("id")
            .eq("user_id", userId)
            .eq("tracking_number", best.trackingNumber)
            .maybeSingle();

          let shipmentId: string | null = existingShipment?.id || null;

          if (!existingShipment) {
            // Create shipment
            const { data: newShipment, error: shipErr } = await supabase
              .from("shipments")
              .insert({
                user_id: userId,
                tracking_number: best.trackingNumber,
                carrier_code: best.carrierCode,
                status: "pending",
                source: "gmail",
              })
              .select("id")
              .single();

            if (!shipErr && newShipment) {
              shipmentId = newShipment.id;
              totalShipments++;

              // Register with TrackingMore
              if (trackingMoreKey) {
                try {
                  const tmBody: Record<string, string> = { tracking_number: best.trackingNumber };
                  if (best.carrierCode) tmBody.courier_code = best.carrierCode;

                  const tmRes = await fetch("https://api.trackingmore.com/v4/trackings/create", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Tracking-Api-Key": trackingMoreKey },
                    body: JSON.stringify(tmBody),
                  });
                  const tmData = await tmRes.json();

                  if (tmRes.ok && tmData?.data?.id) {
                    await supabase.from("shipments").update({
                      trackingmore_id: tmData.data.id,
                      last_synced_at: new Date().toISOString(),
                    }).eq("id", shipmentId);
                  } else if (tmData?.meta?.code === 4016) {
                    // Already exists in TrackingMore
                    const getRes = await fetch(
                      `https://api.trackingmore.com/v4/trackings/get?tracking_numbers=${best.trackingNumber}`,
                      { headers: { "Tracking-Api-Key": trackingMoreKey } }
                    );
                    const getData = await getRes.json();
                    if (getData?.data?.[0]?.id) {
                      await supabase.from("shipments").update({
                        trackingmore_id: getData.data[0].id,
                        last_synced_at: new Date().toISOString(),
                      }).eq("id", shipmentId);
                    }
                  }
                } catch (tmErr) {
                  console.error("TrackingMore registration error:", tmErr);
                }
              }
            }
          }

          // Log extraction
          await supabase.from("email_tracking_extractions").upsert({
            user_id: userId,
            provider_message_id: msg.id,
            received_at: date ? new Date(date).toISOString() : null,
            from_email: from.slice(0, 200),
            subject: subject.slice(0, 300),
            raw_excerpt: snippet,
            extracted_tracking_number: best.trackingNumber,
            extracted_carrier_code: best.carrierCode,
            parse_confidence: confidence,
            created_shipment_id: shipmentId,
          }, { onConflict: "user_id,provider_message_id" });

          totalExtracted++;

          // Rate limit: 100ms between Gmail API calls
          await new Promise((r) => setTimeout(r, 100));
        }

        // Update last sync time
        await supabase.from("gmail_connections").update({
          last_synced_at: new Date().toISOString(),
        }).eq("id", conn.id);

      } catch (userErr) {
        console.error(`Error processing user ${userId}:`, userErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, extracted: totalExtracted, shipments_created: totalShipments }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Gmail tracking sync error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
