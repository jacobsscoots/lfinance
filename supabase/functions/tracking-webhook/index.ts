import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook secret to prevent unauthorized calls
    const webhookSecret = Deno.env.get("TRACKING_WEBHOOK_SECRET");
    if (webhookSecret) {
      const url = new URL(req.url);
      const providedSecret = url.searchParams.get("secret") || req.headers.get("x-webhook-secret");
      if (providedSecret !== webhookSecret) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();

    // Support TrackingMore V4 webhook format and generic formats
    // TrackingMore V4 sends: { data: { tracking_number, courier_code, delivery_status, ... } }
    const tmData = body.data;
    const trackingNumber = tmData?.tracking_number || body.tracking_number || body.msg?.tracking_number;
    const status = tmData?.delivery_status || body.status || body.msg?.tag;
    const carrier = tmData?.courier_code || body.carrier || body.msg?.slug;
    const eventTime = tmData?.latest_event_time || body.event_time || body.msg?.updated_at;

    if (!trackingNumber) {
      return new Response(
        JSON.stringify({ error: "Missing tracking_number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map provider statuses to our statuses (includes TrackingMore V4 statuses)
    let mappedStatus = "pending";
    const rawStatus = (status || "").toLowerCase();
    if (["delivered", "signed", "pickup"].includes(rawStatus)) {
      mappedStatus = "delivered";
    } else if (["intransit", "in_transit", "in transit", "outfordelivery", "out_for_delivery", "transit"].includes(rawStatus)) {
      mappedStatus = "in_transit";
    } else if (["exception", "failed", "expired", "undelivered"].includes(rawStatus)) {
      mappedStatus = "exception";
    } else if (["notfound", "not_found", "pending"].includes(rawStatus)) {
      mappedStatus = "pending";
    }

    // Update the shipment
    const { data: shipment, error: shipmentError } = await supabase
      .from("order_shipments")
      .update({
        status: mappedStatus,
        carrier: carrier || undefined,
        last_event_at: eventTime || new Date().toISOString(),
        last_payload: body,
        updated_at: new Date().toISOString(),
      })
      .eq("tracking_number", trackingNumber)
      .select("id, order_id")
      .maybeSingle();

    if (shipmentError) {
      console.error("Shipment update error:", shipmentError);
      return new Response(
        JSON.stringify({ error: "Failed to update shipment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!shipment) {
      // Tracking number not found — return identical success response to prevent enumeration
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If delivered, also update the parent order
    if (mappedStatus === "delivered" && shipment.order_id) {
      await supabase
        .from("online_orders")
        .update({
          status: "delivered",
          updated_at: new Date().toISOString(),
        })
        .eq("id", shipment.order_id);
    }

    // Return identical response shape regardless of outcome to prevent enumeration
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
