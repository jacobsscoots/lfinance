import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { timingSafeEqual } from "node:crypto";
import { z } from "https://esm.sh/zod@3.23.8";

const webhookBodySchema = z.object({
  data: z.object({
    tracking_number: z.string().max(100).optional(),
    delivery_status: z.string().max(50).optional(),
    courier_code: z.string().max(50).optional(),
    latest_event_time: z.string().max(100).optional(),
    id: z.string().max(100).optional(),
    origin_info: z.any().optional(),
    destination_info: z.any().optional(),
  }).optional(),
  tracking_number: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
  carrier: z.string().max(50).optional(),
  event_time: z.string().max(100).optional(),
}).passthrough();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function safeCompare(a: string, b: string): boolean {
  try {
    const encoder = new TextEncoder();
    const bufA = encoder.encode(a);
    const bufB = encoder.encode(b);
    if (bufA.byteLength !== bufB.byteLength) {
      // Compare against self to maintain constant time
      timingSafeEqual(bufA, bufA);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function mapStatus(tmStatus: string): string {
  const s = (tmStatus || "").toLowerCase();
  if (["delivered", "signed", "pickup"].includes(s)) return "delivered";
  if (["transit", "intransit", "in_transit", "in transit"].includes(s)) return "in_transit";
  if (["outfordelivery", "out_for_delivery"].includes(s)) return "out_for_delivery";
  if (["exception", "failed", "expired", "undelivered"].includes(s)) return "exception";
  if (["notfound", "not_found", "pending"].includes(s)) return "pending";
  return "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook secret using constant-time comparison
    const webhookSecret = Deno.env.get("TRACKING_WEBHOOK_SECRET");
    if (webhookSecret) {
      const url = new URL(req.url);
      const providedSecret = url.searchParams.get("secret") || req.headers.get("x-webhook-secret") || "";
      if (!providedSecret || !safeCompare(providedSecret, webhookSecret)) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const rawBody = await req.json();
    const parseResult = webhookBodySchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = parseResult.data;

    // TrackingMore V4 webhook: { data: { tracking_number, courier_code, delivery_status, ... } }
    const tmData = body.data;
    const trackingNumber = tmData?.tracking_number || body.tracking_number;
    const rawStatus = tmData?.delivery_status || body.status;
    const carrierCode = tmData?.courier_code || body.carrier;
    const latestEventTime = tmData?.latest_event_time || body.event_time;
    const trackingmoreId = tmData?.id || null;

    if (!trackingNumber) {
      return new Response(JSON.stringify({ error: "Missing tracking_number" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mappedStatus = mapStatus(rawStatus ?? '');
    const now = new Date().toISOString();

    // Find shipment by trackingmore_id first, then tracking_number
    let shipment = null;
    if (trackingmoreId) {
      const { data } = await supabase
        .from("shipments")
        .select("id, order_id, status")
        .eq("trackingmore_id", trackingmoreId)
        .maybeSingle();
      shipment = data;
    }
    if (!shipment) {
      const { data } = await supabase
        .from("shipments")
        .select("id, order_id, status")
        .eq("tracking_number", trackingNumber)
        .maybeSingle();
      shipment = data;
    }

    if (!shipment) {
      // Return success to prevent enumeration
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update shipment
    const updatePayload: Record<string, unknown> = {
      status: mappedStatus,
      last_event_at: latestEventTime || now,
      last_synced_at: now,
      raw_latest: body,
      carrier_code: carrierCode || undefined,
    };
    if (trackingmoreId) updatePayload.trackingmore_id = trackingmoreId;
    if (mappedStatus === "delivered") updatePayload.delivered_at = latestEventTime || now;

    await supabase.from("shipments").update(updatePayload).eq("id", shipment.id);

    // Insert events from webhook payload
    const allEvents = [
      ...(tmData?.origin_info?.trackinfo || []),
      ...(tmData?.destination_info?.trackinfo || []),
    ];

    for (const evt of allEvents) {
      const eventTime = evt.Date || evt.checkpoint_date;
      const message = evt.StatusDescription || evt.checkpoint_delivery_status || evt.Details || "";
      const location = evt.Details || evt.location || null;

      if (!eventTime) continue;

      await supabase.from("shipment_events").upsert(
        {
          shipment_id: shipment.id,
          event_time: eventTime,
          message,
          location,
          status: evt.checkpoint_delivery_status || null,
          raw: evt,
        },
        { onConflict: "shipment_id,event_time,message" }
      ).select().maybeSingle();
    }

    // If delivered, update parent order too
    if (mappedStatus === "delivered" && shipment.order_id) {
      await supabase
        .from("online_orders")
        .update({ status: "delivered", updated_at: now })
        .eq("id", shipment.order_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
