import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const emailItemSchema = z.object({
  message_id: z.string().max(500),
  from_email: z.string().max(500),
  subject: z.string().max(1000).optional(),
  body_snippet: z.string().max(10000).optional(),
  received_at: z.string().max(50).optional(),
});

const ingestInputSchema = z.object({
  emails: z.array(emailItemSchema).max(100),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Retailer domain mapping
const RETAILER_DOMAINS: Record<string, string> = {
  "amazon.co.uk": "Amazon",
  "amazon.com": "Amazon",
  "boots.com": "Boots",
  "superdrug.com": "Superdrug",
  "savers.co.uk": "Savers",
  "tesco.com": "Tesco",
};

const DISPATCH_KEYWORDS = [
  "dispatched", "shipped", "on its way", "out for delivery",
  "order confirmed", "order confirmation", "we've sent",
];

const DELIVERY_KEYWORDS = [
  "delivered", "has arrived", "successfully delivered", "left in safe place",
];

const ORDER_PATTERNS = [
  /order\s*(?:#|number|no\.?|ref\.?)\s*[:.]?\s*([A-Z0-9-]{4,30})/i,
  /order\s*([0-9]{3,}-[0-9]{3,}-[0-9]{3,})/i,
  /ref(?:erence)?[:\s]+([A-Z0-9-]{4,30})/i,
];

const TRACKING_PATTERNS = [
  { carrier: "Royal Mail", courierCode: "royal-mail", pattern: /\b([A-Z]{2}\d{9}GB)\b/i },
  { carrier: "DPD", courierCode: "dpd", pattern: /\b(\d{14})\b/ },
  { carrier: "Evri", courierCode: "evri", pattern: /\b(H[A-Z0-9]{15,20})\b/i },
  { carrier: "Yodel", courierCode: "yodel", pattern: /\b(JD\d{16,18})\b/i },
  { carrier: null, courierCode: null, pattern: /tracking\s*(?:#|number|no\.?)\s*[:.]?\s*([A-Z0-9]{8,30})/i },
];

// Register a tracking number with TrackingMore API
async function registerWithTrackingMore(trackingNumber: string, courierCode: string | null): Promise<void> {
  const apiKey = Deno.env.get("TRACKINGMORE_API_KEY");
  if (!apiKey) {
    console.warn("TRACKINGMORE_API_KEY not set, skipping registration");
    return;
  }

  try {
    const body: Record<string, string> = { tracking_number: trackingNumber };
    if (courierCode) {
      body.courier_code = courierCode;
    }

    const res = await fetch("https://api.trackingmore.com/v4/trackings/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Tracking-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`TrackingMore: registered ${trackingNumber}`, data?.data?.courier_code);
    } else {
      // 4016 = already exists, which is fine
      if (data?.meta?.code === 4016) {
        console.log(`TrackingMore: ${trackingNumber} already registered`);
      } else {
        console.error(`TrackingMore registration failed for ${trackingNumber}:`, data);
      }
    }
  } catch (err) {
    console.error(`TrackingMore registration error for ${trackingNumber}:`, err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get auth user from JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.json();
    const parseResult = ingestInputSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parseResult.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { emails } = parseResult.data;

    let ordersCreated = 0;
    let shipmentsCreated = 0;
    let skipped = 0;

    for (const email of emails) {
      const { message_id, from_email, subject, body_snippet, received_at } = email;

      if (!message_id || !from_email) {
        skipped++;
        continue;
      }

      // Check idempotency
      const { data: existing } = await supabase
        .from("online_orders")
        .select("id")
        .eq("user_id", user.id)
        .eq("source", "gmail")
        .eq("source_message_id", message_id)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // Detect retailer
      const domain = from_email.split("@")[1]?.toLowerCase();
      let retailerName = "Other";
      for (const [pattern, name] of Object.entries(RETAILER_DOMAINS)) {
        if (domain === pattern || domain?.endsWith(`.${pattern}`)) {
          retailerName = name;
          break;
        }
      }

      // Classify email type
      const text = `${subject} ${body_snippet || ""}`.toLowerCase();
      let status = "detected";
      if (DELIVERY_KEYWORDS.some((kw) => text.includes(kw))) status = "delivered";
      else if (DISPATCH_KEYWORDS.some((kw) => text.includes(kw))) status = "shipped";

      // Extract order number
      const fullText = `${subject}\n${body_snippet || ""}`;
      let orderNumber: string | null = null;
      for (const pattern of ORDER_PATTERNS) {
        const match = fullText.match(pattern);
        if (match?.[1]) {
          orderNumber = match[1].trim();
          break;
        }
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("online_orders")
        .insert({
          user_id: user.id,
          retailer_name: retailerName,
          order_number: orderNumber,
          order_date: received_at || new Date().toISOString(),
          status,
          source: "gmail",
          source_message_id: message_id,
        })
        .select("id")
        .single();

      if (orderError) {
        console.error("Order insert error:", orderError);
        skipped++;
        continue;
      }

      ordersCreated++;

      // Extract tracking number
      let trackingNumber: string | null = null;
      let carrier: string | null = null;
      let courierCode: string | null = null;
      for (const { carrier: c, courierCode: cc, pattern } of TRACKING_PATTERNS) {
        const match = fullText.match(pattern);
        if (match?.[1]) {
          trackingNumber = match[1].trim();
          carrier = c;
          courierCode = cc;
          break;
        }
      }

      if (trackingNumber && order) {
        // Check if tracking already exists
        const { data: existingShipment } = await supabase
          .from("order_shipments")
          .select("id")
          .eq("user_id", user.id)
          .eq("tracking_number", trackingNumber)
          .maybeSingle();

        if (!existingShipment) {
          const { error: shipError } = await supabase
            .from("order_shipments")
            .insert({
              user_id: user.id,
              order_id: order.id,
              tracking_number: trackingNumber,
              carrier,
              tracking_provider: "trackingmore",
              status: status === "delivered" ? "delivered" : "pending",
            });

          if (!shipError) {
            shipmentsCreated++;
            // Register with TrackingMore for live updates (don't await to avoid slowing down)
            if (status !== "delivered") {
              registerWithTrackingMore(trackingNumber, courierCode);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        orders_created: ordersCreated,
        shipments_created: shipmentsCreated,
        skipped,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Ingest error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
