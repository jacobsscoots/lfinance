import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type NotificationType = "contract_reminder" | "savings_alert" | "usage_summary";

interface NotificationRequest {
  type: NotificationType;
  userId?: string;
  email?: string;
  data?: {
    serviceName?: string;
    provider?: string;
    daysUntilEnd?: number;
    contractEndDate?: string;
    savings?: number;
    currentCost?: number;
    bestDealProvider?: string;
    bestDealCost?: number;
    period?: string;
    totalUsage?: number;
    totalCost?: number;
  };
}

function generateContractReminderHtml(data: NotificationRequest["data"]): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .highlight { background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0; }
        .cta { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
        .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">📅 Contract Ending Soon</h1>
        </div>
        <div class="content">
          <h2>Your ${data?.provider || "service"} contract ends in ${data?.daysUntilEnd} days</h2>
          <div class="highlight">
            <strong>⚠️ Action Required</strong><br>
            Your ${data?.serviceName || "contract"} with ${data?.provider} ends on <strong>${data?.contractEndDate}</strong>.
            Now is a great time to compare deals and potentially save money.
          </div>
          <p>
            Don't let your contract roll onto a potentially more expensive tariff. 
            Check out the latest deals in the Cheaper Bills section of your app.
          </p>
          <a href="https://lfinance.lovable.app/cheaper-bills" class="cta">Compare Deals Now →</a>
        </div>
        <div class="footer">
          <p>You received this because you have email notifications enabled for Cheaper Bills.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateSavingsAlertHtml(data: NotificationRequest["data"]): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .savings-box { background: #d1fae5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
        .savings-amount { font-size: 36px; font-weight: bold; color: #059669; }
        .comparison { display: flex; justify-content: space-between; margin: 20px 0; }
        .current, .best { flex: 1; padding: 15px; border-radius: 8px; }
        .current { background: #fee2e2; }
        .best { background: #d1fae5; }
        .cta { display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
        .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">💰 Savings Opportunity Found!</h1>
        </div>
        <div class="content">
          <div class="savings-box">
            <p style="margin: 0 0 10px 0;">You could save</p>
            <div class="savings-amount">£${data?.savings?.toFixed(0) || 0}/year</div>
          </div>
          <div class="comparison">
            <div class="current">
              <strong>Current</strong><br>
              ${data?.provider}<br>
              £${data?.currentCost?.toFixed(0) || 0}/year
            </div>
            <div class="best">
              <strong>Best Deal</strong><br>
              ${data?.bestDealProvider}<br>
              £${data?.bestDealCost?.toFixed(0) || 0}/year
            </div>
          </div>
          <p>
            We've found a better deal that could save you money. 
            The savings meet your threshold, so it might be worth switching.
          </p>
          <a href="https://lfinance.lovable.app/cheaper-bills" class="cta">View Comparison →</a>
        </div>
        <div class="footer">
          <p>You received this because you have savings alerts enabled for Cheaper Bills.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateUsageSummaryHtml(data: NotificationRequest["data"]): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
        .stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat { text-align: center; padding: 20px; }
        .stat-value { font-size: 28px; font-weight: bold; color: #3b82f6; }
        .stat-label { color: #6b7280; font-size: 14px; }
        .cta { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
        .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">⚡ Your ${data?.period || "Weekly"} Usage Summary</h1>
        </div>
        <div class="content">
          <div class="stats">
            <div class="stat">
              <div class="stat-value">${data?.totalUsage?.toFixed(1) || 0}</div>
              <div class="stat-label">kWh Used</div>
            </div>
            <div class="stat">
              <div class="stat-value">£${data?.totalCost?.toFixed(2) || 0}</div>
              <div class="stat-label">Estimated Cost</div>
            </div>
          </div>
          <p>
            Here's your energy usage summary for ${data?.period || "this week"}. 
            Track your usage over time to identify patterns and save money.
          </p>
          <a href="https://lfinance.lovable.app/cheaper-bills" class="cta">View Details →</a>
        </div>
        <div class="footer">
          <p>You received this because you have usage summaries enabled for Cheaper Bills.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify auth if not a scheduled call
    const authHeader = req.headers.get("Authorization");
    let userId: string | undefined;

    if (authHeader) {
      const jwt = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
      if (!authError && user) {
        userId = user.id;
      }
    }

    const body: NotificationRequest = await req.json();
    const { type, email, data } = body;

    // Get email from request or user settings
    let recipientEmail = email;
    if (!recipientEmail && userId) {
      const { data: settings } = await supabase
        .from("cheaper_bills_settings")
        .select("notification_email")
        .eq("user_id", userId)
        .single();
      recipientEmail = settings?.notification_email;
    }

    // Fallback to auth user email
    if (!recipientEmail && userId) {
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);
      recipientEmail = user?.email;
    }

    if (!recipientEmail) {
      throw new Error("No email address available for notification");
    }

    let subject = "";
    let html = "";

    switch (type) {
      case "contract_reminder":
        subject = `📅 Your ${data?.provider || "service"} contract ends in ${data?.daysUntilEnd} days`;
        html = generateContractReminderHtml(data);
        break;
      case "savings_alert":
        subject = `💰 Save £${data?.savings?.toFixed(0) || 0}/year by switching your ${data?.serviceName || "energy"}`;
        html = generateSavingsAlertHtml(data);
        break;
      case "usage_summary":
        subject = `⚡ Your ${data?.period || "Weekly"} Energy Usage Summary`;
        html = generateUsageSummaryHtml(data);
        break;
      default:
        throw new Error(`Unknown notification type: ${type}`);
    }

    const emailResponse = await resend.emails.send({
      from: "Cheaper Bills <onboarding@resend.dev>",
      to: [recipientEmail],
      subject,
      html,
    });

    console.log("Notification email sent:", emailResponse);

    // Check for Resend errors
    if (emailResponse.error) {
      console.error("Resend error:", emailResponse.error);
      throw new Error(emailResponse.error.message || "Email provider error");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: emailResponse.data?.id,
        sentAt: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
