import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function mapStatus(tmStatus: string): string {
  const s = (tmStatus || "").toLowerCase();
  if (["delivered", "signed", "pickup"].includes(s)) return "delivered";
  if (["transit", "intransit", "in_transit", "in transit"].includes(s)) return "in_transit";
  if (["outfordelivery", "out_for_delivery"].includes(s)) return "out_for_delivery";
  if (["exception", "failed", "expired", "undelivered"].includes(s)) return "exception";
  if (["notfound", "not_found", "pending"].includes(s)) return "pending";
  return "unknown";
}

interface TrackingItem {
  id: string;
  tracking_number: string;
  carrier_code: string | null;
  trackingmore_id: string | null;
  status: string;
  created_at: string;
  last_synced_at: string | null;
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

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "TRACKINGMORE_API_KEY not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    // Fetch non-delivered shipments that need polling
    const { data: shipments, error: fetchError } = await supabase
      .from("shipments")
      .select("id, tracking_number, carrier_code, trackingmore_id, status, created_at, last_synced_at")
      .neq("status", "delivered")
      .or(`last_synced_at.is.null,last_synced_at.lt.${oneHourAgo}`)
      .order("last_synced_at", { ascending: true, nullsFirst: true })
      .limit(50);

    if (fetchError) {
      console.error("Fetch shipments error:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch shipments" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!shipments || shipments.length === 0) {
      return new Response(JSON.stringify({ success: true, polled: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Backoff: skip pending shipments created >48h ago that were synced in last 6h
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
    const toProcess = (shipments as TrackingItem[]).filter((s) => {
      if (s.status === "pending" && s.created_at < fortyEightHoursAgo) {
        return !s.last_synced_at || s.last_synced_at < sixHoursAgo;
      }
      return true;
    });

    let updated = 0;
    let errors = 0;

    for (const shipment of toProcess) {
      try {
        // Build query params
        let url = `https://api.trackingmore.com/v4/trackings/get?tracking_numbers=${shipment.tracking_number}`;
        if (shipment.carrier_code) {
          url += `&courier_code=${shipment.carrier_code}`;
        }

        const res = await fetch(url, {
          headers: { "Tracking-Api-Key": apiKey },
        });
        const data = await res.json();
        const tracking = data?.data?.[0];

        if (!tracking) {
          // Mark as synced to avoid re-polling immediately
          await supabase.from("shipments").update({ last_synced_at: now.toISOString() }).eq("id", shipment.id);
          continue;
        }

        const newStatus = mapStatus(tracking.delivery_status);
        const latestEvent = tracking.latest_event_time;

        // Update shipment
        const updatePayload: Record<string, unknown> = {
          status: newStatus,
          last_synced_at: now.toISOString(),
          raw_latest: tracking,
          last_event_at: latestEvent || undefined,
        };

        if (!shipment.trackingmore_id && tracking.id) {
          updatePayload.trackingmore_id = tracking.id;
        }
        if (newStatus === "delivered" && !shipment.status?.includes("delivered")) {
          updatePayload.delivered_at = latestEvent || now.toISOString();
        }

        await supabase.from("shipments").update(updatePayload).eq("id", shipment.id);

        // Insert events from origin_info + destination_info
        const allEvents = [
          ...(tracking.origin_info?.trackinfo || []),
          ...(tracking.destination_info?.trackinfo || []),
        ];

        for (const evt of allEvents) {
          const eventTime = evt.Date || evt.checkpoint_date;
          const message = evt.StatusDescription || evt.checkpoint_delivery_status || evt.Details;
          const location = evt.Details || evt.location || null;

          if (!eventTime) continue;

          await supabase.from("shipment_events").upsert(
            {
              shipment_id: shipment.id,
              event_time: eventTime,
              message: message || "",
              location,
              status: evt.checkpoint_delivery_status || null,
              raw: evt,
            },
            { onConflict: "shipment_id,event_time,message" }
          ).select().maybeSingle();
        }

        updated++;
      } catch (err) {
        console.error(`Poll error for ${shipment.tracking_number}:`, err);
        errors++;
      }

      // Rate limiting: 200ms between requests
      await new Promise((r) => setTimeout(r, 200));
    }

    return new Response(
      JSON.stringify({ success: true, polled: toProcess.length, updated, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Poll error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
