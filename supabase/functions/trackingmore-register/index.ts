import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// UK carrier auto-detection patterns
const CARRIER_PATTERNS: { pattern: RegExp; code: string; name: string }[] = [
  { pattern: /^[A-Z]{2}\d{9}GB$/i, code: "royal-mail", name: "Royal Mail" },
  { pattern: /^\d{14}$/, code: "dpd", name: "DPD" },
  { pattern: /^H[A-Z0-9]{15,20}$/i, code: "evri", name: "Evri" },
  { pattern: /^JD\d{16,18}$/i, code: "yodel", name: "Yodel" },
  { pattern: /^\d{10,22}$/, code: "dhl", name: "DHL" },
  { pattern: /^1Z[A-Z0-9]{16}$/i, code: "ups", name: "UPS" },
  { pattern: /^\d{12,15}$/, code: "fedex", name: "FedEx" },
];

function detectCarrier(trackingNumber: string): string | null {
  for (const { pattern, code } of CARRIER_PATTERNS) {
    if (pattern.test(trackingNumber)) return code;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("TRACKINGMORE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tracking_number, carrier_code, order_id } = await req.json();

    if (!tracking_number) {
      return new Response(JSON.stringify({ error: "tracking_number required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-detect carrier if not provided
    const resolvedCarrier = carrier_code || detectCarrier(tracking_number);

    // Upsert shipment row
    const { data: shipment, error: upsertError } = await supabase
      .from("shipments")
      .upsert(
        {
          user_id: user.id,
          order_id: order_id || null,
          tracking_number,
          carrier_code: resolvedCarrier,
          status: "pending",
        },
        { onConflict: "tracking_number", ignoreDuplicates: false }
      )
      .select("id, trackingmore_id")
      .single();

    if (upsertError) {
      // If conflict on upsert, try select existing
      const { data: existing } = await supabase
        .from("shipments")
        .select("id, trackingmore_id")
        .eq("user_id", user.id)
        .eq("tracking_number", tracking_number)
        .maybeSingle();

      if (existing?.trackingmore_id) {
        return new Response(JSON.stringify({ success: true, shipment_id: existing.id, already_registered: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const shipmentId = shipment?.id || null;

    // Register with TrackingMore
    let trackingmoreId: string | null = null;
    let registrationError: string | null = null;

    if (apiKey) {
      const tmBody: Record<string, string> = { tracking_number };
      if (resolvedCarrier) tmBody.courier_code = resolvedCarrier;

      try {
        const res = await fetch("https://api.trackingmore.com/v4/trackings/create", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Tracking-Api-Key": apiKey },
          body: JSON.stringify(tmBody),
        });
        const data = await res.json();

        if (res.ok && data?.data?.id) {
          trackingmoreId = data.data.id;
        } else if (data?.meta?.code === 4016) {
          // Already registered — fetch existing
          const getRes = await fetch(
            `https://api.trackingmore.com/v4/trackings/get?tracking_numbers=${tracking_number}`,
            { headers: { "Tracking-Api-Key": apiKey } }
          );
          const getData = await getRes.json();
          if (getData?.data?.[0]?.id) {
            trackingmoreId = getData.data[0].id;
          }
        } else {
          registrationError = data?.meta?.message || "Registration failed";
          console.error("TrackingMore registration failed:", data);
        }
      } catch (err) {
        registrationError = String(err);
        console.error("TrackingMore error:", err);
      }
    } else {
      registrationError = "TRACKINGMORE_API_KEY not configured";
    }

    // Update shipment with trackingmore_id
    if (shipmentId && trackingmoreId) {
      await supabase
        .from("shipments")
        .update({ trackingmore_id: trackingmoreId, last_synced_at: new Date().toISOString() })
        .eq("id", shipmentId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        shipment_id: shipmentId,
        trackingmore_id: trackingmoreId,
        carrier_code: resolvedCarrier,
        registration_error: registrationError,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Register error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
