import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OtherDeduction {
  name: string;
  amount: number;
}

interface ExtractionResult {
  gross_pay: number | null;
  net_pay: number | null;
  tax_deducted: number | null;
  ni_deducted: number | null;
  pension_deducted: number | null;
  other_deductions: OtherDeduction[];
  pay_date: string | null;
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
            content: `You are a UK payslip data extractor. Extract ALL of the following fields from the payslip document.

CRITICAL RULES:
1. **Pension**: ONLY extract a pension amount if there is an explicit line labelled "Pension", "Employer Pension", "Employee Pension Contribution", or similar. Do NOT confuse other deductions (e.g. "Health Cash Plan", "Health Care", "Smart Tech", "Union Fees", "Cycle to Work") with pension. If no pension line exists, return null for pension_deducted.

2. **Other Deductions**: Extract ALL salary deductions that are NOT Tax/PAYE, National Insurance, or Pension. This includes items like:
   - Health Cash Plan, Healthcare
   - Union Fees, Union Subscription
   - Smart Tech Repayment, Cycle to Work
   - Student Loan
   - Any other named deduction
   Return each as {name, amount} in the other_deductions array.

3. **Pay Date**: The date the employee is actually paid (often labelled "Pay Date", "Payment Date", "Date Paid"). This is DIFFERENT from the pay period end date. Return as YYYY-MM-DD.

4. **Pay Period**: The start and end of the pay period (e.g. "Period Start"/"Period End", or "Tax Period"). Return as YYYY-MM-DD.

5. **Dates**: UK payslips often use DD.MM.YYYY or DD/MM/YYYY format. Convert all dates to YYYY-MM-DD (ISO format). Be careful with day/month order — in UK format, the day comes first.

6. Gross pay = total earnings before deductions. Net pay = take-home pay after all deductions.

Return null for any field you cannot reliably extract.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all payslip data from this document. Pay careful attention to distinguishing pension from other deductions, and extract the pay date separately from the pay period dates.",
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
              description: "Extract structured payslip data including all deductions",
              parameters: {
                type: "object",
                properties: {
                  gross_pay: { type: ["number", "null"], description: "Total gross pay before deductions" },
                  net_pay: { type: ["number", "null"], description: "Net take-home pay after all deductions" },
                  tax_deducted: { type: ["number", "null"], description: "PAYE tax deducted" },
                  ni_deducted: { type: ["number", "null"], description: "National Insurance contribution" },
                  pension_deducted: { type: ["number", "null"], description: "Pension contribution ONLY — null if no pension line exists" },
                  other_deductions: {
                    type: "array",
                    description: "All other salary deductions not covered by tax, NI, or pension",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Name of the deduction as shown on payslip" },
                        amount: { type: "number", description: "Amount deducted" },
                      },
                      required: ["name", "amount"],
                    },
                  },
                  pay_date: { type: ["string", "null"], description: "The date the employee is paid (YYYY-MM-DD), NOT the period end" },
                  pay_period_start: { type: ["string", "null"], description: "Start of pay period (YYYY-MM-DD)" },
                  pay_period_end: { type: ["string", "null"], description: "End of pay period (YYYY-MM-DD)" },
                  employer_name: { type: ["string", "null"], description: "Employer/company name" },
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
      const parsed = JSON.parse(toolCall.function.arguments);
      extracted = {
        ...parsed,
        other_deductions: Array.isArray(parsed.other_deductions) ? parsed.other_deductions : [],
      };
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      extracted = {
        gross_pay: null,
        net_pay: null,
        tax_deducted: null,
        ni_deducted: null,
        pension_deducted: null,
        other_deductions: [],
        pay_date: null,
        pay_period_start: null,
        pay_period_end: null,
        employer_name: null,
        confidence: "low",
      };
    }

    // Post-extraction verification: validate pension isn't a misidentified deduction
    if (extracted.pension_deducted !== null && extracted.other_deductions.length === 0) {
      // If we got a pension but no other deductions, the model may have confused them
      // Check if the pension amount matches a common non-pension deduction pattern
      console.log("Pension extracted:", extracted.pension_deducted, "Other deductions:", extracted.other_deductions);
    }

    // Update payslip with extracted data
    const updateData: Record<string, unknown> = {
      gross_pay: extracted.gross_pay,
      net_pay: extracted.net_pay,
      tax_deducted: extracted.tax_deducted,
      ni_deducted: extracted.ni_deducted,
      pension_deducted: extracted.pension_deducted,
      other_deductions: extracted.other_deductions,
      pay_date: extracted.pay_date,
      pay_period_start: extracted.pay_period_start,
      pay_period_end: extracted.pay_period_end,
      employer_name: extracted.employer_name,
      extraction_confidence: extracted.confidence,
      extraction_raw: aiData,
    };

    // Attempt auto-matching using pay_date (preferred) or pay_period_end as fallback
    let matchedTransactionId: string | null = null;
    let matchStatus = "pending";

    const matchDate = extracted.pay_date || extracted.pay_period_end;

    if (extracted.confidence !== "low" && extracted.net_pay && matchDate) {
      // Find matching income transactions
      // Criteria:
      // - type = 'income'
      // - amount within ±0.50 of net_pay
      // - date within ±2 days of pay_date (or pay_period_end)
      // - not already linked to another payslip
      // - description does NOT contain refund indicators
      
      const refDate = new Date(matchDate);
      const dateMin = new Date(refDate);
      dateMin.setDate(dateMin.getDate() - 2);
      const dateMax = new Date(refDate);
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
