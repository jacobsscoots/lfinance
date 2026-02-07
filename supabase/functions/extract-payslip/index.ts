import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ExtractionResult {
  gross_pay: number | null;
  net_pay: number | null;
  tax_deducted: number | null;
  ni_deducted: number | null;
  pension_deducted: number | null;
  pay_period_start: string | null;
  pay_period_end: string | null;
  employer_name: string | null;
  confidence: "high" | "medium" | "low";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payslipId, imageBase64, mimeType } = await req.json();

    if (!payslipId || !imageBase64) {
      return new Response(
        JSON.stringify({ error: "Missing payslipId or imageBase64" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the payslip to find user_id for matching
    const { data: payslip, error: payslipError } = await supabase
      .from("payslips")
      .select("user_id")
      .eq("id", payslipId)
      .single();

    if (payslipError || !payslip) {
      throw new Error("Payslip not found");
    }

    // Call Lovable AI for extraction
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a UK payslip data extractor. Extract the following fields from payslips:
- gross_pay: Total earnings before deductions (number)
- net_pay: Take-home pay after all deductions (number)
- tax_deducted: PAYE tax amount (number)
- ni_deducted: National Insurance amount (number)
- pension_deducted: Pension contribution (number)
- pay_period_start: Start of pay period (ISO date string YYYY-MM-DD)
- pay_period_end: End of pay period (ISO date string YYYY-MM-DD)
- employer_name: Company/employer name (string)
- confidence: Your confidence in the extraction accuracy ("high", "medium", or "low")

Return null for any field you cannot extract reliably. Be conservative - if unclear, return null.
UK payslips typically show Tax, NI, and Pension as deductions. Net pay is sometimes labeled "Net Pay", "Take Home Pay", or similar.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the payslip data from this image:",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_payslip_data",
              description: "Extract structured payslip data",
              parameters: {
                type: "object",
                properties: {
                  gross_pay: { type: ["number", "null"] },
                  net_pay: { type: ["number", "null"] },
                  tax_deducted: { type: ["number", "null"] },
                  ni_deducted: { type: ["number", "null"] },
                  pension_deducted: { type: ["number", "null"] },
                  pay_period_start: { type: ["string", "null"] },
                  pay_period_end: { type: ["string", "null"] },
                  employer_name: { type: ["string", "null"] },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                },
                required: ["confidence"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_payslip_data" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI extraction failed:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("AI extraction failed");
    }

    const aiData = await aiResponse.json();
    
    let extracted: ExtractionResult;
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        throw new Error("No tool call response");
      }
      extracted = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      extracted = {
        gross_pay: null,
        net_pay: null,
        tax_deducted: null,
        ni_deducted: null,
        pension_deducted: null,
        pay_period_start: null,
        pay_period_end: null,
        employer_name: null,
        confidence: "low",
      };
    }

    // Update payslip with extracted data
    const updateData: Record<string, unknown> = {
      gross_pay: extracted.gross_pay,
      net_pay: extracted.net_pay,
      tax_deducted: extracted.tax_deducted,
      ni_deducted: extracted.ni_deducted,
      pension_deducted: extracted.pension_deducted,
      pay_period_start: extracted.pay_period_start,
      pay_period_end: extracted.pay_period_end,
      employer_name: extracted.employer_name,
      extraction_confidence: extracted.confidence,
      extraction_raw: aiData,
    };

    // Attempt auto-matching if confidence is not low
    let matchedTransactionId: string | null = null;
    let matchStatus = "pending";

    if (extracted.confidence !== "low" && extracted.net_pay && extracted.pay_period_end) {
      // Find matching income transactions
      // Criteria:
      // - type = 'income'
      // - amount within ±0.50 of net_pay
      // - date within ±2 days of pay_period_end
      // - not already linked to another payslip
      // - description does NOT contain refund indicators
      
      const payPeriodEnd = new Date(extracted.pay_period_end);
      const dateMin = new Date(payPeriodEnd);
      dateMin.setDate(dateMin.getDate() - 2);
      const dateMax = new Date(payPeriodEnd);
      dateMax.setDate(dateMax.getDate() + 2);
      
      const amountMin = extracted.net_pay - 0.50;
      const amountMax = extracted.net_pay + 0.50;

      // Get user's bank accounts
      const { data: accounts } = await supabase
        .from("bank_accounts")
        .select("id")
        .eq("user_id", payslip.user_id);

      if (accounts && accounts.length > 0) {
        const accountIds = accounts.map((a) => a.id);

        const { data: transactions } = await supabase
          .from("transactions")
          .select("id, description, amount, transaction_date")
          .in("account_id", accountIds)
          .eq("type", "income")
          .gte("amount", amountMin)
          .lte("amount", amountMax)
          .gte("transaction_date", dateMin.toISOString().split("T")[0])
          .lte("transaction_date", dateMax.toISOString().split("T")[0]);

        if (transactions) {
          // Filter out refunds
          const refundIndicators = ["refund", "reversal", "correction", "adjustment", "credit note"];
          const filtered = transactions.filter((t) => {
            const desc = t.description.toLowerCase();
            return !refundIndicators.some((indicator) => desc.includes(indicator));
          });

          // Check none are already linked to a payslip
          const { data: existingLinks } = await supabase
            .from("payslips")
            .select("matched_transaction_id")
            .in(
              "matched_transaction_id",
              filtered.map((t) => t.id)
            )
            .neq("id", payslipId);

          const linkedIds = new Set((existingLinks || []).map((l) => l.matched_transaction_id));
          const available = filtered.filter((t) => !linkedIds.has(t.id));

          // Auto-match only if exactly one match
          if (available.length === 1) {
            matchedTransactionId = available[0].id;
            matchStatus = "auto_matched";
          } else if (available.length > 1) {
            // Multiple matches - force manual review
            matchStatus = "pending";
          } else {
            matchStatus = "no_match";
          }
        }
      }
    }

    updateData.matched_transaction_id = matchedTransactionId;
    updateData.match_status = matchStatus;
    if (matchedTransactionId) {
      updateData.matched_at = new Date().toISOString();
    }

    const { data: updatedPayslip, error: updateError } = await supabase
      .from("payslips")
      .update(updateData)
      .eq("id", payslipId)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update payslip:", updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        payslip: updatedPayslip,
        extracted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Extraction error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
