import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const AI_MODEL = 'google/gemini-3-flash-preview';

// ─── Schemas ───────────────────────────────────────────────

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

const foodItemSchema = z.object({
  id: z.string(),
  product_id: z.string(),
  name: z.string(),
  meal_type: z.string(),
  is_locked: z.boolean(),
  quantity_grams: z.number(),
  calories_per_100g: z.number(),
  protein_per_100g: z.number(),
  carbs_per_100g: z.number(),
  fat_per_100g: z.number(),
  food_type: z.string().optional(),
  min_portion_grams: z.number().optional(),
  max_portion_grams: z.number().optional(),
  product_type: z.string().optional(),
});

const targetsSchema = z.object({
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
});

const inputSchema = z.discriminatedUnion("feature", [
  z.object({
    feature: z.literal("cheaper_bills"),
    input: z.object({
      question: z.string().max(2000).optional(),
      readings: z.array(readingSchema).max(1000).optional(),
      tariff: tariffSchema.optional(),
    }),
  }),
  z.object({
    feature: z.literal("meal_planner"),
    input: z.object({
      items: z.array(foodItemSchema),
      targets: targetsSchema,
    }),
  }),
]);

// ─── Recommendation keys ──────────────────────────────────

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

// ─── Lovable AI Gateway helper ────────────────────────────

async function callAI(opts: {
  system: string;
  userMessage: string;
  tools?: any[];
  toolChoice?: any;
}): Promise<any> {
  const body: any = {
    model: AI_MODEL,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.userMessage },
    ],
  };
  if (opts.tools) body.tools = opts.tools;
  if (opts.toolChoice) body.tool_choice = opts.toolChoice;

  const response = await fetch(AI_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`AI Gateway error: ${response.status}`, errorText);
    throw { status: response.status, message: errorText };
  }

  return response.json();
}

// ─── Cheaper Bills handler ──────────────────────────────

async function handleCheaperBills(
  supabase: any,
  userId: string,
  input: { question?: string; readings?: any[]; tariff?: any }
) {
  const { question, readings, tariff } = input;

  // Fetch user's energy profile
  const { data: profile } = await supabase
    .from('energy_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // Fetch feedback
  const { data: feedbackRows } = await supabase
    .from('energy_recommendation_feedback')
    .select('recommendation_key, status')
    .eq('user_id', userId);

  const feedback = feedbackRows || [];
  const alreadyDoing = feedback.filter((f: any) => f.status === 'already_do').map((f: any) => f.recommendation_key);
  const notRelevant = feedback.filter((f: any) => f.status === 'not_relevant').map((f: any) => f.recommendation_key);
  const dismissed = feedback.filter((f: any) => f.status === 'dismissed').map((f: any) => f.recommendation_key);

  // Best deal
  const { data: bestDeal } = await supabase
    .from('comparison_results')
    .select('*')
    .eq('user_id', userId)
    .eq('service_type', 'energy')
    .eq('is_best_offer', true)
    .order('scanned_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Build context
  let context = '';

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
        context += `- Pattern: Weekend usage is significantly higher (${((weekendAvg / weekdayAvg - 1) * 100).toFixed(0)}% more)\n`;
      } else if (weekdayAvg > weekendAvg * 1.2) {
        context += `- Pattern: Weekday usage is significantly higher (${((weekdayAvg / weekendAvg - 1) * 100).toFixed(0)}% more) - likely WFH\n`;
      }
    }

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

    const stdDev = Math.sqrt(
      readings.reduce((sum: number, r: any) => sum + Math.pow(r.consumption_kwh - avgDaily, 2), 0) / readings.length
    );
    const coeffVariation = (stdDev / avgDaily) * 100;
    if (coeffVariation > 40) context += `- Variability: Very spiky usage\n`;
    else if (coeffVariation < 20) context += `- Variability: Steady usage\n`;

    const sortedByUsage = [...readings].sort((a: any, b: any) => b.consumption_kwh - a.consumption_kwh);
    const top3 = sortedByUsage.slice(0, 3);
    context += `- Top 3 highest days: ${top3.map((r: any) => `${new Date(r.reading_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} (${r.consumption_kwh.toFixed(1)} kWh)`).join(', ')}\n`;
  }

  if (tariff) {
    context += `\n## Current Tariff\n`;
    context += `- Provider: ${tariff.provider}\n`;
    context += `- Plan: ${tariff.tariff_name}\n`;
    context += `- Unit rate: ${tariff.unit_rate_kwh}p/kWh\n`;
    context += `- Standing charge: ${tariff.standing_charge_daily}p/day\n`;
    context += `- Type: ${tariff.is_fixed ? 'Fixed' : 'Variable'}\n`;
  }

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

  if (bestDeal && bestDeal.monthly_cost) {
    const currentAnnual = tariff ? (tariff.unit_rate_kwh * 2900 / 100) + (tariff.standing_charge_daily * 365 / 100) : null;
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

  let exclusions = '';
  if (alreadyDoing.length > 0 || notRelevant.length > 0 || dismissed.length > 0) {
    exclusions += `\n## DO NOT recommend these (user has marked them):\n`;
    if (alreadyDoing.length > 0) exclusions += `Already doing: ${alreadyDoing.join(', ')}\n`;
    if (notRelevant.length > 0) exclusions += `Not relevant: ${notRelevant.join(', ')}\n`;
    if (dismissed.length > 0) exclusions += `Dismissed: ${dismissed.join(', ')}\n`;
  }

  if (profile) {
    const inferred: string[] = [];
    if (profile.eco_mode_dishwasher) inferred.push('eco_dishwasher');
    if (profile.eco_mode_washer) inferred.push('eco_washer');
    if (profile.low_temp_washing) inferred.push('low_temp_washing');
    if (profile.tumble_dryer_rare) inferred.push('reduce_tumble_dryer');
    if (profile.smart_thermostat) inferred.push('smart_thermostat');
    if (profile.peak_time_avoidance) inferred.push('off_peak_appliances');
    if (profile.has_solar) inferred.push('solar_panels');
    if (inferred.length > 0) exclusions += `\nAlready doing (from profile): ${inferred.join(', ')}\n`;
  }

  const systemPrompt = `You are a helpful UK energy and bills assistant. You analyze the user's consumption data and provide practical, personalized insights.\n\n${context}\n${exclusions}\n\n## Rules:\n1. Be concise and actionable (2-3 sentences max per recommendation unless asked for detail)\n2. Focus on low-effort savings tips first, then medium-effort\n3. Use UK terminology (kWh, p/kWh, standing charge, Economy 7, etc.)\n4. If you notice patterns, explain them simply\n5. Don't recommend major lifestyle changes or expensive purchases unless asked\n6. Ask questions only when missing critical info for your answer\n7. Always explain costs in pounds and pence\n8. Be encouraging, not preachy\n9. NEVER recommend anything listed in the "DO NOT recommend" section or "Already doing" sections\n10. Instead of repeating excluded tips, suggest the NEXT BEST alternative\n11. If relevant, mention switching tariff if there's a good deal available\n12. Each recommendation should briefly explain WHY it applies to this user specifically (based on their profile/usage)\n\n## Recommendation format (when giving tips):\nFor each tip, include:\n- The tip itself\n- Why it applies to them (based on their data/profile)\n- Rough estimated savings (e.g., "could save £20-40/year")\n- Effort level: Low/Medium/High\n\n## Available recommendation keys (for consistent tracking):\n${Object.keys(RECOMMENDATION_KEYS).join(', ')}\n`;

  const userMessage = question || "Analyze my energy usage and give me your top personalized insight.";

  const aiData = await callAI({
    system: systemPrompt,
    userMessage,
  });

  console.log(`[claude-ai] provider=lovable-ai feature=cheaper_bills model=${AI_MODEL} usage=${JSON.stringify(aiData.usage || {})}`);

  const response = aiData.choices?.[0]?.message?.content ||
    "I couldn't analyze your usage right now. Try adding more readings for better insights.";

  return {
    success: true,
    response,
    context: {
      readingsCount: readings?.length || 0,
      hasTariff: !!tariff,
      hasProfile: !!profile,
      excludedTips: [...alreadyDoing, ...notRelevant, ...dismissed],
      hasBestDeal: !!bestDeal,
    },
  };
}

// ─── Meal Planner handler ───────────────────────────────

async function handleMealPlanner(
  input: { items: any[]; targets: any }
) {
  const { items, targets } = input;

  // Detect seasonings
  const SEASONING_NAME_PATTERNS = [
    'seasoning', 'rub', 'spice', 'powder', 'paprika', 'cajun',
    'herbs', 'pepper', 'schwartz', 'oregano', 'cumin', 'chili',
    'coriander', 'turmeric', 'garam masala', 'curry powder',
    'sauce', 'dressing', 'mayo', 'ketchup', 'mustard',
    'soy sauce', 'teriyaki', 'sriracha', 'hot sauce', 'bbq sauce',
    'bbq rub', 'marinade', 'vinegar', 'glaze',
    'olive oil', 'coconut oil', 'vegetable oil', 'rapeseed oil',
    'sesame oil', 'cooking oil', 'sunflower oil',
  ];

  function isSeasoningItem(item: any): boolean {
    if (item.food_type === 'seasoning' || item.food_type === 'sauce') return true;
    const name = (item.name || '').toLowerCase();
    return SEASONING_NAME_PATTERNS.some(p => name.includes(p));
  }

  const lockedItems = items.filter((i: any) => i.is_locked || i.product_type === 'fixed');
  const freeItems = items.filter((i: any) => !i.is_locked && i.product_type !== 'fixed');

  // Classify free items
  interface FreeFood {
    id: string;
    name: string;
    isSeasoning: boolean;
    softMinG: number; // product-level min (if included, use at least this)
    minG: number;     // solver hard floor (0 for optional items)
    maxG: number;
    calPer1g: number;
    pPer1g: number;
    cPer1g: number;
    fPer1g: number;
  }

  const freeFoods: FreeFood[] = freeItems.map((item: any) => {
    const isSeas = isSeasoningItem(item);
    // CRITICAL: Non-locked, non-seasoning items are OPTIONAL (minG = 0).
    // The solver can choose to exclude them entirely (set to 0g).
    // min_portion_grams from the product is only a "soft" minimum —
    // it means "if you include this food, use at least Xg" but the solver
    // can decide not to include it at all.
    // Seasonings are the exception: they are always 5–15g when present.
    const softMin = item.min_portion_grams || 0;
    return {
      id: item.id,
      name: item.name,
      isSeasoning: isSeas,
      softMinG: isSeas ? 5 : Math.max(softMin, 0), // product-level min (for logging/suggestions)
      minG: isSeas ? 5 : 0, // solver hard floor: 0 = optional
      maxG: isSeas ? 15 : Math.max(item.max_portion_grams || 500, 1),
      calPer1g: (item.calories_per_100g || 0) / 100,
      pPer1g: (item.protein_per_100g || 0) / 100,
      cPer1g: (item.carbs_per_100g || 0) / 100,
      fPer1g: (item.fat_per_100g || 0) / 100,
    };
  });

  // Calculate locked macros
  const lockedMacros = lockedItems.reduce(
    (acc: any, item: any) => {
      const factor = item.quantity_grams / 100;
      return {
        calories: acc.calories + item.calories_per_100g * factor,
        protein: acc.protein + item.protein_per_100g * factor,
        carbs: acc.carbs + item.carbs_per_100g * factor,
        fat: acc.fat + item.fat_per_100g * factor,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const fullCalTarget = Math.round(targets.calories);
  const fullPTarget = Math.round(targets.protein);
  const fullCTarget = Math.round(targets.carbs);
  const fullFTarget = Math.round(targets.fat);

  // ─── FEASIBILITY PRE-CHECK ─────────────────────────────
  // Compute theoretical min/max achievable for each macro
  const theoreticalMin = { calories: lockedMacros.calories, protein: lockedMacros.protein, carbs: lockedMacros.carbs, fat: lockedMacros.fat };
  const theoreticalMax = { calories: lockedMacros.calories, protein: lockedMacros.protein, carbs: lockedMacros.carbs, fat: lockedMacros.fat };

  for (const food of freeFoods) {
    theoreticalMin.calories += food.calPer1g * food.minG;
    theoreticalMin.protein += food.pPer1g * food.minG;
    theoreticalMin.carbs += food.cPer1g * food.minG;
    theoreticalMin.fat += food.fPer1g * food.minG;
    theoreticalMax.calories += food.calPer1g * food.maxG;
    theoreticalMax.protein += food.pPer1g * food.maxG;
    theoreticalMax.carbs += food.cPer1g * food.maxG;
    theoreticalMax.fat += food.fPer1g * food.maxG;
  }

  console.log(`[solver] FEASIBILITY: targets cal=${fullCalTarget} p=${fullPTarget} c=${fullCTarget} f=${fullFTarget}`);
  console.log(`[solver] locked: cal=${Math.round(lockedMacros.calories)} p=${Math.round(lockedMacros.protein)} c=${Math.round(lockedMacros.carbs)} f=${Math.round(lockedMacros.fat)}`);
  console.log(`[solver] theoretical_min (optional mode, minG=0): cal=${Math.round(theoreticalMin.calories)} p=${Math.round(theoreticalMin.protein)} c=${Math.round(theoreticalMin.carbs)} f=${Math.round(theoreticalMin.fat)}`);
  console.log(`[solver] theoretical_max: cal=${Math.round(theoreticalMax.calories)} p=${Math.round(theoreticalMax.protein)} c=${Math.round(theoreticalMax.carbs)} f=${Math.round(theoreticalMax.fat)}`);
  
  // Also compute forced-min mode for comparison logging
  const forcedMin = { calories: lockedMacros.calories, protein: lockedMacros.protein, carbs: lockedMacros.carbs, fat: lockedMacros.fat };
  for (const food of freeFoods) {
    forcedMin.calories += food.calPer1g * food.softMinG;
    forcedMin.protein += food.pPer1g * food.softMinG;
    forcedMin.carbs += food.cPer1g * food.softMinG;
    forcedMin.fat += food.fPer1g * food.softMinG;
  }
  console.log(`[solver] forced_min (if all softMins applied): cal=${Math.round(forcedMin.calories)} p=${Math.round(forcedMin.protein)} c=${Math.round(forcedMin.carbs)} f=${Math.round(forcedMin.fat)}`);
  if (forcedMin.fat > fullFTarget) {
    console.log(`[solver] NOTE: Forced mins would exceed fat target (${Math.round(forcedMin.fat)}g > ${fullFTarget}g). Optional mode fixes this.`);
  }
  
  for (const food of freeFoods) {
    console.log(`[solver] food: ${food.name} | minG=0 softMin=${food.softMinG}g max=${food.maxG}g | cal/g=${food.calPer1g.toFixed(2)} p/g=${food.pPer1g.toFixed(2)} c/g=${food.cPer1g.toFixed(2)} f/g=${food.fPer1g.toFixed(2)} | seasoning=${food.isSeasoning}`);
  }

  // Check hard infeasibility: if theoretical max can't reach target - tolerance
  const infeasible: string[] = [];
  if (theoreticalMax.calories < fullCalTarget - 50) infeasible.push(`kcal: max achievable ${Math.round(theoreticalMax.calories)} < min required ${fullCalTarget - 50}`);
  if (theoreticalMax.protein < fullPTarget - 2) infeasible.push(`protein: max achievable ${theoreticalMax.protein.toFixed(1)}g < min required ${fullPTarget - 2}g`);
  if (theoreticalMax.carbs < fullCTarget - 2) infeasible.push(`carbs: max achievable ${theoreticalMax.carbs.toFixed(1)}g < min required ${fullCTarget - 2}g`);
  if (theoreticalMax.fat < fullFTarget - 2) infeasible.push(`fat: max achievable ${theoreticalMax.fat.toFixed(1)}g < min required ${fullFTarget - 2}g`);
  // Also check if min exceeds target
  if (theoreticalMin.calories > fullCalTarget) infeasible.push(`kcal: min achievable ${Math.round(theoreticalMin.calories)} > target ${fullCalTarget}`);
  if (theoreticalMin.protein > fullPTarget) infeasible.push(`protein: min achievable ${theoreticalMin.protein.toFixed(1)}g > target ${fullPTarget}g`);
  if (theoreticalMin.carbs > fullCTarget) infeasible.push(`carbs: min achievable ${theoreticalMin.carbs.toFixed(1)}g > target ${fullCTarget}g`);
  if (theoreticalMin.fat > fullFTarget) infeasible.push(`fat: min achievable ${theoreticalMin.fat.toFixed(1)}g > target ${fullFTarget}g`);

  if (infeasible.length > 0) {
    console.warn(`[solver] INFEASIBLE: ${infeasible.join('; ')}`);
    
    // Generate per-food breakdown for suggestions
    const suggested_fixes: string[] = [];
    for (const reason of infeasible) {
      if (reason.includes('carbs: max achievable')) {
        const carbFoods = freeFoods.filter(f => f.cPer1g > 0.3 && !f.isSeasoning).sort((a, b) => b.cPer1g - a.cPer1g);
        if (carbFoods.length > 0) {
          const top = carbFoods[0];
          suggested_fixes.push(`${top.name} provides ${(top.cPer1g * 100).toFixed(0)}g carbs/100g but is capped at ${top.maxG}g (max ${(top.cPer1g * top.maxG).toFixed(0)}g carbs). Increase max_portion_grams or add another carb source.`);
        } else {
          suggested_fixes.push('No carb-dense food available. Add rice, pasta, bread, oats, or cereal.');
        }
      }
      if (reason.includes('protein: max achievable')) {
        const protFoods = freeFoods.filter(f => f.pPer1g > 0.15 && !f.isSeasoning).sort((a, b) => b.pPer1g - a.pPer1g);
        if (protFoods.length > 0) {
          const top = protFoods[0];
          suggested_fixes.push(`${top.name} provides ${(top.pPer1g * 100).toFixed(0)}g protein/100g but is capped at ${top.maxG}g (max ${(top.pPer1g * top.maxG).toFixed(0)}g protein). Increase max_portion_grams.`);
        } else {
          suggested_fixes.push('No protein-dense food available. Add chicken breast, turkey, white fish.');
        }
      }
      if (reason.includes('kcal: max achievable')) {
        suggested_fixes.push(`Total calorie capacity is too low. Increase portion limits on calorie-dense foods or add more items.`);
      }
      if (reason.includes('fat: max achievable')) {
        suggested_fixes.push('Not enough fat capacity. Add a fat source (oil, nuts, cheese) or increase limits.');
      }
      if (reason.includes('min achievable') && reason.includes('>')) {
        suggested_fixes.push('Minimum portions already exceed target. Reduce min_portion_grams on some items or remove items.');
      }
    }

    return {
      success: false,
      status: 'FAIL_CONSTRAINTS',
      portions: [],
      totals: { calories: Math.round(theoreticalMax.calories), protein: Math.round(theoreticalMax.protein), carbs: Math.round(theoreticalMax.carbs), fat: Math.round(theoreticalMax.fat) },
      targets: { calories: fullCalTarget, protein: fullPTarget, carbs: fullCTarget, fat: fullFTarget },
      violations: infeasible,
      suggested_fixes,
      feasibility: {
        theoretical_min: theoreticalMin,
        theoretical_max: theoreticalMax,
        foods: freeFoods.map(f => ({ name: f.name, minG: f.minG, maxG: f.maxG, calPer1g: f.calPer1g, pPer1g: f.pPer1g, cPer1g: f.cPer1g, fPer1g: f.fPer1g })),
      },
    };
  }

  // ─── DETERMINISTIC SOLVER (coordinate descent, 1g resolution) ──────
  // This replaces both the AI call and the old greedy refinePortions.
  // We still use the AI for initial guess, then the solver fixes it.

  // Compute totals from a grams map
  function computeTotals(grams: Map<string, number>) {
    let cal = lockedMacros.calories, p = lockedMacros.protein, c = lockedMacros.carbs, f = lockedMacros.fat;
    for (const food of freeFoods) {
      const g = grams.get(food.id) || 0;
      cal += food.calPer1g * g;
      p += food.pPer1g * g;
      c += food.cPer1g * g;
      f += food.fPer1g * g;
    }
    return { calories: cal, protein: p, carbs: c, fat: f };
  }

  // Check if totals meet all constraints
  function meetsAll(totals: { calories: number; protein: number; carbs: number; fat: number }) {
    return (
      totals.calories >= fullCalTarget - 50 && totals.calories <= fullCalTarget &&
      totals.protein >= fullPTarget - 2 && totals.protein <= fullPTarget &&
      totals.carbs >= fullCTarget - 2 && totals.carbs <= fullCTarget &&
      totals.fat >= fullFTarget - 2 && totals.fat <= fullFTarget
    );
  }

  // Weighted error: how far from target bands. 0 = perfect.
  function computeError(totals: { calories: number; protein: number; carbs: number; fat: number }): number {
    let err = 0;
    // Calories: band is [fullCalTarget - 50, fullCalTarget]
    if (totals.calories > fullCalTarget) err += (totals.calories - fullCalTarget) * 2; // over penalty
    else if (totals.calories < fullCalTarget - 50) err += (fullCalTarget - 50 - totals.calories);
    // Protein
    if (totals.protein > fullPTarget) err += (totals.protein - fullPTarget) * 50;
    else if (totals.protein < fullPTarget - 2) err += (fullPTarget - 2 - totals.protein) * 50;
    // Carbs
    if (totals.carbs > fullCTarget) err += (totals.carbs - fullCTarget) * 50;
    else if (totals.carbs < fullCTarget - 2) err += (fullCTarget - 2 - totals.carbs) * 50;
    // Fat
    if (totals.fat > fullFTarget) err += (totals.fat - fullFTarget) * 50;
    else if (totals.fat < fullFTarget - 2) err += (fullFTarget - 2 - totals.fat) * 50;
    return err;
  }

  // ─── SOLVER: Multi-start coordinate descent ───────────
  // Try multiple starting points and pick the best result.

  function solveFromStart(startGrams: Map<string, number>): { grams: Map<string, number>; totals: any; error: number; iterations: number } {
    const grams = new Map(startGrams);
    const nonSeasoningFoods = freeFoods.filter(f => !f.isSeasoning);
    let bestError = Infinity;
    let bestGrams = new Map(grams);
    let bestTotals = computeTotals(grams);
    let staleCount = 0;

    for (let iter = 0; iter < 5000; iter++) {
      const totals = computeTotals(grams);
      const err = computeError(totals);

      if (err < bestError) {
        bestError = err;
        bestGrams = new Map(grams);
        bestTotals = { ...totals };
        staleCount = 0;
      } else {
        staleCount++;
      }

      if (meetsAll(totals)) {
        return { grams: new Map(grams), totals, error: 0, iterations: iter };
      }

      if (staleCount > 200) break; // stuck

      // Find which macros are violated and by how much
      const deficits = {
        calories: fullCalTarget - totals.calories, // positive = under, negative = over
        protein: fullPTarget - totals.protein,
        carbs: fullCTarget - totals.carbs,
        fat: fullFTarget - totals.fat,
      };

      // Pick the worst violation
      type MacroKey = 'calories' | 'protein' | 'carbs' | 'fat';
      const violations: Array<{ macro: MacroKey; needMore: boolean; amount: number }> = [];
      
      if (totals.calories > fullCalTarget) violations.push({ macro: 'calories', needMore: false, amount: totals.calories - fullCalTarget });
      else if (totals.calories < fullCalTarget - 50) violations.push({ macro: 'calories', needMore: true, amount: fullCalTarget - 50 - totals.calories });
      
      if (totals.protein > fullPTarget) violations.push({ macro: 'protein', needMore: false, amount: totals.protein - fullPTarget });
      else if (totals.protein < fullPTarget - 2) violations.push({ macro: 'protein', needMore: true, amount: fullPTarget - 2 - totals.protein });
      
      if (totals.carbs > fullCTarget) violations.push({ macro: 'carbs', needMore: false, amount: totals.carbs - fullCTarget });
      else if (totals.carbs < fullCTarget - 2) violations.push({ macro: 'carbs', needMore: true, amount: fullCTarget - 2 - totals.carbs });
      
      if (totals.fat > fullFTarget) violations.push({ macro: 'fat', needMore: false, amount: totals.fat - fullFTarget });
      else if (totals.fat < fullFTarget - 2) violations.push({ macro: 'fat', needMore: true, amount: fullFTarget - 2 - totals.fat });

      if (violations.length === 0) break; // all within band

      // Sort by severity
      violations.sort((a, b) => b.amount - a.amount);
      const worst = violations[0];

      // For each free non-seasoning food, compute: if we adjust it by ±1g, what's the new total error?
      let bestFoodIdx = -1;
      let bestDirection = 0;
      let bestStepError = Infinity;

      for (let fi = 0; fi < nonSeasoningFoods.length; fi++) {
        const food = nonSeasoningFoods[fi];
        const currentG = grams.get(food.id) || 0;

        // Try +1g
        if (currentG < food.maxG) {
          const testGrams = new Map(grams);
          testGrams.set(food.id, currentG + 1);
          const testTotals = computeTotals(testGrams);
          const testErr = computeError(testTotals);
          if (testErr < bestStepError) {
            bestStepError = testErr;
            bestFoodIdx = fi;
            bestDirection = 1;
          }
        }

        // Try -1g
        if (currentG > food.minG) {
          const testGrams = new Map(grams);
          testGrams.set(food.id, currentG - 1);
          const testTotals = computeTotals(testGrams);
          const testErr = computeError(testTotals);
          if (testErr < bestStepError) {
            bestStepError = testErr;
            bestFoodIdx = fi;
            bestDirection = -1;
          }
        }
      }

      if (bestFoodIdx === -1) break; // no moves possible

      // Apply the best 1g step
      const chosenFood = nonSeasoningFoods[bestFoodIdx];
      const currentG = grams.get(chosenFood.id) || 0;
      
      // Try larger steps if the error is big (acceleration)
      let stepSize = 1;
      if (worst.amount > 50) stepSize = Math.min(20, Math.floor(worst.amount / 5));
      else if (worst.amount > 10) stepSize = Math.min(5, Math.floor(worst.amount / 2));
      
      let newG = currentG + bestDirection * stepSize;
      newG = Math.max(chosenFood.minG, Math.min(chosenFood.maxG, newG));
      
      // Verify this larger step doesn't overshoot (make error worse than 1g step)
      const testGrams = new Map(grams);
      testGrams.set(chosenFood.id, newG);
      const testErr = computeError(computeTotals(testGrams));
      if (testErr <= bestStepError + 1) {
        grams.set(chosenFood.id, newG);
      } else {
        // Fall back to 1g step
        grams.set(chosenFood.id, currentG + bestDirection);
      }
    }

    return { grams: bestGrams, totals: bestTotals, error: bestError, iterations: 5000 };
  }

  // Generate multiple starting points
  function generateStarts(): Map<string, number>[] {
    const starts: Map<string, number>[] = [];

    // Start 1: midpoint
    const mid = new Map<string, number>();
    for (const food of freeFoods) {
      mid.set(food.id, food.isSeasoning ? Math.min(10, food.maxG) : Math.round((food.minG + food.maxG) / 2));
    }
    starts.push(mid);

    // Start 2: minimum portions
    const minStart = new Map<string, number>();
    for (const food of freeFoods) {
      minStart.set(food.id, food.minG);
    }
    starts.push(minStart);

    // Start 3: proportional to remaining targets
    const remaining = {
      calories: Math.max(0, fullCalTarget - lockedMacros.calories),
      protein: Math.max(0, fullPTarget - lockedMacros.protein),
      carbs: Math.max(0, fullCTarget - lockedMacros.carbs),
      fat: Math.max(0, fullFTarget - lockedMacros.fat),
    };
    const totalCalPerG = freeFoods.reduce((s, f) => s + (f.isSeasoning ? 0 : f.calPer1g), 0);
    const proportional = new Map<string, number>();
    for (const food of freeFoods) {
      if (food.isSeasoning) {
        proportional.set(food.id, Math.min(10, food.maxG));
      } else if (totalCalPerG > 0) {
        const share = food.calPer1g / totalCalPerG;
        const targetG = Math.round((remaining.calories / food.calPer1g) * share);
        proportional.set(food.id, Math.max(food.minG, Math.min(food.maxG, targetG)));
      } else {
        proportional.set(food.id, food.minG);
      }
    }
    starts.push(proportional);

    // Start 4: carb-heavy (max out highest carb food first)
    const carbHeavy = new Map<string, number>();
    const sortedByCarbs = [...freeFoods].sort((a, b) => b.cPer1g - a.cPer1g);
    for (const food of freeFoods) {
      carbHeavy.set(food.id, food.isSeasoning ? Math.min(10, food.maxG) : food.minG);
    }
    // Max out the top 2 carb foods
    for (let i = 0; i < Math.min(2, sortedByCarbs.length); i++) {
      if (!sortedByCarbs[i].isSeasoning) {
        carbHeavy.set(sortedByCarbs[i].id, sortedByCarbs[i].maxG);
      }
    }
    starts.push(carbHeavy);

    // Start 5: protein-heavy
    const protHeavy = new Map<string, number>();
    const sortedByProt = [...freeFoods].sort((a, b) => b.pPer1g - a.pPer1g);
    for (const food of freeFoods) {
      protHeavy.set(food.id, food.isSeasoning ? Math.min(10, food.maxG) : food.minG);
    }
    for (let i = 0; i < Math.min(2, sortedByProt.length); i++) {
      if (!sortedByProt[i].isSeasoning) {
        protHeavy.set(sortedByProt[i].id, sortedByProt[i].maxG);
      }
    }
    starts.push(protHeavy);

    return starts;
  }

  // Also get AI suggestion as a starting point
  const remainingTargets = {
    calories: Math.max(0, targets.calories - lockedMacros.calories),
    protein: Math.max(0, targets.protein - lockedMacros.protein),
    carbs: Math.max(0, targets.carbs - lockedMacros.carbs),
    fat: Math.max(0, targets.fat - lockedMacros.fat),
  };

  const calTarget = Math.round(remainingTargets.calories);
  const pTarget = Math.round(remainingTargets.protein);
  const cTarget = Math.round(remainingTargets.carbs);
  const fTarget = Math.round(remainingTargets.fat);

  const lockedList = lockedItems.length > 0
    ? lockedItems.map((item: any) => `- ${item.name}: ${item.quantity_grams}g (LOCKED)`).join('\n')
    : 'None';

  const foodList = freeFoods.map(f => {
    return `- ${f.name} (id: ${f.id}): ${(f.calPer1g * 100).toFixed(0)} kcal, ${(f.pPer1g * 100).toFixed(1)}g P, ${(f.cPer1g * 100).toFixed(1)}g C, ${(f.fPer1g * 100).toFixed(1)}g F per 100g. Min: ${f.minG}g, Max: ${f.maxG}g.${f.isSeasoning ? ' SEASONING 5-15g.' : ''}`;
  }).join('\n');

  const systemPrompt = `You are a meal portion calculator. Assign gram portions to foods to hit these REMAINING targets (after locked items):
- Calories: ${calTarget} kcal (±50)
- Protein: ${pTarget}g (±2)
- Carbs: ${cTarget}g (±2)
- Fat: ${fTarget}g (±2)

Locked items:
${lockedList}

Available foods:
${foodList}

CRITICAL: Use LARGE portions of carb-dense foods to hit carb targets. Use LARGE portions of protein-dense foods to hit protein targets. Don't default to small portions. Use set_portions tool.`;

  const tools = [
    {
      type: "function",
      function: {
        name: "set_portions",
        description: "Set gram portions for each food item",
        parameters: {
          type: "object",
          properties: {
            portions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  quantity_grams: { type: "number" },
                },
                required: ["id", "quantity_grams"],
              },
            },
          },
          required: ["portions"],
        },
      },
    },
  ];

  // Get AI initial guess
  let aiStartGrams = new Map<string, number>();
  try {
    const aiData = await callAI({
      system: systemPrompt,
      userMessage: "Assign portions to hit targets. Use set_portions tool. Use large portions where needed.",
      tools,
      toolChoice: { type: "function", function: { name: "set_portions" } },
    });

    console.log(`[solver] AI guess: model=${AI_MODEL} usage=${JSON.stringify(aiData.usage || {})}`);

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      if (parsed.portions && Array.isArray(parsed.portions)) {
        for (const p of parsed.portions) {
          const food = freeFoods.find(f => f.id === p.id);
          if (food) {
            let g = Math.round(p.quantity_grams);
            g = Math.max(food.minG, Math.min(food.maxG, g));
            aiStartGrams.set(food.id, g);
          }
        }
      }
    }
  } catch (e) {
    console.warn('[solver] AI call failed, using deterministic starts only:', e);
  }

  // Fill in any foods missing from AI guess
  for (const food of freeFoods) {
    if (!aiStartGrams.has(food.id)) {
      aiStartGrams.set(food.id, food.isSeasoning ? Math.min(10, food.maxG) : food.minG);
    }
  }

  // Run solver from multiple starting points
  const starts = generateStarts();
  starts.push(aiStartGrams); // Add AI guess as another starting point

  let bestResult = { grams: new Map<string, number>(), totals: { calories: 0, protein: 0, carbs: 0, fat: 0 }, error: Infinity, iterations: 0 };

  for (let si = 0; si < starts.length; si++) {
    const result = solveFromStart(starts[si]);
    console.log(`[solver] start ${si}: error=${result.error.toFixed(1)} iters=${result.iterations} totals=${JSON.stringify({ cal: Math.round(result.totals.calories), p: Math.round(result.totals.protein * 10) / 10, c: Math.round(result.totals.carbs * 10) / 10, f: Math.round(result.totals.fat * 10) / 10 })}`);
    if (result.error < bestResult.error) {
      bestResult = result;
    }
    if (result.error === 0) break; // perfect solution found
  }

  // Round to nearest 5g and re-check; if rounding breaks it, try 1g rounding
  function roundAndCheck(grams: Map<string, number>, roundTo: number): { grams: Map<string, number>; totals: any; ok: boolean } {
    const rounded = new Map<string, number>();
    for (const food of freeFoods) {
      const g = grams.get(food.id) || food.minG;
      if (food.isSeasoning) {
        rounded.set(food.id, Math.max(food.minG, Math.min(food.maxG, Math.round(g / roundTo) * roundTo)));
      } else {
        rounded.set(food.id, Math.max(food.minG, Math.min(food.maxG, Math.round(g / roundTo) * roundTo)));
      }
    }
    const totals = computeTotals(rounded);
    return { grams: rounded, totals, ok: meetsAll(totals) };
  }

  // Try 5g rounding first
  let finalResult = roundAndCheck(bestResult.grams, 5);
  if (!finalResult.ok) {
    // Try solving again from the 5g-rounded start
    const reResult = solveFromStart(finalResult.grams);
    finalResult = roundAndCheck(reResult.grams, 5);
  }
  if (!finalResult.ok) {
    // Fall back to 1g rounding
    finalResult = roundAndCheck(bestResult.grams, 1);
    if (!finalResult.ok) {
      // One more solve pass from 1g-rounded
      const reResult2 = solveFromStart(finalResult.grams);
      const t = computeTotals(reResult2.grams);
      finalResult = { grams: reResult2.grams, totals: t, ok: meetsAll(t) };
    }
  }

  const finalTotals = {
    calories: Math.round(finalResult.totals.calories),
    protein: Math.round(finalResult.totals.protein * 10) / 10,
    carbs: Math.round(finalResult.totals.carbs * 10) / 10,
    fat: Math.round(finalResult.totals.fat * 10) / 10,
  };

  console.log(`[solver] FINAL: ${JSON.stringify(finalTotals)} targets: cal≤${fullCalTarget} p≤${fullPTarget} c≤${fullCTarget} f≤${fullFTarget} ok=${finalResult.ok}`);

  // Log per-food final portions
  for (const food of freeFoods) {
    const g = finalResult.grams.get(food.id) || 0;
    console.log(`[solver] portion: ${food.name} = ${g}g (min=${food.minG} max=${food.maxG})`);
  }

  if (!finalResult.ok) {
    // FAIL — build detailed inter-constraint analysis
    const violations: string[] = [];
    if (finalTotals.calories > fullCalTarget) violations.push(`kcal_over_by_${finalTotals.calories - fullCalTarget}`);
    else if (finalTotals.calories < fullCalTarget - 50) violations.push(`kcal_under_by_${fullCalTarget - finalTotals.calories}`);
    if (finalTotals.protein > fullPTarget) violations.push(`protein_over_by_${(finalTotals.protein - fullPTarget).toFixed(1)}g`);
    else if (finalTotals.protein < fullPTarget - 2) violations.push(`protein_under_by_${(fullPTarget - finalTotals.protein).toFixed(1)}g`);
    if (finalTotals.carbs > fullCTarget) violations.push(`carbs_over_by_${(finalTotals.carbs - fullCTarget).toFixed(1)}g`);
    else if (finalTotals.carbs < fullCTarget - 2) violations.push(`carbs_under_by_${(fullCTarget - finalTotals.carbs).toFixed(1)}g`);
    if (finalTotals.fat > fullFTarget) violations.push(`fat_over_by_${(finalTotals.fat - fullFTarget).toFixed(1)}g`);
    else if (finalTotals.fat < fullFTarget - 2) violations.push(`fat_under_by_${(fullFTarget - finalTotals.fat).toFixed(1)}g`);

    // ── Context-aware suggestions ──
    // ALL suggestions must reference savedGrams (what the UI shows), never solverG.
    // The solver output is never saved on FAIL, so users see savedGrams.
    const suggested_fixes: string[] = [];

    const isCarbsUnder = finalTotals.carbs < fullCTarget - 2;
    const isProtUnder = finalTotals.protein < fullPTarget - 2;
    const isCalUnder = finalTotals.calories < fullCalTarget - 50;
    const isCalOver = finalTotals.calories > fullCalTarget;
    const isFatOver = finalTotals.fat > fullFTarget;

    // Analyze solver state — but suggestions only reference savedGrams for UI accuracy
    const foodStates = freeFoods.map(f => {
      const solverG = finalResult.grams.get(f.id) || 0;
      const originalItem = items.find((i: any) => i.id === f.id);
      const savedG = originalItem?.quantity_grams ?? 0;
      return { ...f, solverG, savedG, atMax: solverG >= f.maxG, atZero: solverG === 0 };
    });

    const maxedFoods = foodStates.filter(f => f.atMax && !f.isSeasoning);

    // Determine the binding constraint: what prevents hitting targets?
    // Compute max achievable carbs while respecting fat <= target and kcal <= target
    // This is the real feasibility proof.
    const maxCarbsUnderFatCap = (() => {
      // For each food, compute carbs-per-fat ratio. Prefer low-fat carb sources.
      const carbFoods = freeFoods.filter(f => f.cPer1g > 0 && !f.isSeasoning)
        .sort((a, b) => {
          // Sort by fat cost per gram of carb (ascending = most efficient first)
          const aFatPerCarb = a.fPer1g / Math.max(a.cPer1g, 0.001);
          const bFatPerCarb = b.fPer1g / Math.max(b.cPer1g, 0.001);
          return aFatPerCarb - bFatPerCarb;
        });

      let remainFat = fullFTarget - lockedMacros.fat;
      let remainCal = fullCalTarget - lockedMacros.calories;
      let totalCarbs = lockedMacros.carbs;

      // Subtract seasoning contribution
      for (const f of freeFoods) {
        if (f.isSeasoning) {
          const g = 10; // typical seasoning
          remainFat -= f.fPer1g * g;
          remainCal -= f.calPer1g * g;
          totalCarbs += f.cPer1g * g;
        }
      }

      // Greedily assign carb foods within fat and calorie budgets
      for (const f of carbFoods) {
        const maxByFat = f.fPer1g > 0 ? Math.floor(remainFat / f.fPer1g) : f.maxG;
        const maxByCal = f.calPer1g > 0 ? Math.floor(remainCal / f.calPer1g) : f.maxG;
        const g = Math.min(f.maxG, Math.max(0, maxByFat), Math.max(0, maxByCal));
        totalCarbs += f.cPer1g * g;
        remainFat -= f.fPer1g * g;
        remainCal -= f.calPer1g * g;
      }
      return Math.round(totalCarbs);
    })();

    console.log(`[solver] max carbs achievable under fat≤${fullFTarget} & kcal≤${fullCalTarget}: ${maxCarbsUnderFatCap}g (target: ${fullCTarget}g)`);

    if (maxCarbsUnderFatCap < fullCTarget - 2) {
      // True infeasibility under <= constraints
      suggested_fixes.push(
        `Cannot reach ${fullCTarget}g carbs while keeping fat ≤${fullFTarget}g and kcal ≤${fullCalTarget}. ` +
        `Max achievable carbs: ${maxCarbsUnderFatCap}g. ` +
        `Options: lower carb target to ~${maxCarbsUnderFatCap}g, increase fat target, or add a low-fat pure carb source.`
      );
    }

    // Identify specific bottlenecks
    if (isCarbsUnder || isCalUnder) {
      // Which carb foods are at their max?
      const carbMaxed = maxedFoods.filter(f => f.cPer1g > 0.2);
      for (const cf of carbMaxed.slice(0, 2)) {
        suggested_fixes.push(
          `${cf.name} hit max ${cf.maxG}g (${(cf.cPer1g * 100).toFixed(0)}g carbs/100g). ` +
          `Increase max_portion_grams to add more carbs.`
        );
      }

      // Are there high-fat foods eating the fat budget? Use savedG for suggestions.
      const highFatFoods = foodStates
        .filter(f => !f.isSeasoning && f.fPer1g > 0.03 && (f.savedG > 0 || f.solverG > 0))
        .map(f => ({ ...f, fatContrib: f.fPer1g * (f.savedG > 0 ? f.savedG : f.solverG) }))
        .sort((a, b) => b.fatContrib - a.fatContrib);
      for (const hf of highFatFoods.slice(0, 1)) {
        if (hf.cPer1g < 0.1) {
          const refG = hf.savedG > 0 ? hf.savedG : hf.solverG;
          suggested_fixes.push(
            `${hf.name} (${refG}g) uses ${hf.fatContrib.toFixed(1)}g of the ${fullFTarget}g fat budget ` +
            `but adds only ${(hf.cPer1g * refG).toFixed(0)}g carbs. ` +
            `Remove or replace with a lower-fat option to free fat budget for carb foods.`
          );
        }
      }

      // If no carb-dense foods exist at all
      const anyCarbFoods = foodStates.filter(f => f.cPer1g > 0.2 && !f.isSeasoning);
      if (anyCarbFoods.length === 0) {
        suggested_fixes.push('No carb-dense food on this day. Add rice, pasta, bread, oats, or cereal.');
      }
    }

    if (isFatOver && !isCarbsUnder && !isCalUnder) {
      // Pure fat overshoot — reference savedG only (what user sees)
      const fatContribs = foodStates
        .filter(f => !f.isSeasoning && f.savedG > 0)
        .map(f => ({ ...f, fatContrib: f.fPer1g * f.savedG }))
        .sort((a, b) => b.fatContrib - a.fatContrib);
      for (const fc of fatContribs.slice(0, 2)) {
        suggested_fixes.push(
          `${fc.name} (${fc.savedG}g saved) contributes ${fc.fatContrib.toFixed(1)}g fat. Replace with a lower-fat alternative.`
        );
      }
    }

    if (isProtUnder && !isCalOver) {
      const protFoods = foodStates.filter(f => f.pPer1g > 0.15 && !f.isSeasoning && !f.atMax);
      if (protFoods.length > 0) {
        const top = protFoods.sort((a, b) => b.pPer1g - a.pPer1g)[0];
        suggested_fixes.push(`${top.name} can provide more protein (max ${top.maxG}g). Solver couldn't use more due to other constraints.`);
      } else {
        suggested_fixes.push('Add a lean protein source (chicken breast, turkey, white fish).');
      }
    }

    // Per-food breakdown for the FAIL response
    // Include both solver attempted grams AND original saved grams
    const foodBreakdown = freeFoods.map(f => {
      const solverG = finalResult.grams.get(f.id) || 0;
      const originalItem = items.find((i: any) => i.id === f.id);
      const savedG = originalItem?.quantity_grams ?? 0;
      return {
        name: f.name,
        savedGrams: savedG,      // what UI currently shows (unchanged on FAIL)
        solverAttemptedGrams: solverG, // what solver tried (NOT saved)
        softMinG: f.softMinG,
        minG: f.minG,
        maxG: f.maxG,
        atMin: solverG <= f.minG,
        atMax: solverG >= f.maxG,
        excluded: solverG === 0,
        isSeasoning: f.isSeasoning,
        perGram: { cal: f.calPer1g, p: f.pPer1g, c: f.cPer1g, f: f.fPer1g },
      };
    });

    if (suggested_fixes.length === 0) {
      suggested_fixes.push('Targets may be impossible with current food list. Consider adjusting targets, adding new foods, or increasing max_portion_grams.');
    }

    console.log(`[solver] FAIL analysis: violations=${violations.join(', ')}`);
    console.log(`[solver] suggestions: ${suggested_fixes.join(' | ')}`);
    for (const fb of foodBreakdown) {
      console.log(`[solver] breakdown: ${fb.name} saved=${fb.savedGrams}g solver=${fb.solverAttemptedGrams}g (softMin=${fb.softMinG} max=${fb.maxG} excluded=${fb.excluded} atMax=${fb.atMax})`);
    }

    return {
      success: false,
      status: 'FAIL_CONSTRAINTS',
      portions: [],
      totals: finalTotals,
      targets: { calories: fullCalTarget, protein: fullPTarget, carbs: fullCTarget, fat: fullFTarget },
      violations,
      suggested_fixes,
      food_breakdown: foodBreakdown,
      feasibility: {
        theoretical_min: theoreticalMin,
        theoretical_max: theoreticalMax,
      },
    };
  }

  // PASS — build portions array
  const portions = [
    ...lockedItems.map((item: any) => ({ id: item.id, quantity_grams: item.quantity_grams })),
    ...freeFoods.map(food => ({ id: food.id, quantity_grams: finalResult.grams.get(food.id) || food.minG })),
  ];

  console.log(`[solver] PASS: ${JSON.stringify(finalTotals)}`);

  return {
    success: true,
    status: 'PASS',
    portions,
    totals: finalTotals,
    tolerances_check: {
      kcal_ok: true,
      protein_ok: true,
      carbs_ok: true,
      fat_ok: true,
    },
  };
}

// ─── Main handler ────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
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
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate input
    const rawBody = await req.json();
    const parseResult = inputSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parseResult.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = parseResult.data;

    let result: any;
    if (parsed.feature === 'cheaper_bills') {
      result = await handleCheaperBills(supabase, user.id, parsed.input);
    } else if (parsed.feature === 'meal_planner') {
      result = await handleMealPlanner(parsed.input);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[claude-ai] error:', error);

    if (error.status === 429) {
      return new Response(JSON.stringify({ error: 'AI is rate-limited right now — please try again in a minute.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (error.status === 402) {
      return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds in your workspace settings.' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
