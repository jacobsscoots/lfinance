import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const inputSchema = z.object({
  action: z.enum(["connect", "sync", "disconnect"]),
  username: z.string().email().max(255).optional(),
  password: z.string().min(1).max(500).optional(),
  from: z.string().max(30).optional(),
  to: z.string().max(30).optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BRIGHT_API_BASE = "https://api.glowmarkt.com/api/v0-1";
const BRIGHT_APP_ID = "b0f1b774-a586-4f72-9edd-27ead8aa7a8d";

interface BrightAuthResponse {
  token: string;
  exp: number;
}

interface BrightResource {
  resourceId: string;
  resourceTypeId: string;
  name: string;
  classifier: string;
}

// Bright API returns readings as [timestamp, value] arrays
type BrightReading = [number, number];

async function authenticateBright(username: string, password: string): Promise<BrightAuthResponse> {
  const response = await fetch(`${BRIGHT_API_BASE}/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "applicationId": BRIGHT_APP_ID,
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bright auth failed: ${response.status} - ${text}`);
  }

  return await response.json();
}

async function getResources(token: string): Promise<BrightResource[]> {
  const response = await fetch(`${BRIGHT_API_BASE}/resource`, {
    headers: {
      "token": token,
      "applicationId": BRIGHT_APP_ID,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get resources: ${response.status} - ${text}`);
  }

  return await response.json();
}

async function getReadings(
  token: string,
  resourceId: string,
  from: string,
  to: string,
  period: string = "P1D"
): Promise<BrightReading[]> {
  const params = new URLSearchParams({
    from,
    to,
    period,
    function: "sum",
  });
  const url = `${BRIGHT_API_BASE}/resource/${resourceId}/readings?${params.toString()}`;
  
  console.log("Fetching readings from:", url);
  
  const response = await fetch(url, {
    headers: {
      "token": token,
      "applicationId": BRIGHT_APP_ID,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get readings: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return data.data || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const rawBody = await req.json();
    const parseResult = inputSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parseResult.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { action, username, password, from, to } = parseResult.data;

    // Get or create connection
    let { data: connection } = await supabase
      .from("bright_connections")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Handle connect action
    if (action === "connect") {
      if (!username || !password) {
        throw new Error("Username and password required");
      }

      // Authenticate with Bright
      const authResult = await authenticateBright(username, password);
      
      // Get available resources
      const resources = await getResources(authResult.token);
      
      // Find electricity and gas resources
      const electricityResource = resources.find(
        (r) => r.classifier === "electricity.consumption"
      );
      const gasResource = resources.find(
        (r) => r.classifier === "gas.consumption"
      );

      const tokenExpiresAt = new Date(authResult.exp * 1000).toISOString();

      // Upsert connection
      const { data: newConnection, error: upsertError } = await supabase
        .from("bright_connections")
        .upsert({
          user_id: user.id,
          access_token: authResult.token,
          token_expires_at: tokenExpiresAt,
          electricity_resource_id: electricityResource?.resourceId || null,
          gas_resource_id: gasResource?.resourceId || null,
          status: "connected",
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "user_id" })
        .select()
        .single();

      if (upsertError) throw upsertError;

      return new Response(
        JSON.stringify({
          success: true,
          connection: {
            status: newConnection.status,
            hasElectricity: !!electricityResource,
            hasGas: !!gasResource,
          },
          resources: resources.map((r) => ({
            id: r.resourceId,
            name: r.name,
            classifier: r.classifier,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle sync action
    if (action === "sync") {
      if (!connection || connection.status !== "connected") {
        throw new Error("Not connected to Bright. Please connect first.");
      }

      console.log("Connection token_expires_at:", connection.token_expires_at);
      
      // Check if token expired - handle null/undefined
      const tokenExpiry = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
      if (tokenExpiry && tokenExpiry < new Date()) {
        await supabase
          .from("bright_connections")
          .update({ status: "expired" })
          .eq("id", connection.id);
        throw new Error("Token expired. Please reconnect.");
      }

      // Format dates as YYYY-MM-DDTHH:mm:ss for Bright API
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const formatBrightDate = (d: Date) => {
        return d.toISOString().slice(0, 19);
      };
      
      const syncFrom = from || formatBrightDate(thirtyDaysAgo);
      const syncTo = to || formatBrightDate(now);
      
      console.log("Syncing from:", syncFrom, "to:", syncTo);

      const results = { electricity: 0, gas: 0 };

      // Sync electricity readings
      if (connection.electricity_resource_id) {
        const readings = await getReadings(
          connection.access_token,
          connection.electricity_resource_id,
          syncFrom,
          syncTo,
          "P1D"
        );

        console.log("Got electricity readings:", readings.length, "First reading:", readings[0]);

        for (const reading of readings) {
          // Bright API returns [timestamp, value] arrays
          const [timestamp, value] = reading;
          const readingDate = new Date(timestamp * 1000).toISOString().split("T")[0];
          
          await supabase
            .from("energy_readings")
            .upsert({
              user_id: user.id,
              reading_date: readingDate,
              fuel_type: "electricity",
              consumption_kwh: value,
              source: "bright",
            }, { onConflict: "user_id,reading_date,fuel_type" });
          
          results.electricity++;
        }
      }

      // Sync gas readings
      if (connection.gas_resource_id) {
        const readings = await getReadings(
          connection.access_token,
          connection.gas_resource_id,
          syncFrom,
          syncTo,
          "P1D"
        );

        console.log("Got gas readings:", readings.length);

        for (const reading of readings) {
          // Bright API returns [timestamp, value] arrays
          const [timestamp, value] = reading;
          const readingDate = new Date(timestamp * 1000).toISOString().split("T")[0];
          
          await supabase
            .from("energy_readings")
            .upsert({
              user_id: user.id,
              reading_date: readingDate,
              fuel_type: "gas",
              consumption_kwh: value,
              source: "bright",
            }, { onConflict: "user_id,reading_date,fuel_type" });
          
          results.gas++;
        }
      }

      // Update last synced
      await supabase
        .from("bright_connections")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", connection.id);

      return new Response(
        JSON.stringify({
          success: true,
          syncedReadings: results,
          syncFrom,
          syncTo,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle disconnect action
    if (action === "disconnect") {
      await supabase
        .from("bright_connections")
        .delete()
        .eq("user_id", user.id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: any) {
    console.error("Bright sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
