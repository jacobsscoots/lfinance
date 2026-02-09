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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();

    // Support both AfterShip and generic tracking webhook formats
    const trackingNumber = body.tracking_number || body.msg?.tracking_number;
    const status = body.status || body.msg?.tag;
    const carrier = body.carrier || body.msg?.slug;
    const eventTime = body.event_time || body.msg?.updated_at;

    if (!trackingNumber) {
      return new Response(
        JSON.stringify({ error: "Missing tracking_number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map provider statuses to our statuses
    let mappedStatus = "pending";
    const rawStatus = (status || "").toLowerCase();
    if (["delivered", "signed"].includes(rawStatus)) {
      mappedStatus = "delivered";
    } else if (["intransit", "in_transit", "in transit", "outfordelivery", "out_for_delivery"].includes(rawStatus)) {
      mappedStatus = "in_transit";
    } else if (["exception", "failed", "expired"].includes(rawStatus)) {
      mappedStatus = "exception";
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
      // Tracking number not found — not an error, just ignore
      return new Response(
        JSON.stringify({ message: "Tracking number not found, ignored" }),
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

    return new Response(
      JSON.stringify({ success: true, shipment_id: shipment.id, status: mappedStatus }),
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
