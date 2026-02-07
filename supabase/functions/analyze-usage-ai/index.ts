import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const AI_GATEWAY_URL = 'https://ai.lovable.dev/v1/chat/completions';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify JWT
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { question, readings, tariff } = await req.json();

    // Build context from user's data
    let context = '';

    if (readings && readings.length > 0) {
      const totalKwh = readings.reduce((sum: number, r: any) => sum + (r.consumption_kwh || 0), 0);
      const avgDaily = totalKwh / readings.length;
      const maxReading = Math.max(...readings.map((r: any) => r.consumption_kwh || 0));
      const minReading = Math.min(...readings.map((r: any) => r.consumption_kwh || 0));

      context += `\nEnergy Usage Data (last ${readings.length} readings):\n`;
      context += `- Total consumption: ${totalKwh.toFixed(1)} kWh\n`;
      context += `- Average daily: ${avgDaily.toFixed(1)} kWh\n`;
      context += `- Peak day: ${maxReading.toFixed(1)} kWh\n`;
      context += `- Lowest day: ${minReading.toFixed(1)} kWh\n`;

      // Identify patterns
      const weekdayReadings = readings.filter((r: any) => {
        const day = new Date(r.reading_date).getDay();
        return day >= 1 && day <= 5;
      });
      const weekendReadings = readings.filter((r: any) => {
        const day = new Date(r.reading_date).getDay();
        return day === 0 || day === 6;
      });

      if (weekdayReadings.length > 0 && weekendReadings.length > 0) {
        const weekdayAvg = weekdayReadings.reduce((s: number, r: any) => s + r.consumption_kwh, 0) / weekdayReadings.length;
        const weekendAvg = weekendReadings.reduce((s: number, r: any) => s + r.consumption_kwh, 0) / weekendReadings.length;
        context += `- Weekday average: ${weekdayAvg.toFixed(1)} kWh\n`;
        context += `- Weekend average: ${weekendAvg.toFixed(1)} kWh\n`;
      }
    }

    if (tariff) {
      context += `\nCurrent Tariff:\n`;
      context += `- Provider: ${tariff.provider}\n`;
      context += `- Plan: ${tariff.tariff_name}\n`;
      context += `- Unit rate: ${tariff.unit_rate_kwh}p/kWh\n`;
      context += `- Standing charge: ${tariff.standing_charge_daily}p/day\n`;
      context += `- Type: ${tariff.is_fixed ? 'Fixed' : 'Variable'}\n`;
    }

    const systemPrompt = `You are a helpful UK energy and bills assistant. Analyze the user's consumption data and provide practical insights.

Rules:
- Be concise and actionable (2-3 sentences max unless asked for detail)
- Focus on low-effort savings tips
- Use UK terminology (kWh, p/kWh, standing charge)
- If you notice patterns, explain them simply
- Don't recommend major lifestyle changes
- Ask questions only when missing critical info for your answer
- Always explain costs in pounds and pence
- Be encouraging, not preachy

${context}`;

    const userMessage = question || "Analyze my energy usage and give me your top insight.";

    // Call Lovable AI Gateway
    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', errorText);
      throw new Error('Failed to get AI response');
    }

    const aiData = await aiResponse.json();
    const response = aiData.choices?.[0]?.message?.content || 
      "I couldn't analyze your usage right now. Try adding more readings for better insights.";

    return new Response(
      JSON.stringify({
        success: true,
        response,
        context: {
          readingsCount: readings?.length || 0,
          hasTariff: !!tariff,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Analyze usage AI error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
