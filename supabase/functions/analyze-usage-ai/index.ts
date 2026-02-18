import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const readingSchema = z.object({
  reading_date: z.string(),
  consumption_kwh: z.number().min(0).max(10000).optional(),
  fuel_type: z.string().max(50).optional(),
});

const tariffSchema = z.object({
  provider: z.string().max(200),
  tariff_name: z.string().max(200),
  unit_rate_kwh: z.number().min(0).max(1000),
  standing_charge_daily: z.number().min(0).max(1000).optional(),
  is_fixed: z.boolean().optional(),
});

const inputSchema = z.object({
  question: z.string().max(2000).optional(),
  readings: z.array(readingSchema).max(1000).optional(),
  tariff: tariffSchema.optional(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// Stable recommendation keys for feedback tracking
const RECOMMENDATION_KEYS = {
  eco_dishwasher: 'eco_dishwasher',
  eco_washer: 'eco_washer',
  low_temp_washing: 'low_temp_washing',
  reduce_tumble_dryer: 'reduce_tumble_dryer',
  batch_cooking: 'batch_cooking',
  airfryer_microwave: 'airfryer_microwave',
  reduce_shower_time: 'reduce_shower_time',
  lower_thermostat: 'lower_thermostat',
  smart_thermostat: 'smart_thermostat',
  standby_loads: 'standby_loads',
  led_bulbs: 'led_bulbs',
  time_of_use: 'time_of_use',
  economy7: 'economy7',
  off_peak_appliances: 'off_peak_appliances',
  draught_proofing: 'draught_proofing',
  hot_water_timer: 'hot_water_timer',
  solar_panels: 'solar_panels',
  switch_tariff: 'switch_tariff',
};

interface EnergyProfile {
  eco_mode_dishwasher?: boolean;
  eco_mode_washer?: boolean;
  low_temp_washing?: boolean;
  tumble_dryer_rare?: boolean;
  dishwasher_runs_per_week?: number;
  washer_runs_per_week?: number;
  dryer_runs_per_week?: number;
  heating_type?: string;
  thermostat_temp_c?: number;
  smart_thermostat?: boolean;
  shower_minutes_avg?: number;
  home_type?: string;
  occupants?: number;
  work_from_home_days?: number;
  smart_meter?: boolean;
  has_ev?: boolean;
  has_solar?: boolean;
  tariff_type?: string;
  peak_time_avoidance?: boolean;
  notes?: string;
}

interface RecommendationFeedback {
  recommendation_key: string;
  status: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(JSON.stringify({ error: 'AI backend is not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify JWT
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await req.json();
    const parseResult = inputSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parseResult.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { question, readings, tariff } = parseResult.data;

    // Fetch user's energy profile
    const { data: profile } = await supabase
      .from('energy_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // Fetch user's recommendation feedback (things they already do or dismissed)
    const { data: feedbackRows } = await supabase
      .from('energy_recommendation_feedback')
      .select('recommendation_key, status')
      .eq('user_id', user.id);

    const feedback: RecommendationFeedback[] = feedbackRows || [];
    const alreadyDoing = feedback.filter(f => f.status === 'already_do').map(f => f.recommendation_key);
    const notRelevant = feedback.filter(f => f.status === 'not_relevant').map(f => f.recommendation_key);
    const dismissed = feedback.filter(f => f.status === 'dismissed').map(f => f.recommendation_key);

    // Fetch best energy deal if available
    const { data: bestDeal } = await supabase
      .from('comparison_results')
      .select('*')
      .eq('user_id', user.id)
      .eq('service_type', 'energy')
      .eq('is_best_offer', true)
      .order('scanned_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Build context from user's data
    let context = '';

    // Usage data analysis
    if (readings && readings.length > 0) {
      const totalKwh = readings.reduce((sum: number, r: any) => sum + (r.consumption_kwh || 0), 0);
      const avgDaily = totalKwh / readings.length;
      const maxReading = Math.max(...readings.map((r: any) => r.consumption_kwh || 0));
      const minReading = Math.min(...readings.map((r: any) => r.consumption_kwh || 0));

      context += `\n## Energy Usage Data (last ${readings.length} readings)\n`;
      context += `- Total consumption: ${totalKwh.toFixed(1)} kWh\n`;
      context += `- Average daily: ${avgDaily.toFixed(1)} kWh\n`;
      context += `- Peak day: ${maxReading.toFixed(1)} kWh\n`;
      context += `- Lowest day: ${minReading.toFixed(1)} kWh\n`;

      // Weekday vs weekend analysis
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
        
        if (weekendAvg > weekdayAvg * 1.2) {
          context += `- Pattern: Weekend usage is significantly higher (${((weekendAvg/weekdayAvg - 1) * 100).toFixed(0)}% more)\n`;
        } else if (weekdayAvg > weekendAvg * 1.2) {
          context += `- Pattern: Weekday usage is significantly higher (${((weekdayAvg/weekendAvg - 1) * 100).toFixed(0)}% more) - likely WFH\n`;
        }
      }

      // Trend analysis (compare first half vs second half of readings)
      if (readings.length >= 14) {
        const halfIndex = Math.floor(readings.length / 2);
        const sortedReadings = [...readings].sort((a: any, b: any) => 
          new Date(a.reading_date).getTime() - new Date(b.reading_date).getTime()
        );
        const firstHalf = sortedReadings.slice(0, halfIndex);
        const secondHalf = sortedReadings.slice(halfIndex);
        
        const firstHalfAvg = firstHalf.reduce((s: number, r: any) => s + r.consumption_kwh, 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((s: number, r: any) => s + r.consumption_kwh, 0) / secondHalf.length;
        
        const trendPct = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
        if (Math.abs(trendPct) > 10) {
          context += `- Trend: Usage ${trendPct > 0 ? 'increasing' : 'decreasing'} by ${Math.abs(trendPct).toFixed(0)}% recently\n`;
        }
      }

      // Identify spiky vs steady usage
      const stdDev = Math.sqrt(
        readings.reduce((sum: number, r: any) => sum + Math.pow(r.consumption_kwh - avgDaily, 2), 0) / readings.length
      );
      const coeffVariation = (stdDev / avgDaily) * 100;
      if (coeffVariation > 40) {
        context += `- Variability: Very spiky usage (high day-to-day variation)\n`;
      } else if (coeffVariation < 20) {
        context += `- Variability: Steady usage (low day-to-day variation)\n`;
      }

      // Top 3 highest usage days
      const sortedByUsage = [...readings].sort((a: any, b: any) => b.consumption_kwh - a.consumption_kwh);
      const top3 = sortedByUsage.slice(0, 3);
      context += `- Top 3 highest days: ${top3.map((r: any) => `${new Date(r.reading_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} (${r.consumption_kwh.toFixed(1)} kWh)`).join(', ')}\n`;
    }

    // Tariff info
    if (tariff) {
      context += `\n## Current Tariff\n`;
      context += `- Provider: ${tariff.provider}\n`;
      context += `- Plan: ${tariff.tariff_name}\n`;
      context += `- Unit rate: ${tariff.unit_rate_kwh}p/kWh\n`;
      context += `- Standing charge: ${tariff.standing_charge_daily}p/day\n`;
      context += `- Type: ${tariff.is_fixed ? 'Fixed' : 'Variable'}\n`;
    }

    // Energy profile (what the user has told us about their home/habits)
    if (profile) {
      context += `\n## User's Energy Profile\n`;
      if (profile.home_type) context += `- Home type: ${profile.home_type}\n`;
      if (profile.occupants) context += `- Occupants: ${profile.occupants}\n`;
      if (profile.work_from_home_days) context += `- Work from home: ${profile.work_from_home_days} days/week\n`;
      if (profile.heating_type) context += `- Heating: ${profile.heating_type}\n`;
      if (profile.thermostat_temp_c) context += `- Thermostat setting: ${profile.thermostat_temp_c}°C\n`;
      if (profile.smart_thermostat) context += `- Has smart thermostat: Yes\n`;
      if (profile.smart_meter) context += `- Has smart meter: Yes\n`;
      if (profile.has_ev) context += `- Has electric vehicle: Yes\n`;
      if (profile.has_solar) context += `- Has solar panels: Yes\n`;
      if (profile.tariff_type) context += `- Tariff type: ${profile.tariff_type}\n`;
      if (profile.shower_minutes_avg) context += `- Average shower time: ${profile.shower_minutes_avg} mins\n`;
      if (profile.dishwasher_runs_per_week) context += `- Dishwasher runs/week: ${profile.dishwasher_runs_per_week}\n`;
      if (profile.washer_runs_per_week) context += `- Washing machine runs/week: ${profile.washer_runs_per_week}\n`;
      if (profile.dryer_runs_per_week) context += `- Tumble dryer runs/week: ${profile.dryer_runs_per_week}\n`;
      if (profile.notes) context += `- Notes: ${profile.notes}\n`;
    }

    // Best switching deal
    if (bestDeal && bestDeal.monthly_cost) {
      const currentAnnual = tariff ? (tariff.unit_rate_kwh * 2900 / 100) + ((tariff.standing_charge_daily ?? 0) * 365 / 100) : null;
      const dealAnnual = bestDeal.annual_cost || bestDeal.monthly_cost * 12;
      const potentialSavings = currentAnnual ? currentAnnual - dealAnnual : null;
      
      context += `\n## Best Switching Deal Found\n`;
      context += `- Provider: ${bestDeal.provider}\n`;
      context += `- Plan: ${bestDeal.plan_name}\n`;
      context += `- Monthly cost: £${bestDeal.monthly_cost.toFixed(2)}\n`;
      if (potentialSavings && potentialSavings > 0) {
        context += `- Potential savings: ~£${potentialSavings.toFixed(0)}/year\n`;
      }
    }

    // Build exclusions list for the AI
    let exclusions = '';
    
    // From explicit feedback
    if (alreadyDoing.length > 0 || notRelevant.length > 0 || dismissed.length > 0) {
      exclusions += `\n## DO NOT recommend these (user has marked them):\n`;
      if (alreadyDoing.length > 0) {
        exclusions += `Already doing: ${alreadyDoing.join(', ')}\n`;
      }
      if (notRelevant.length > 0) {
        exclusions += `Not relevant: ${notRelevant.join(', ')}\n`;
      }
      if (dismissed.length > 0) {
        exclusions += `Dismissed: ${dismissed.join(', ')}\n`;
      }
    }

    // From profile - infer things they already do
    if (profile) {
      const inferred: string[] = [];
      if (profile.eco_mode_dishwasher) inferred.push('eco_dishwasher');
      if (profile.eco_mode_washer) inferred.push('eco_washer');
      if (profile.low_temp_washing) inferred.push('low_temp_washing');
      if (profile.tumble_dryer_rare) inferred.push('reduce_tumble_dryer');
      if (profile.smart_thermostat) inferred.push('smart_thermostat');
      if (profile.peak_time_avoidance) inferred.push('off_peak_appliances');
      if (profile.has_solar) inferred.push('solar_panels');
      
      if (inferred.length > 0) {
        exclusions += `\nAlready doing (from profile): ${inferred.join(', ')}\n`;
      }
    }

    const systemPrompt = `You are a helpful UK energy and bills assistant. You analyze the user's consumption data and provide practical, personalized insights.

${context}
${exclusions}

## Rules:
1. Be concise and actionable (2-3 sentences max per recommendation unless asked for detail)
2. Focus on low-effort savings tips first, then medium-effort
3. Use UK terminology (kWh, p/kWh, standing charge, Economy 7, etc.)
4. If you notice patterns, explain them simply
5. Don't recommend major lifestyle changes or expensive purchases unless asked
6. Ask questions only when missing critical info for your answer
7. Always explain costs in pounds and pence
8. Be encouraging, not preachy
9. NEVER recommend anything listed in the "DO NOT recommend" section or "Already doing" sections
10. Instead of repeating excluded tips, suggest the NEXT BEST alternative
11. If relevant, mention switching tariff if there's a good deal available
12. Each recommendation should briefly explain WHY it applies to this user specifically (based on their profile/usage)

## Recommendation format (when giving tips):
For each tip, include:
- The tip itself
- Why it applies to them (based on their data/profile)
- Rough estimated savings (e.g., "could save £20-40/year")
- Effort level: Low/Medium/High

## Available recommendation keys (for consistent tracking):
${Object.keys(RECOMMENDATION_KEYS).join(', ')}
`;

    const userMessage = question || "Analyze my energy usage and give me your top personalized insight.";

    // Call Lovable AI Gateway (server-to-server)
    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);

      let clientMessage = 'AI request failed. Please try again.';
      if (aiResponse.status === 429) clientMessage = 'AI is rate-limited right now—please try again in a minute.';
      if (aiResponse.status === 402) clientMessage = 'AI credits are exhausted—please add credits to continue.';
      if (aiResponse.status === 401) clientMessage = 'AI backend authentication failed.';

      return new Response(JSON.stringify({ error: clientMessage }), {
        status: aiResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
          hasProfile: !!profile,
          excludedTips: [...alreadyDoing, ...notRelevant, ...dismissed],
          hasBestDeal: !!bestDeal,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Analyze usage AI error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
