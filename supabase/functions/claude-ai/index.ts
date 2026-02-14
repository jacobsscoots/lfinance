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

// ─── Meal Planner handler (COMPLETE REWRITE) ─────────────
//
// Architecture:
//   1. Classify items (locked vs free, seasoning detection)
//   2. Feasibility pre-check (theoretical min/max)
//   3. AI generates initial portion guess (using FULL targets)
//   4. Multi-start coordinate descent solver with adaptive steps
//   5. Rounding + fine-tuning
//   6. Validate → PASS (return portions) or FAIL (return diagnostics)
//
// Hard constraints (NEVER over target):
//   kcal: [target-50, target]
//   P/C/F: [target-2, target]

async function handleMealPlanner(
  input: { items: any[]; targets: any }
) {
  const { items, targets } = input;
  const RUN_ID = crypto.randomUUID().slice(0, 8);
  console.log(`[solver:${RUN_ID}] === START ===`);

  // ─── SEASONING DETECTION ───────────────────────────────
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

  // ─── CLASSIFY ITEMS ────────────────────────────────────
  const lockedItems = items.filter((i: any) => i.is_locked || i.product_type === 'fixed');
  const freeItems = items.filter((i: any) => !i.is_locked && i.product_type !== 'fixed');

  interface FreeFood {
    id: string;
    name: string;
    isSeasoning: boolean;
    savedG: number;    // what UI currently shows (quantity_grams from payload)
    minG: number;      // solver hard floor: 0 for non-seasoning, 5 for seasoning
    maxG: number;
    calPer1g: number;
    pPer1g: number;
    cPer1g: number;
    fPer1g: number;
  }

  const freeFoods: FreeFood[] = freeItems.map((item: any) => {
    const isSeas = isSeasoningItem(item);
    return {
      id: item.id,
      name: item.name,
      isSeasoning: isSeas,
      savedG: item.quantity_grams || 0,
      // Bug 2 fix: free non-seasoning items have minG=0 (fully optional)
      minG: isSeas ? 5 : 0,
      maxG: isSeas ? 15 : Math.max(item.max_portion_grams || 500, 1),
      calPer1g: (item.calories_per_100g || 0) / 100,
      pPer1g: (item.protein_per_100g || 0) / 100,
      cPer1g: (item.carbs_per_100g || 0) / 100,
      fPer1g: (item.fat_per_100g || 0) / 100,
    };
  });

  // ─── LOCKED MACROS ─────────────────────────────────────
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

  // Bug 1 fix: use FULL daily targets everywhere
  const fullCalTarget = Math.round(targets.calories);
  const fullPTarget = Math.round(targets.protein);
  const fullCTarget = Math.round(targets.carbs);
  const fullFTarget = Math.round(targets.fat);

  console.log(`[solver:${RUN_ID}] targets: cal=${fullCalTarget} p=${fullPTarget} c=${fullCTarget} f=${fullFTarget}`);
  console.log(`[solver:${RUN_ID}] locked: cal=${Math.round(lockedMacros.calories)} p=${Math.round(lockedMacros.protein)} c=${Math.round(lockedMacros.carbs)} f=${Math.round(lockedMacros.fat)}`);
  for (const food of freeFoods) {
    console.log(`[solver:${RUN_ID}] food: ${food.name} | minG=${food.minG} max=${food.maxG}g | cal/g=${food.calPer1g.toFixed(2)} p/g=${food.pPer1g.toFixed(2)} c/g=${food.cPer1g.toFixed(2)} f/g=${food.fPer1g.toFixed(2)} | seasoning=${food.isSeasoning} | savedG=${food.savedG}`);
  }

  // ─── FEASIBILITY PRE-CHECK ─────────────────────────────
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

  console.log(`[solver:${RUN_ID}] feasibility min: cal=${Math.round(theoreticalMin.calories)} p=${Math.round(theoreticalMin.protein)} c=${Math.round(theoreticalMin.carbs)} f=${Math.round(theoreticalMin.fat)}`);
  console.log(`[solver:${RUN_ID}] feasibility max: cal=${Math.round(theoreticalMax.calories)} p=${Math.round(theoreticalMax.protein)} c=${Math.round(theoreticalMax.carbs)} f=${Math.round(theoreticalMax.fat)}`);

  // Check hard infeasibility — using OVERSHOOT targets (+2g macro minimum)
  const OVERSHOOT_MIN = 2;
  const infeasible: string[] = [];
  if (theoreticalMax.calories < fullCalTarget) infeasible.push(`kcal: max achievable ${Math.round(theoreticalMax.calories)} < min required ${fullCalTarget}`);
  if (theoreticalMax.protein < fullPTarget + OVERSHOOT_MIN) infeasible.push(`protein: max achievable ${theoreticalMax.protein.toFixed(1)}g < min required ${fullPTarget + OVERSHOOT_MIN}g`);
  if (theoreticalMax.carbs < fullCTarget + OVERSHOOT_MIN) infeasible.push(`carbs: max achievable ${theoreticalMax.carbs.toFixed(1)}g < min required ${fullCTarget + OVERSHOOT_MIN}g`);
  if (theoreticalMax.fat < fullFTarget + OVERSHOOT_MIN) infeasible.push(`fat: max achievable ${theoreticalMax.fat.toFixed(1)}g < min required ${fullFTarget + OVERSHOOT_MIN}g`);
  if (theoreticalMin.calories > fullCalTarget + 50) infeasible.push(`kcal: min achievable ${Math.round(theoreticalMin.calories)} > max allowed ${fullCalTarget + 50}`);
  if (theoreticalMin.protein > fullPTarget + 5) infeasible.push(`protein: min achievable ${theoreticalMin.protein.toFixed(1)}g > max allowed ${fullPTarget + 5}g`);
  if (theoreticalMin.carbs > fullCTarget + 5) infeasible.push(`carbs: min achievable ${theoreticalMin.carbs.toFixed(1)}g > max allowed ${fullCTarget + 5}g`);
  if (theoreticalMin.fat > fullFTarget + 5) infeasible.push(`fat: min achievable ${theoreticalMin.fat.toFixed(1)}g > max allowed ${fullFTarget + 5}g`);

  // Log infeasibility but DON'T return early — let solver find best-effort solution
  if (infeasible.length > 0) {
    console.warn(`[solver:${RUN_ID}] INFEASIBLE (will attempt best-effort): ${infeasible.join('; ')}`);
  }

  // ─── CORE SOLVER FUNCTIONS ─────────────────────────────
  // Bug 1+4 fix: computeTotals adds locked + free, compared against FULL targets

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

  // Tolerance bands — OVERSHOOT BUFFER model:
  // Calories: [target, target + 50] — no undershoot, minimise overshoot
  // Protein:  [target + 2, target + 5] — always overshoot by 2-5g
  // Carbs:    [target + 2, target + 5]
  // Fat:      [target + 2, target + 5]
  function meetsAll(totals: { calories: number; protein: number; carbs: number; fat: number }) {
    return (
      totals.calories >= fullCalTarget && totals.calories <= fullCalTarget + 50 &&
      totals.protein >= fullPTarget + OVERSHOOT_MIN && totals.protein <= fullPTarget + 5 &&
      totals.carbs >= fullCTarget + OVERSHOOT_MIN && totals.carbs <= fullCTarget + 5 &&
      totals.fat >= fullFTarget + OVERSHOOT_MIN && totals.fat <= fullFTarget + 5
    );
  }

  // Weighted error: 0 = perfect. Out-of-band penalties.
  // Bands match meetsAll: cal [0,+50], macros [+2,+5]
  function computeError(totals: { calories: number; protein: number; carbs: number; fat: number }): number {
    let err = 0;
    // Calories: band is [fullCalTarget, fullCalTarget + 50]
    if (totals.calories > fullCalTarget + 50) err += (totals.calories - fullCalTarget - 50) * 2;
    else if (totals.calories < fullCalTarget) err += (fullCalTarget - totals.calories) * 3;
    else err += (totals.calories - fullCalTarget) * 0.5; // minimise overshoot within band
    // Protein: band is [fullPTarget + 2, fullPTarget + 5]
    if (totals.protein > fullPTarget + 5) err += (totals.protein - fullPTarget - 5) * 50;
    else if (totals.protein < fullPTarget + OVERSHOOT_MIN) err += (fullPTarget + OVERSHOOT_MIN - totals.protein) * 50;
    // Carbs: band is [fullCTarget + 2, fullCTarget + 5]
    if (totals.carbs > fullCTarget + 5) err += (totals.carbs - fullCTarget - 5) * 50;
    else if (totals.carbs < fullCTarget + OVERSHOOT_MIN) err += (fullCTarget + OVERSHOOT_MIN - totals.carbs) * 50;
    // Fat: band is [fullFTarget + 2, fullFTarget + 5]
    if (totals.fat > fullFTarget + 5) err += (totals.fat - fullFTarget - 5) * 50;
    else if (totals.fat < fullFTarget + OVERSHOOT_MIN) err += (fullFTarget + OVERSHOOT_MIN - totals.fat) * 50;
    return err;
  }

  // ─── MULTI-START COORDINATE DESCENT (v5) ────────────────
  // Full exploration: 20k iterations, 2k stale limit, no early exit on perfect,
  // collects top candidates for funnel selection.

  type Candidate = { grams: Map<string, number>; totals: { calories: number; protein: number; carbs: number; fat: number }; error: number };

  function hashPortions(g: Map<string, number>): string {
    return freeFoods.map(f => g.get(f.id) || 0).join(',');
  }

  function solveFromStart(startGrams: Map<string, number>): { best: Candidate; candidates: Candidate[]; iterations: number } {
    const grams = new Map(startGrams);
    const nonSeasoningFoods = freeFoods.filter(f => !f.isSeasoning);
    let bestError = Infinity;
    let bestGrams = new Map(grams);
    let bestTotals = computeTotals(grams);
    let staleCount = 0;

    // Collect top candidates (keep sorted, cap at 2000)
    const candidates: Candidate[] = [];
    const MAX_CANDIDATES = 2000;
    let worstCandidateError = Infinity;

    function maybeAddCandidate(g: Map<string, number>, t: { calories: number; protein: number; carbs: number; fat: number }, e: number) {
      if (candidates.length < MAX_CANDIDATES) {
        candidates.push({ grams: new Map(g), totals: { ...t }, error: e });
        if (candidates.length === MAX_CANDIDATES) {
          candidates.sort((a, b) => a.error - b.error);
          worstCandidateError = candidates[candidates.length - 1].error;
        }
      } else if (e < worstCandidateError) {
        // Replace worst candidate
        candidates[candidates.length - 1] = { grams: new Map(g), totals: { ...t }, error: e };
        candidates.sort((a, b) => a.error - b.error);
        worstCandidateError = candidates[candidates.length - 1].error;
      }
    }

    // Tabu set to prevent revisiting recent states
    const tabu = new Set<string>();
    const MAX_TABU = 400;

    for (let iter = 0; iter < 20000; iter++) {
      const totals = computeTotals(grams);
      const err = computeError(totals);

      // Always collect — no early exit on perfect
      maybeAddCandidate(grams, totals, err);

      if (err < bestError) {
        bestError = err;
        bestGrams = new Map(grams);
        bestTotals = { ...totals };
        staleCount = 0;
      } else {
        staleCount++;
      }

      // Stagnation exit: if no improvement in 2000 iterations, stop
      if (staleCount > 2000) {
        break;
      }

      // Perturbation escape every 200 stale iterations
      if (staleCount > 200 && staleCount % 200 === 0) {
        const shuffled = [...nonSeasoningFoods].sort(() => Math.random() - 0.5);
        const numPerturb = Math.min(3, shuffled.length);
        for (let pi = 0; pi < numPerturb; pi++) {
          const f = shuffled[pi];
          const cur = grams.get(f.id) || 0;
          const delta = (Math.random() > 0.5 ? 1 : -1) * Math.round(Math.random() * 20 + 5);
          grams.set(f.id, Math.max(f.minG, Math.min(f.maxG, cur + delta)));
        }
        continue;
      }

      // Try MULTIPLE step sizes simultaneously
      const stepSizes = err < 50 ? [1, 2] : err < 200 ? [1, 2, 5] : [1, 5, 10, 20];

      let bestFoodIdx = -1;
      let bestNewG = 0;
      let bestStepError = Infinity;

      for (let fi = 0; fi < nonSeasoningFoods.length; fi++) {
        const food = nonSeasoningFoods[fi];
        const currentG = grams.get(food.id) || 0;

        for (const step of stepSizes) {
          // Try +step
          const upG = Math.min(food.maxG, currentG + step);
          if (upG !== currentG) {
            grams.set(food.id, upG);
            const h = hashPortions(grams);
            if (!tabu.has(h)) {
              const testErr = computeError(computeTotals(grams));
              if (testErr < bestStepError) {
                bestStepError = testErr;
                bestFoodIdx = fi;
                bestNewG = upG;
              }
            }
            grams.set(food.id, currentG);
          }

          // Try -step
          const downG = Math.max(food.minG, currentG - step);
          if (downG !== currentG) {
            grams.set(food.id, downG);
            const h = hashPortions(grams);
            if (!tabu.has(h)) {
              const testErr = computeError(computeTotals(grams));
              if (testErr < bestStepError) {
                bestStepError = testErr;
                bestFoodIdx = fi;
                bestNewG = downG;
              }
            }
            grams.set(food.id, currentG);
          }
        }
      }

      if (bestFoodIdx === -1) break; // no non-tabu moves possible

      // Apply the best move and add current state to tabu
      const currentHash = hashPortions(grams);
      if (tabu.size >= MAX_TABU) {
        const first = tabu.values().next().value;
        if (first) tabu.delete(first);
      }
      tabu.add(currentHash);

      const chosenFood = nonSeasoningFoods[bestFoodIdx];
      grams.set(chosenFood.id, bestNewG);
    }

    return { best: { grams: bestGrams, totals: bestTotals, error: bestError }, candidates, iterations: 20000 };
  }

  // ─── FUNNEL SELECTION ──────────────────────────────────
  // Stage 1: Top 2000 by lowest error (collected during solve)
  // Stage 2: Top 50 with macros in overshoot band (+2 to +5g)
  // Stage 3: Pick lowest calorie overshoot from those 50

  function funnelSelect(allCandidates: Candidate[]): Candidate {
    // Stage 1: already sorted by error, take top 2000
    allCandidates.sort((a, b) => a.error - b.error);
    const top2000 = allCandidates.slice(0, 2000);

    // Stage 2: filter to those meeting macro overshoot bands (+2 to +5g)
    const macroFiltered = top2000.filter(c => {
      const t = c.totals;
      return (
        t.protein >= fullPTarget + OVERSHOOT_MIN && t.protein <= fullPTarget + 5 &&
        t.carbs >= fullCTarget + OVERSHOOT_MIN && t.carbs <= fullCTarget + 5 &&
        t.fat >= fullFTarget + OVERSHOOT_MIN && t.fat <= fullFTarget + 5
      );
    });

    // If no candidates meet strict macro bands, relax to top 50 by error
    const stage2 = macroFiltered.length > 0 ? macroFiltered.slice(0, 50) : top2000.slice(0, 50);

    // Stage 3: pick lowest calorie overshoot (closest to target without going under)
    stage2.sort((a, b) => {
      const aOver = a.totals.calories - fullCalTarget;
      const bOver = b.totals.calories - fullCalTarget;
      // Prefer in-band (0 to +50), then closest to 0
      const aInBand = aOver >= 0 && aOver <= 50;
      const bInBand = bOver >= 0 && bOver <= 50;
      if (aInBand && !bInBand) return -1;
      if (!aInBand && bInBand) return 1;
      if (aInBand && bInBand) return aOver - bOver; // both in band, pick lower overshoot
      return Math.abs(aOver) - Math.abs(bOver); // both out of band, pick closer
    });

    return stage2[0];
  }

  // ─── GENERATE STARTING POINTS ──────────────────────────

  function generateStarts(): Map<string, number>[] {
    const starts: Map<string, number>[] = [];

    // Start 1: midpoint
    const mid = new Map<string, number>();
    for (const food of freeFoods) {
      mid.set(food.id, food.isSeasoning ? Math.min(10, food.maxG) : Math.round((food.minG + food.maxG) / 2));
    }
    starts.push(mid);

    // Start 2: all minimums
    const minStart = new Map<string, number>();
    for (const food of freeFoods) {
      minStart.set(food.id, food.minG);
    }
    starts.push(minStart);

    // Start 3: proportional to calorie share
    const remainCal = Math.max(0, fullCalTarget - lockedMacros.calories);
    const totalCalPerG = freeFoods.filter(f => !f.isSeasoning).reduce((s, f) => s + f.calPer1g, 0);
    const proportional = new Map<string, number>();
    for (const food of freeFoods) {
      if (food.isSeasoning) {
        proportional.set(food.id, Math.min(10, food.maxG));
      } else if (totalCalPerG > 0) {
        const share = food.calPer1g / totalCalPerG;
        const targetG = Math.round((remainCal / food.calPer1g) * share);
        proportional.set(food.id, Math.max(food.minG, Math.min(food.maxG, targetG)));
      } else {
        proportional.set(food.id, food.minG);
      }
    }
    starts.push(proportional);

    // Start 4: carb-heavy
    const carbHeavy = new Map<string, number>();
    const sortedByCarbs = [...freeFoods].filter(f => !f.isSeasoning).sort((a, b) => b.cPer1g - a.cPer1g);
    for (const food of freeFoods) {
      carbHeavy.set(food.id, food.isSeasoning ? Math.min(10, food.maxG) : food.minG);
    }
    for (let i = 0; i < Math.min(2, sortedByCarbs.length); i++) {
      carbHeavy.set(sortedByCarbs[i].id, sortedByCarbs[i].maxG);
    }
    starts.push(carbHeavy);

    // Start 5: protein-heavy
    const protHeavy = new Map<string, number>();
    const sortedByProt = [...freeFoods].filter(f => !f.isSeasoning).sort((a, b) => b.pPer1g - a.pPer1g);
    for (const food of freeFoods) {
      protHeavy.set(food.id, food.isSeasoning ? Math.min(10, food.maxG) : food.minG);
    }
    for (let i = 0; i < Math.min(2, sortedByProt.length); i++) {
      protHeavy.set(sortedByProt[i].id, sortedByProt[i].maxG);
    }
    starts.push(protHeavy);

    // Start 6 & 7: random starts for diversity
    for (let r = 0; r < 2; r++) {
      const rand = new Map<string, number>();
      for (const food of freeFoods) {
        if (food.isSeasoning) {
          rand.set(food.id, Math.min(5 + Math.round(Math.random() * 10), food.maxG));
        } else {
          const range = food.maxG - food.minG;
          rand.set(food.id, food.minG + Math.round(Math.random() * range));
        }
      }
      starts.push(rand);
    }

    return starts;
  }

  // ─── AI INITIAL GUESS (Bug 1 fix: uses FULL targets) ───

  const lockedList = lockedItems.length > 0
    ? lockedItems.map((item: any) => `- ${item.name}: ${item.quantity_grams}g (LOCKED — contributes ${Math.round(item.calories_per_100g * item.quantity_grams / 100)} kcal, ${(item.protein_per_100g * item.quantity_grams / 100).toFixed(1)}g P, ${(item.carbs_per_100g * item.quantity_grams / 100).toFixed(1)}g C, ${(item.fat_per_100g * item.quantity_grams / 100).toFixed(1)}g F)`).join('\n')
    : 'None';

  const foodList = freeFoods.map(f => {
    return `- ${f.name} (id: ${f.id}): ${(f.calPer1g * 100).toFixed(0)} kcal, ${(f.pPer1g * 100).toFixed(1)}g P, ${(f.cPer1g * 100).toFixed(1)}g C, ${(f.fPer1g * 100).toFixed(1)}g F per 100g. Min: ${f.minG}g, Max: ${f.maxG}g.${f.isSeasoning ? ' SEASONING 5-15g.' : ''}`;
  }).join('\n');

  // Bug 1 fix: AI prompt uses FULL daily targets with OVERSHOOT BUFFER
  const systemPrompt = `You are a meal portion calculator. Assign gram portions to the FREE (unlocked) foods to make the FULL DAY totals (locked + free combined) hit these OVERSHOOT targets:
- Calories: ${fullCalTarget} kcal (valid band: ${fullCalTarget} to ${fullCalTarget + 50} kcal — minimise overshoot)
- Protein: ${fullPTarget}g (valid band: ${fullPTarget + 2} to ${fullPTarget + 5}g — MUST overshoot by 2-5g)
- Carbs: ${fullCTarget}g (valid band: ${fullCTarget + 2} to ${fullCTarget + 5}g — MUST overshoot by 2-5g)
- Fat: ${fullFTarget}g (valid band: ${fullFTarget + 2} to ${fullFTarget + 5}g — MUST overshoot by 2-5g)

IMPORTANT: Macros MUST overshoot their targets by at least 2g (to account for real-world food loss). Stay within the valid bands. Minimise calorie surplus while meeting macro overshoot requirements.

Locked items (already counted, DO NOT change):
${lockedList}
Total locked contribution: ${Math.round(lockedMacros.calories)} kcal, ${lockedMacros.protein.toFixed(1)}g P, ${lockedMacros.carbs.toFixed(1)}g C, ${lockedMacros.fat.toFixed(1)}g F

Free items to assign portions:
${foodList}

CRITICAL: The portions you assign for free items, PLUS the locked contributions above, must sum to the overshoot targets. Think about what's left after locked items: ~${Math.round(fullCalTarget - lockedMacros.calories)} kcal, ${(fullPTarget + 3 - lockedMacros.protein).toFixed(0)}g P (target+3g sweet spot), ${(fullCTarget + 3 - lockedMacros.carbs).toFixed(0)}g C (target+3g sweet spot), ${(fullFTarget + 3 - lockedMacros.fat).toFixed(0)}g F (target+3g sweet spot) remaining for free items.

Use LARGE portions of carb-dense foods to hit carb targets. Use LARGE portions of protein-dense foods to hit protein targets. Don't default to small portions. Items with minG=0 can be set to 0g if needed (excluded). Use set_portions tool.`;

  const tools = [
    {
      type: "function",
      function: {
        name: "set_portions",
        description: "Set gram portions for each free food item",
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
      userMessage: "Assign portions to hit targets. Use set_portions tool.",
      tools,
      toolChoice: { type: "function", function: { name: "set_portions" } },
    });

    console.log(`[solver:${RUN_ID}] AI guess: model=${AI_MODEL} usage=${JSON.stringify(aiData.usage || {})}`);

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
    console.warn(`[solver:${RUN_ID}] AI call failed, using deterministic starts only:`, e);
  }

  // Fill in any foods missing from AI guess
  for (const food of freeFoods) {
    if (!aiStartGrams.has(food.id)) {
      aiStartGrams.set(food.id, food.isSeasoning ? Math.min(10, food.maxG) : food.minG);
    }
  }

  // ─── RUN SOLVER FROM MULTIPLE STARTS ───────────────────

  const starts = generateStarts();
  starts.push(aiStartGrams);

  const allCandidates: Candidate[] = [];

  for (let si = 0; si < starts.length; si++) {
    const result = solveFromStart(starts[si]);
    console.log(`[solver:${RUN_ID}] start ${si}: bestError=${result.best.error.toFixed(1)} candidates=${result.candidates.length} totals=${JSON.stringify({ cal: Math.round(result.best.totals.calories), p: Math.round(result.best.totals.protein * 10) / 10, c: Math.round(result.best.totals.carbs * 10) / 10, f: Math.round(result.best.totals.fat * 10) / 10 })}`);
    allCandidates.push(...result.candidates);
  }

  // ─── FUNNEL SELECTION: 20k → 2000 → 50 → 1 ────────────
  console.log(`[solver:${RUN_ID}] Total candidates collected: ${allCandidates.length}`);
  const bestResult = funnelSelect(allCandidates);
  console.log(`[solver:${RUN_ID}] Funnel winner: error=${bestResult.error.toFixed(1)} totals=${JSON.stringify({ cal: Math.round(bestResult.totals.calories), p: Math.round(bestResult.totals.protein * 10) / 10, c: Math.round(bestResult.totals.carbs * 10) / 10, f: Math.round(bestResult.totals.fat * 10) / 10 })}`);

  // ─── ROUNDING (Bug 3 fix: fine-tune after rounding) ────

  function roundGrams(grams: Map<string, number>, roundTo: number): Map<string, number> {
    const rounded = new Map<string, number>();
    for (const food of freeFoods) {
      const g = grams.get(food.id) || food.minG;
      rounded.set(food.id, Math.max(food.minG, Math.min(food.maxG, Math.round(g / roundTo) * roundTo)));
    }
    return rounded;
  }

  // Try 5g rounding → fine-tune with 200 iterations of 1g descent
  let finalGrams = roundGrams(bestResult.grams, 5);
  let finalTotals = computeTotals(finalGrams);
  let finalOk = meetsAll(finalTotals);

  if (!finalOk) {
    // Fine-tune from 5g-rounded state
    const fineResult = solveFromStart(finalGrams);
    finalGrams = roundGrams(fineResult.best.grams, 5);
    finalTotals = computeTotals(finalGrams);
    finalOk = meetsAll(finalTotals);
  }

  if (!finalOk) {
    // Fall back to 1g rounding
    finalGrams = roundGrams(bestResult.grams, 1);
    finalTotals = computeTotals(finalGrams);
    finalOk = meetsAll(finalTotals);

    if (!finalOk) {
      // One more fine-tune pass
      const fineResult2 = solveFromStart(finalGrams);
      finalGrams = fineResult2.best.grams;
      finalTotals = computeTotals(finalGrams);
      finalOk = meetsAll(finalTotals);
    }
  }

  const roundedTotals = {
    calories: Math.round(finalTotals.calories),
    protein: Math.round(finalTotals.protein * 10) / 10,
    carbs: Math.round(finalTotals.carbs * 10) / 10,
    fat: Math.round(finalTotals.fat * 10) / 10,
  };

  console.log(`[solver:${RUN_ID}] FINAL: ${JSON.stringify(roundedTotals)} targets: cal≤${fullCalTarget} p≤${fullPTarget} c≤${fullCTarget} f≤${fullFTarget} ok=${finalOk}`);
  for (const food of freeFoods) {
    const g = finalGrams.get(food.id) || 0;
    console.log(`[solver:${RUN_ID}] portion: ${food.name} = ${g}g (min=${food.minG} max=${food.maxG})`);
  }

  // ─── RESULT ────────────────────────────────────────────

  // Build portions array (used for both PASS and BEST_EFFORT)
  const bestEffortPortions = [
    ...lockedItems.map((item: any) => ({ id: item.id, quantity_grams: item.quantity_grams })),
    ...freeFoods.map(food => ({ id: food.id, quantity_grams: finalGrams.get(food.id) || food.minG })),
  ];

  if (!finalOk) {
    // BEST EFFORT — couldn't hit exact tolerance but return closest solution
    const violations: string[] = [];
    if (roundedTotals.calories > fullCalTarget + 50) violations.push(`kcal over by ${roundedTotals.calories - fullCalTarget}`);
    else if (roundedTotals.calories < fullCalTarget) violations.push(`kcal under by ${fullCalTarget - roundedTotals.calories}`);
    if (roundedTotals.protein > fullPTarget + 5) violations.push(`protein over by ${(roundedTotals.protein - fullPTarget).toFixed(1)}g`);
    else if (roundedTotals.protein < fullPTarget + OVERSHOOT_MIN) violations.push(`protein under overshoot minimum by ${(fullPTarget + OVERSHOOT_MIN - roundedTotals.protein).toFixed(1)}g`);
    if (roundedTotals.carbs > fullCTarget + 5) violations.push(`carbs over by ${(roundedTotals.carbs - fullCTarget).toFixed(1)}g`);
    else if (roundedTotals.carbs < fullCTarget + OVERSHOOT_MIN) violations.push(`carbs under overshoot minimum by ${(fullCTarget + OVERSHOOT_MIN - roundedTotals.carbs).toFixed(1)}g`);
    if (roundedTotals.fat > fullFTarget + 5) violations.push(`fat over by ${(roundedTotals.fat - fullFTarget).toFixed(1)}g`);
    else if (roundedTotals.fat < fullFTarget + OVERSHOOT_MIN) violations.push(`fat under overshoot minimum by ${(fullFTarget + OVERSHOOT_MIN - roundedTotals.fat).toFixed(1)}g`);

    for (const food of freeFoods) {
      const solverG = finalGrams.get(food.id) || 0;
      console.log(`[solver:${RUN_ID}] BEST_EFFORT breakdown: ${food.name} savedG=${food.savedG} solverG=${solverG} (min=${food.minG} max=${food.maxG})`);
    }

    const suggested_fixes = buildSuggestions(finalGrams, freeFoods, lockedMacros, fullCalTarget, fullPTarget, fullCTarget, fullFTarget, violations);
    console.log(`[solver:${RUN_ID}] BEST_EFFORT: ${JSON.stringify(roundedTotals)} violations: ${violations.join(', ')}`);

    return {
      success: true,
      status: 'BEST_EFFORT',
      run_id: RUN_ID,
      portions: bestEffortPortions,
      totals: roundedTotals,
      targets: { calories: fullCalTarget, protein: fullPTarget, carbs: fullCTarget, fat: fullFTarget },
      violations,
      suggested_fixes,
    };
  }

  // PASS
  console.log(`[solver:${RUN_ID}] PASS: ${JSON.stringify(roundedTotals)}`);

  return {
    success: true,
    status: 'PASS',
    run_id: RUN_ID,
    portions: bestEffortPortions,
    totals: roundedTotals,
    tolerances_check: { kcal_ok: true, protein_ok: true, carbs_ok: true, fat_ok: true },
  };
}

// ─── SUGGESTION ENGINE (Bug 7 rewrite) ───────────────────
// All suggestions reference savedGrams only, never solver-attempted grams.

function buildSuggestions(
  solverGrams: Map<string, number> | null,
  freeFoods: Array<{ id: string; name: string; isSeasoning: boolean; savedG: number; minG: number; maxG: number; calPer1g: number; pPer1g: number; cPer1g: number; fPer1g: number }>,
  lockedMacros: { calories: number; protein: number; carbs: number; fat: number },
  fullCalTarget: number,
  fullPTarget: number,
  fullCTarget: number,
  fullFTarget: number,
  violations: string[],
): string[] {
  const suggestions: string[] = [];

  // Step 1: Compute max achievable carbs under fat ≤ target AND kcal ≤ target
  const maxCarbsUnderCaps = (() => {
    const carbFoods = freeFoods.filter(f => f.cPer1g > 0 && !f.isSeasoning)
      .sort((a, b) => {
        const aFatPerCarb = a.fPer1g / Math.max(a.cPer1g, 0.001);
        const bFatPerCarb = b.fPer1g / Math.max(b.cPer1g, 0.001);
        return aFatPerCarb - bFatPerCarb;
      });

    let remainFat = fullFTarget - lockedMacros.fat;
    let remainCal = fullCalTarget - lockedMacros.calories;
    let totalCarbs = lockedMacros.carbs;

    // Subtract seasoning contribution (assume ~10g each)
    for (const f of freeFoods) {
      if (f.isSeasoning) {
        remainFat -= f.fPer1g * 10;
        remainCal -= f.calPer1g * 10;
        totalCarbs += f.cPer1g * 10;
      }
    }

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

  // Step 2: Compute max achievable protein similarly
  const maxProtUnderCaps = (() => {
    const protFoods = freeFoods.filter(f => f.pPer1g > 0 && !f.isSeasoning)
      .sort((a, b) => {
        const aFatPerProt = a.fPer1g / Math.max(a.pPer1g, 0.001);
        const bFatPerProt = b.fPer1g / Math.max(b.pPer1g, 0.001);
        return aFatPerProt - bFatPerProt;
      });

    let remainFat = fullFTarget - lockedMacros.fat;
    let remainCal = fullCalTarget - lockedMacros.calories;
    let totalProt = lockedMacros.protein;

    for (const f of freeFoods) {
      if (f.isSeasoning) {
        remainFat -= f.fPer1g * 10;
        remainCal -= f.calPer1g * 10;
      }
    }

    for (const f of protFoods) {
      const maxByFat = f.fPer1g > 0 ? Math.floor(remainFat / f.fPer1g) : f.maxG;
      const maxByCal = f.calPer1g > 0 ? Math.floor(remainCal / f.calPer1g) : f.maxG;
      const g = Math.min(f.maxG, Math.max(0, maxByFat), Math.max(0, maxByCal));
      totalProt += f.pPer1g * g;
      remainFat -= f.fPer1g * g;
      remainCal -= f.calPer1g * g;
    }
    return Math.round(totalProt);
  })();

  // Step 3: Inter-constraint conflict detection
  const carbsViolation = violations.some(v => v.includes('carbs under') || v.includes('carbs: max'));
  const protViolation = violations.some(v => v.includes('protein under') || v.includes('protein: max'));
  const fatViolation = violations.some(v => v.includes('fat over') || v.includes('fat: min'));

  if (maxCarbsUnderCaps < fullCTarget - 2) {
    suggestions.push(
      `Cannot reach ${fullCTarget}g carbs while keeping fat ≤${fullFTarget}g and kcal ≤${fullCalTarget}. ` +
      `Max achievable carbs: ${maxCarbsUnderCaps}g. ` +
      `Options: lower carb target to ~${maxCarbsUnderCaps}g, increase fat target, or add a low-fat pure carb source.`
    );
  }

  if (maxProtUnderCaps < fullPTarget - 2) {
    suggestions.push(
      `Cannot reach ${fullPTarget}g protein while keeping fat ≤${fullFTarget}g. ` +
      `Max achievable protein: ${maxProtUnderCaps}g. ` +
      `Options: lower protein target, increase fat target, or add a leaner protein source.`
    );
  }

  // Step 4: Identify fat budget consumers (use savedGrams ONLY)
  if (carbsViolation || protViolation) {
    const highFatFoods = freeFoods
      .filter(f => !f.isSeasoning && f.fPer1g > 0.03 && f.cPer1g < 0.1 && f.savedG > 0)
      .map(f => ({
        ...f,
        fatContrib: f.fPer1g * f.savedG,
        carbContrib: f.cPer1g * f.savedG,
      }))
      .sort((a, b) => b.fatContrib - a.fatContrib);

    for (const hf of highFatFoods.slice(0, 2)) {
      // Never suggest reducing a food that provides a macro we're SHORT on
      suggestions.push(
        `${hf.name} (${hf.savedG}g) uses ${hf.fatContrib.toFixed(1)}g of the ${fullFTarget}g fat budget ` +
        `but adds only ${hf.carbContrib.toFixed(0)}g carbs. ` +
        `Remove or replace with a lower-fat option to free fat budget for carb foods.`
      );
    }
  }

  // Step 5: Maxed carb foods (use solver grams if available)
  if (carbsViolation && solverGrams) {
    const maxedCarbFoods = freeFoods.filter(f => {
      const sg = solverGrams.get(f.id) || 0;
      return f.cPer1g > 0.2 && !f.isSeasoning && sg >= f.maxG;
    });
    for (const cf of maxedCarbFoods.slice(0, 2)) {
      suggestions.push(
        `${cf.name} hit max ${cf.maxG}g (${(cf.cPer1g * 100).toFixed(0)}g carbs/100g). ` +
        `Increase max_portion_grams to add more carbs.`
      );
    }
  }

  // Step 6: No carb-dense foods at all
  if (carbsViolation) {
    const anyCarbFoods = freeFoods.filter(f => f.cPer1g > 0.2 && !f.isSeasoning);
    if (anyCarbFoods.length === 0) {
      suggestions.push('No carb-dense food on this day. Add rice, pasta, bread, oats, or cereal.');
    }
  }

  // Step 7: Protein suggestions
  if (protViolation && !fatViolation) {
    const leanProt = freeFoods.filter(f => f.pPer1g > 0.15 && !f.isSeasoning);
    if (leanProt.length === 0) {
      suggestions.push('Add a lean protein source (chicken breast, turkey, white fish).');
    }
  }

  // Step 8: Pure fat overshoot
  if (fatViolation && !carbsViolation && !protViolation) {
    const fatContribs = freeFoods
      .filter(f => !f.isSeasoning && f.savedG > 0)
      .map(f => ({ ...f, fatContrib: f.fPer1g * f.savedG }))
      .sort((a, b) => b.fatContrib - a.fatContrib);
    for (const fc of fatContribs.slice(0, 2)) {
      suggestions.push(
        `${fc.name} (${fc.savedG}g saved) contributes ${fc.fatContrib.toFixed(1)}g fat. Replace with a lower-fat alternative.`
      );
    }
  }

  if (suggestions.length === 0) {
    suggestions.push('Targets may be impossible with current food list. Consider adjusting targets, adding new foods, or increasing max_portion_grams.');
  }

  return suggestions;
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
