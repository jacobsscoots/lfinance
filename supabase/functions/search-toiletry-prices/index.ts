import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// UK retailers to search
const UK_RETAILERS = [
  "boots.com",
  "superdrug.com",
  "savers.co.uk",
  "amazon.co.uk",
  "tesco.com",
  "sainsburys.co.uk",
  "asda.com",
  "wilko.com",
];

interface PriceResult {
  retailer: string;
  price: number;
  offer_price?: number;
  offer_label?: string;
  product_url: string;
  product_name: string;
  dispatch_days?: number;
  delivery_days?: number;
  in_stock: boolean;
}

// Extract retailer name from URL
function getRetailerFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    
    if (hostname.includes("boots")) return "Boots";
    if (hostname.includes("superdrug")) return "Superdrug";
    if (hostname.includes("savers")) return "Savers";
    if (hostname.includes("amazon")) return "Amazon UK";
    if (hostname.includes("tesco")) return "Tesco";
    if (hostname.includes("sainsburys") || hostname.includes("sainsbury")) return "Sainsbury's";
    if (hostname.includes("asda")) return "ASDA";
    if (hostname.includes("wilko")) return "Wilko";
    if (hostname.includes("ebay")) return "eBay UK";
    
    return hostname.replace("www.", "").split(".")[0];
  } catch {
    return "Unknown";
  }
}

// Estimate delivery days by retailer
function estimateDeliveryDays(retailer: string, deliveryText: string): { dispatch: number; delivery: number } {
  const lower = deliveryText?.toLowerCase() || "";
  
  // Try to extract specific delivery info
  if (lower.includes("next day") || lower.includes("tomorrow")) {
    return { dispatch: 0, delivery: 1 };
  }
  if (lower.includes("same day")) {
    return { dispatch: 0, delivery: 0 };
  }
  if (lower.includes("1-2 day") || lower.includes("1-2 working")) {
    return { dispatch: 1, delivery: 1 };
  }
  if (lower.includes("2-3 day") || lower.includes("2-3 working")) {
    return { dispatch: 1, delivery: 2 };
  }
  if (lower.includes("3-5 day") || lower.includes("3-5 working")) {
    return { dispatch: 1, delivery: 4 };
  }
  
  // Default estimates by retailer
  const defaults: Record<string, { dispatch: number; delivery: number }> = {
    "Amazon UK": { dispatch: 0, delivery: 2 },
    "Boots": { dispatch: 1, delivery: 3 },
    "Superdrug": { dispatch: 1, delivery: 3 },
    "Savers": { dispatch: 2, delivery: 4 },
    "Tesco": { dispatch: 1, delivery: 3 },
    "Sainsbury's": { dispatch: 1, delivery: 3 },
    "ASDA": { dispatch: 1, delivery: 3 },
    "Wilko": { dispatch: 2, delivery: 4 },
    "eBay UK": { dispatch: 1, delivery: 5 },
  };
  
  return defaults[retailer] || { dispatch: 2, delivery: 5 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productName, brand, size, sizeUnit } = await req.json();

    if (!productName) {
      return new Response(
        JSON.stringify({ success: false, error: "Product name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!FIRECRAWL_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl connector not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build search query
    const sizeStr = size && sizeUnit ? `${size}${sizeUnit}` : "";
    const searchQuery = [brand, productName, sizeStr, "buy UK price"]
      .filter(Boolean)
      .join(" ");

    console.log("Searching for:", searchQuery);

    // Use Firecrawl search
    const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 10,
        lang: "en",
        country: "uk",
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
        },
      }),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error("Firecrawl search error:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: "Search failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const searchData = await searchResponse.json();
    const results = searchData.data || [];

    console.log(`Found ${results.length} search results`);

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ success: true, data: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process each result to extract price info using AI
    const priceResults: PriceResult[] = [];

    for (const result of results.slice(0, 8)) {
      const content = result.markdown || result.description || "";
      const url = result.url || "";
      
      if (!url || !content || content.length < 100) continue;
      
      const retailer = getRetailerFromUrl(url);
      
      // Skip non-retail results
      if (retailer === "Unknown" && !url.includes("shop")) continue;

      try {
        // Use AI to extract price and delivery info
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `Extract product pricing information. Return ONLY valid JSON:
{
  "product_name": "exact product name",
  "price": number (standard price in GBP),
  "offer_price": number or null (sale price),
  "offer_label": "offer text" or null,
  "delivery_info": "delivery text" or null,
  "in_stock": true or false
}
If this doesn't appear to be a product page or you can't find pricing, return {"skip": true}.`
              },
              {
                role: "user",
                content: `Extract pricing from this ${retailer} page:\n\n${content.substring(0, 8000)}`
              }
            ],
          }),
        });

        if (!aiResponse.ok) {
          console.log(`AI extraction failed for ${retailer}`);
          continue;
        }

        const aiData = await aiResponse.json();
        const aiContent = aiData.choices?.[0]?.message?.content || "";
        
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) continue;

        const parsed = JSON.parse(jsonMatch[0]);
        
        if (parsed.skip || !parsed.price) continue;

        const deliveryEstimate = estimateDeliveryDays(retailer, parsed.delivery_info || "");

        priceResults.push({
          retailer,
          price: parsed.price,
          offer_price: parsed.offer_price || undefined,
          offer_label: parsed.offer_label || undefined,
          product_url: url,
          product_name: parsed.product_name || productName,
          dispatch_days: deliveryEstimate.dispatch,
          delivery_days: deliveryEstimate.delivery,
          in_stock: parsed.in_stock !== false,
        });

      } catch (e) {
        console.error(`Error processing ${retailer}:`, e);
        continue;
      }
    }

    // Sort by effective price (offer price or regular price)
    priceResults.sort((a, b) => {
      const priceA = a.offer_price || a.price;
      const priceB = b.offer_price || b.price;
      return priceA - priceB;
    });

    console.log(`Extracted ${priceResults.length} price results`);

    return new Response(
      JSON.stringify({ success: true, data: priceResults }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("search-toiletry-prices error:", e);
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
