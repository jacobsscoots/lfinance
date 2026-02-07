import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Input validation constants
const MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10MB max for images
const MAX_TEXT_LENGTH = 100000; // 100KB max for pasted text
const MAX_URL_LENGTH = 2048;
const VALID_METHODS = ["image", "text", "url"] as const;

function isValidHttpsUrl(value: string | undefined): boolean {
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

interface ExtractedNutrition {
  name?: string;
  brand?: string;
  image_url?: string;
  price?: number;
  offer_price?: number;
  offer_label?: string;
  pack_size_grams?: number;
  energy_kj?: number;
  energy_kcal?: number;
  fat?: number;
  saturates?: number;
  carbohydrate?: number;
  sugars?: number;
  fibre?: number;
  protein?: number;
  salt?: number;
  source_url?: string;
  confidence: Record<string, "high" | "medium" | "low">;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { method, content } = body;
    
    // Validate method
    if (!method || !VALID_METHODS.includes(method)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid method. Use 'image', 'text', or 'url'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Validate content exists
    if (!content || typeof content !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: "Missing or invalid content" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Validate content size based on method
    if (method === "image" && content.length > MAX_CONTENT_SIZE) {
      return new Response(
        JSON.stringify({ success: false, error: "Image too large. Maximum size is 10MB." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (method === "text" && content.length > MAX_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({ success: false, error: "Text too long. Maximum length is 100KB." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (method === "url" && !isValidHttpsUrl(content)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let result: ExtractedNutrition;

    if (method === "image") {
      result = await extractFromImage(content, LOVABLE_API_KEY);
    } else if (method === "text") {
      result = extractFromText(content);
    } else {
      result = await extractFromUrl(content, LOVABLE_API_KEY);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-nutrition error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function extractFromImage(base64Image: string, apiKey: string): Promise<ExtractedNutrition> {
  const systemPrompt = `You are a nutrition label extraction assistant. Extract nutrition information from the provided image of a food product label.

Return ONLY a valid JSON object with these fields (use null for any values you cannot determine):
{
  "name": "product name if visible",
  "brand": "brand name if visible",
  "pack_size_grams": number or null,
  "energy_kj": number per 100g,
  "energy_kcal": number per 100g,
  "fat": number per 100g,
  "saturates": number per 100g (of which saturates),
  "carbohydrate": number per 100g,
  "sugars": number per 100g (of which sugars),
  "fibre": number per 100g,
  "protein": number per 100g,
  "salt": number per 100g (convert from sodium if needed: salt = sodium × 2.5),
  "confidence": { "field_name": "high" | "medium" | "low" for each extracted field }
}

Important:
- All nutrition values should be per 100g
- If the label shows per serving, note the serving size and convert to per 100g
- Mark confidence as "low" if values were converted from sodium or estimated
- Mark confidence as "high" if clearly visible and unambiguous
- Mark confidence as "medium" if partially visible or slightly unclear`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the nutrition information from this food label image:" },
            { type: "image_url", image_url: { url: base64Image } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI API error:", response.status, errorText);
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("Payment required. Please add credits to your workspace.");
    }
    throw new Error("Failed to process image");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  
  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse nutrition data from image");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      ...parsed,
      confidence: parsed.confidence || {},
    };
  } catch {
    throw new Error("Could not parse nutrition data from image");
  }
}

function extractFromText(text: string): ExtractedNutrition {
  const result: ExtractedNutrition = { confidence: {} };
  
  const patterns: Record<string, { patterns: RegExp[]; field: keyof ExtractedNutrition }> = {
    energy_kj: {
      patterns: [
        /energy\s*[\(\[]?\s*kj\s*[\)\]]?\s*:?\s*([\d,.]+)/i,
        /kilojoules?\s*:?\s*([\d,.]+)/i,
        /([\d,.]+)\s*kj/i,
      ],
      field: "energy_kj",
    },
    energy_kcal: {
      patterns: [
        /energy\s*[\(\[]?\s*kcal\s*[\)\]]?\s*:?\s*([\d,.]+)/i,
        /calories?\s*:?\s*([\d,.]+)/i,
        /([\d,.]+)\s*kcal/i,
      ],
      field: "energy_kcal",
    },
    fat: {
      patterns: [/(?:total\s+)?fat\s*:?\s*([\d,.]+)\s*g/i],
      field: "fat",
    },
    saturates: {
      patterns: [
        /(?:of which\s+)?saturates?\s*:?\s*([\d,.]+)\s*g/i,
        /saturated\s+fat\s*:?\s*([\d,.]+)\s*g/i,
      ],
      field: "saturates",
    },
    carbohydrate: {
      patterns: [/carbohydrates?\s*:?\s*([\d,.]+)\s*g/i],
      field: "carbohydrate",
    },
    sugars: {
      patterns: [/(?:of which\s+)?sugars?\s*:?\s*([\d,.]+)\s*g/i],
      field: "sugars",
    },
    fibre: {
      patterns: [/(?:dietary\s+)?fibr?e\s*:?\s*([\d,.]+)\s*g/i],
      field: "fibre",
    },
    protein: {
      patterns: [/proteins?\s*:?\s*([\d,.]+)\s*g/i],
      field: "protein",
    },
    salt: {
      patterns: [/salt\s*:?\s*([\d,.]+)\s*g/i],
      field: "salt",
    },
  };

  const normalizedText = text.replace(/\s+/g, " ");

  for (const [, { patterns: patternList, field }] of Object.entries(patterns)) {
    for (const pattern of patternList) {
      const match = normalizedText.match(pattern);
      if (match?.[1]) {
        const value = parseFloat(match[1].replace(/,/g, ""));
        if (!isNaN(value)) {
          (result as any)[field] = value;
          result.confidence[field] = "medium";
          break;
        }
      }
    }
  }

  // Check for sodium and convert to salt
  const sodiumMatch = normalizedText.match(/sodium\s*:?\s*([\d,.]+)\s*(?:m?g)?/i);
  if (sodiumMatch?.[1] && !result.salt) {
    const sodium = parseFloat(sodiumMatch[1].replace(/,/g, ""));
    if (!isNaN(sodium)) {
      // Sodium is usually in mg, salt in g
      result.salt = (sodium / 1000) * 2.5;
      result.confidence.salt = "low";
    }
  }

  return result;
}

async function extractFromUrl(url: string, apiKey: string): Promise<ExtractedNutrition> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  
  let html: string | undefined;
  let markdown: string | undefined;
  
  // Block page detection indicators
  const blockIndicators = [
    "security check",
    "something is not right",
    "access denied",
    "captcha",
    "please verify",
    "blocked",
    "unusual traffic",
    "bot detection",
    "challenge-platform",
    "ray id",
  ];
  
  // Try Firecrawl first if available (handles anti-bot protection better)
  if (FIRECRAWL_API_KEY) {
    try {
      console.log("Using Firecrawl to fetch URL:", url);
      const firecrawlResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["markdown", "html"],
          onlyMainContent: false,
          waitFor: 5000, // Wait for JS content to load
          timeout: 30000, // 30 second timeout for slow pages
        }),
      });

      const firecrawlData = await firecrawlResponse.json();

      if (!firecrawlResponse.ok) {
        console.error("Firecrawl API error:", firecrawlData);
        // Fall through to direct fetch
      } else if (firecrawlData.success) {
        // Access data correctly - Firecrawl v1 nests content in data.data
        const responseData = firecrawlData.data || firecrawlData;
        markdown = responseData.markdown;
        html = responseData.html;
        
        // Log first 500 chars for debugging
        const preview = (markdown || html || "").substring(0, 500);
        console.log("Firecrawl content preview:", preview);
        
        if (markdown || html) {
          console.log("Successfully fetched via Firecrawl");
          
          // Check if the content is actually a block page
          const contentToCheck = (markdown || html || "").toLowerCase();
          const isBlocked = blockIndicators.some(indicator => 
            contentToCheck.includes(indicator)
          );
          
          if (isBlocked) {
            console.log("Detected blocked page content");
            throw new Error("This website's anti-bot protection blocked the request. Please try using 'Upload Photo' or 'Paste Text' instead - these methods work reliably for any product.");
          }
        }
      }
    } catch (e) {
      // Re-throw if it's our block detection error
      if (e instanceof Error && e.message.includes("anti-bot protection")) {
        throw e;
      }
      console.error("Firecrawl fetch failed:", e);
      // Fall through to direct fetch
    }
  }

  // Fallback to direct fetch if Firecrawl didn't work
  if (!html && !markdown) {
    try {
      console.log("Attempting direct fetch for URL:", url);
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-GB,en;q=0.9",
        },
      });
      
      if (!response.ok) {
        if (response.status === 403 || response.status === 429) {
          throw new Error("This website is blocking automated access. Please try using 'Upload Photo' or 'Paste Text' instead.");
        }
        throw new Error(`Failed to fetch URL (status ${response.status}). Try 'Upload Photo' or 'Paste Text' instead.`);
      }
      
      html = await response.text();
      
      // Check direct fetch for block pages too
      const contentToCheck = html.toLowerCase();
      const isBlocked = blockIndicators.some(indicator => 
        contentToCheck.includes(indicator)
      );
      
      if (isBlocked) {
        throw new Error("This website's anti-bot protection blocked the request. Please try using 'Upload Photo' or 'Paste Text' instead.");
      }
    } catch (e) {
      if (e instanceof Error && (e.message.includes("blocking") || e.message.includes("anti-bot"))) {
        throw e;
      }
      throw new Error("Could not access this URL. The website may be blocking automated access. Try 'Upload Photo' or 'Paste Text' instead.");
    }
  }

  // Prefer markdown (cleaner, more token-efficient) over HTML
  const contentForAi = markdown && markdown.length > 200 ? markdown : html;
  
  if (!contentForAi) {
    throw new Error("Could not retrieve content from this URL. Try 'Upload Photo' or 'Paste Text' instead.");
  }

  // Try to find JSON-LD first (only in HTML)
  if (html) {
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, "").trim();
        try {
          const parsed = JSON.parse(jsonContent);
          if (parsed["@type"] === "Product" || parsed["@type"]?.includes?.("Product")) {
            console.log("Found JSON-LD Product data");
            break;
          }
        } catch {
          // Continue to next script
        }
      }
    }
  }

  // Use AI to extract from content (markdown preferred)
  const contentType = markdown && markdown.length > 200 ? "markdown" : "HTML";
  const systemPrompt = `You are a product data extraction assistant. Extract product and nutrition information from this ${contentType} content.

Return ONLY a valid JSON object with these fields (use null for any values you cannot determine):
{
  "name": "product name",
  "brand": "brand name",
  "image_url": "main product image URL",
  "price": number (standard price in pounds),
  "offer_price": number or null (sale/offer price),
  "offer_label": "offer description" or null,
  "pack_size_grams": number or null,
  "energy_kj": number per 100g,
  "energy_kcal": number per 100g,
  "fat": number per 100g,
  "saturates": number per 100g,
  "carbohydrate": number per 100g,
  "sugars": number per 100g,
  "fibre": number per 100g,
  "protein": number per 100g,
  "salt": number per 100g,
  "confidence": { "field_name": "high" | "medium" | "low" for each extracted field }
}

Look for nutrition tables, product details, and pricing information.
If nutrition is shown per serving, convert to per 100g using the serving size.
For UK supermarkets (Tesco, Sainsbury's, Asda, etc.), the format is usually consistent.`;

  // Truncate content to avoid token limits (markdown is already cleaner)
  const truncatedContent = contentForAi.substring(0, 60000);
  
  console.log(`Sending ${contentType} to AI (${truncatedContent.length} chars)`);

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Extract product information from this webpage ${contentType}:\n\n${truncatedContent}` },
      ],
    }),
  });

  if (!aiResponse.ok) {
    if (aiResponse.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (aiResponse.status === 402) {
      throw new Error("Payment required. Please add credits to your workspace.");
    }
    throw new Error("Failed to extract data from URL");
  }

  const aiData = await aiResponse.json();
  const content = aiData.choices?.[0]?.message?.content || "";

  const jsonMatch2 = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch2) {
    throw new Error("Could not extract product data from this URL. Try 'Upload Photo' or 'Paste Text' instead.");
  }

  try {
    const parsed = JSON.parse(jsonMatch2[0]);
    return {
      ...parsed,
      source_url: url,
      confidence: parsed.confidence || {},
    };
  } catch {
    throw new Error("Could not parse product data from URL. Try 'Upload Photo' or 'Paste Text' instead.");
  }
}
