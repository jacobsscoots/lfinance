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

  const lockedItems = items.filter((i: any) => i.is_locked || i.product_type === 'fixed');
  const freeItems = items.filter((i: any) => !i.is_locked && i.product_type !== 'fixed');

  // Calculate locked calories/macros
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

  const remainingTargets = {
    calories: Math.max(0, targets.calories - lockedMacros.calories),
    protein: Math.max(0, targets.protein - lockedMacros.protein),
    carbs: Math.max(0, targets.carbs - lockedMacros.carbs),
    fat: Math.max(0, targets.fat - lockedMacros.fat),
  };

  // Detect seasonings by food_type OR name patterns
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

  const lockedList = lockedItems.length > 0
    ? lockedItems.map((item: any) => `- ${item.name}: ${item.quantity_grams}g (LOCKED – do not change)`).join('\n')
    : 'None';

  const foodList = freeItems.map((item: any) => {
    const isSeas = isSeasoningItem(item);
    const maxG = isSeas ? 15 : (item.max_portion_grams || 500);
    const minG = isSeas ? 5 : (item.min_portion_grams || 10);
    return `- ${item.name} (id: ${item.id}): ${item.calories_per_100g} kcal, ${item.protein_per_100g}g P, ${item.carbs_per_100g}g C, ${item.fat_per_100g}g F per 100g. Min: ${minG}g, Max: ${maxG}g. Meal: ${item.meal_type}.${isSeas ? ' ⚠️ SEASONING – MUST be 5-15g, never exceed 15g.' : ''}`;
  }).join('\n');

  const calTarget = Math.round(remainingTargets.calories);
  const pTarget = Math.round(remainingTargets.protein);
  const cTarget = Math.round(remainingTargets.carbs);
  const fTarget = Math.round(remainingTargets.fat);

  const systemPrompt = `You are a PRECISE meal portion calculator solving a constrained optimisation problem.

## STRICT Targets (remaining after locked items):
- Calories: MUST be between ${calTarget - 50} and ${calTarget} kcal (AT or BELOW ${calTarget}, never over)
- Protein: MUST be between ${pTarget - 2}g and ${pTarget}g (AT or BELOW ${pTarget}g, never over)
- Carbs: MUST be between ${cTarget - 2}g and ${cTarget}g (AT or BELOW ${cTarget}g, never over)
- Fat: MUST be between ${fTarget - 2}g and ${fTarget}g (AT or BELOW ${fTarget}g, never over)

CRITICAL RULES:
- NEVER exceed any target. Every total must be ≤ its target.
- Each total must be within the tolerance band (50kcal for calories, 2g for macros) BELOW the target.
- If you cannot satisfy all constraints, return the closest attempt.

## Locked items (do not change):
${lockedList}

## Available foods to portion:
${foodList}

## Method — follow this EXACTLY:
1. For each food, calculate nutrition per gram (per100g / 100).
2. Start with moderate portions. Calculate exact totals.
3. Compare totals to targets. Each must be: target - tolerance ≤ total ≤ target.
4. If a macro is OVER target, reduce the food that contributes most to that macro.
5. If a macro is UNDER the tolerance band, increase the food richest in that macro (without pushing others over).
6. Iterate adjustments until all 4 constraints pass.
7. Seasonings: HARD cap 5-15g. Never exceed 15g.
8. Round all portions to nearest 5g, then RE-VERIFY totals still pass.
9. Return ONLY the set_portions tool call.`;

  const tools = [
    {
      type: "function",
      function: {
        name: "set_portions",
        description: "Set the gram portions for each food item",
        parameters: {
          type: "object",
          properties: {
            portions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", description: "The item ID" },
                  quantity_grams: { type: "number", description: "Portion in grams" },
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

  // Helper: compute totals from portions (use precise floats)
  function computeTotals(portionList: Array<{ id: string; quantity_grams: number }>) {
    let cal = 0, p = 0, c = 0, f = 0;
    for (const portion of portionList) {
      const item = items.find((i: any) => i.id === portion.id);
      if (!item) continue;
      const factor = portion.quantity_grams / 100;
      cal += item.calories_per_100g * factor;
      p += item.protein_per_100g * factor;
      c += item.carbs_per_100g * factor;
      f += item.fat_per_100g * factor;
    }
    return { calories: Math.round(cal), protein: Math.round(p * 10) / 10, carbs: Math.round(c * 10) / 10, fat: Math.round(f * 10) / 10 };
  }

  // Helper: check constraints — totals must be ≤ target and within tolerance BELOW
  function meetsTargets(totals: { calories: number; protein: number; carbs: number; fat: number }) {
    const calOk = totals.calories <= calTarget && totals.calories >= calTarget - 50;
    const pOk = totals.protein <= pTarget && totals.protein >= pTarget - 2;
    const cOk = totals.carbs <= cTarget && totals.carbs >= cTarget - 2;
    const fOk = totals.fat <= fTarget && totals.fat >= fTarget - 2;
    return { calOk, pOk, cOk, fOk, allOk: calOk && pOk && cOk && fOk };
  }

  // Server-side refinement: adjust portions to fix constraint violations
  function refinePortions(portionList: Array<{ id: string; quantity_grams: number }>): Array<{ id: string; quantity_grams: number }> {
    const refined = portionList.map(p => ({ ...p }));
    const freeIds = new Set(freeItems.map((i: any) => i.id));

    for (let iter = 0; iter < 200; iter++) {
      const totals = computeTotals(refined);
      const check = meetsTargets(totals);
      if (check.allOk) break;

      // Find the worst violation
      type Macro = 'calories' | 'protein' | 'carbs' | 'fat';
      const violations: Array<{ macro: Macro; delta: number; over: boolean }> = [];
      
      if (totals.calories > calTarget) violations.push({ macro: 'calories', delta: totals.calories - calTarget, over: true });
      else if (totals.calories < calTarget - 50) violations.push({ macro: 'calories', delta: calTarget - 50 - totals.calories, over: false });
      
      if (totals.protein > pTarget) violations.push({ macro: 'protein', delta: totals.protein - pTarget, over: true });
      else if (totals.protein < pTarget - 2) violations.push({ macro: 'protein', delta: pTarget - 2 - totals.protein, over: false });
      
      if (totals.carbs > cTarget) violations.push({ macro: 'carbs', delta: totals.carbs - cTarget, over: true });
      else if (totals.carbs < cTarget - 2) violations.push({ macro: 'carbs', delta: cTarget - 2 - totals.carbs, over: false });
      
      if (totals.fat > fTarget) violations.push({ macro: 'fat', delta: totals.fat - fTarget, over: true });
      else if (totals.fat < fTarget - 2) violations.push({ macro: 'fat', delta: fTarget - 2 - totals.fat, over: false });

      if (violations.length === 0) break;

      // Sort by worst violation first
      violations.sort((a, b) => b.delta - a.delta);
      const worst = violations[0];

      // Map macro name to per100g field
      const per100gField: Record<Macro, string> = {
        calories: 'calories_per_100g',
        protein: 'protein_per_100g',
        carbs: 'carbs_per_100g',
        fat: 'fat_per_100g',
      };

      // Find best item to adjust (highest density in the violating macro, free only)
      let bestIdx = -1;
      let bestDensity = 0;
      for (let i = 0; i < refined.length; i++) {
        if (!freeIds.has(refined[i].id)) continue;
        const item = items.find((it: any) => it.id === refined[i].id);
        if (!item) continue;
        if (isSeasoningItem(item)) continue; // don't adjust seasonings
        const density = item[per100gField[worst.macro]] || 0;
        if (density <= 0) continue;

        if (worst.over) {
          // Need to decrease: item must have room to decrease
          const minG = item.min_portion_grams || 10;
          if (refined[i].quantity_grams <= minG) continue;
        } else {
          // Need to increase: item must have room to increase
          const maxG = item.max_portion_grams || 500;
          if (refined[i].quantity_grams >= maxG) continue;
        }

        if (density > bestDensity) {
          bestDensity = density;
          bestIdx = i;
        }
      }

      if (bestIdx === -1) break; // No adjustable items

      // Adjust by 5g
      if (worst.over) {
        refined[bestIdx].quantity_grams -= 5;
      } else {
        refined[bestIdx].quantity_grams += 5;
      }

      // Clamp
      const adjItem = items.find((it: any) => it.id === refined[bestIdx].id);
      if (adjItem) {
        const minG = adjItem.min_portion_grams || 10;
        const maxG = adjItem.max_portion_grams || 500;
        refined[bestIdx].quantity_grams = Math.max(minG, Math.min(maxG, refined[bestIdx].quantity_grams));
      }
    }

    return refined;
  }

  // Retry loop: up to 3 AI attempts
  let bestPortions: Array<{ id: string; quantity_grams: number }> = [];
  let bestTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const MAX_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let userMessage = "Calculate portions for these foods to hit the macro targets precisely. Every total MUST be ≤ target and within tolerance below. Use the set_portions tool.";
    
    if (attempt > 0) {
      const check = meetsTargets(bestTotals);
      const issues: string[] = [];
      if (!check.calOk) {
        if (bestTotals.calories > calTarget) issues.push(`Calories ${bestTotals.calories} EXCEEDS target ${calTarget} — REDUCE portions`);
        else issues.push(`Calories ${bestTotals.calories} is too far below target (min ${calTarget - 50})`);
      }
      if (!check.pOk) {
        if (bestTotals.protein > pTarget) issues.push(`Protein ${bestTotals.protein}g EXCEEDS target ${pTarget}g — REDUCE`);
        else issues.push(`Protein ${bestTotals.protein}g too far below (min ${pTarget - 2}g)`);
      }
      if (!check.cOk) {
        if (bestTotals.carbs > cTarget) issues.push(`Carbs ${bestTotals.carbs}g EXCEEDS target ${cTarget}g — REDUCE`);
        else issues.push(`Carbs ${bestTotals.carbs}g too far below (min ${cTarget - 2}g)`);
      }
      if (!check.fOk) {
        if (bestTotals.fat > fTarget) issues.push(`Fat ${bestTotals.fat}g EXCEEDS target ${fTarget}g — REDUCE`);
        else issues.push(`Fat ${bestTotals.fat}g too far below (min ${fTarget - 2}g)`);
      }
      
      userMessage = `WRONG. Totals: ${bestTotals.calories}kcal, ${bestTotals.protein}g P, ${bestTotals.carbs}g C, ${bestTotals.fat}g F.\nPROBLEMS:\n${issues.join('\n')}\n\nAll totals must be ≤ target and within tolerance below. Fix and use set_portions.`;
    }

    const aiData = await callAI({
      system: systemPrompt,
      userMessage,
      tools,
      toolChoice: { type: "function", function: { name: "set_portions" } },
    });

    console.log(`[claude-ai] attempt=${attempt + 1} provider=lovable-ai feature=meal_planner model=${AI_MODEL} usage=${JSON.stringify(aiData.usage || {})}`);

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) continue;

    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      continue;
    }

    if (!parsed.portions || !Array.isArray(parsed.portions)) continue;

    // Validate: cap seasonings, respect min/max
    const validatedPortions = parsed.portions.map((p: any) => {
      const item = items.find((i: any) => i.id === p.id);
      if (!item) return p;
      let qty = Math.round(p.quantity_grams / 5) * 5;
      const isSeas = isSeasoningItem(item);
      if (isSeas) {
        qty = Math.min(qty, 15);
        qty = Math.max(qty, 5);
      }
      const minG = isSeas ? 5 : (item.min_portion_grams || 0);
      const maxG = isSeas ? 15 : (item.max_portion_grams || 500);
      qty = Math.max(minG, Math.min(maxG, qty));
      return { id: p.id, quantity_grams: qty };
    });

    // Combine with locked items
    const allPortions = [
      ...lockedItems.map((item: any) => ({ id: item.id, quantity_grams: item.quantity_grams })),
      ...validatedPortions,
    ];

    // Server-side refinement loop to fix any remaining violations
    const refinedPortions = refinePortions(allPortions);
    const totals = computeTotals(refinedPortions);
    const check = meetsTargets(totals);

    bestPortions = refinedPortions;
    bestTotals = totals;

    if (check.allOk) {
      console.log(`[claude-ai] PASS attempt ${attempt + 1}: ${JSON.stringify(totals)}`);
      break;
    }
    
    console.log(`[claude-ai] attempt ${attempt + 1} after refinement: ${JSON.stringify(totals)} targets: cal≤${calTarget} p≤${pTarget} c≤${cTarget} f≤${fTarget}`);
  }

  // Final status
  const finalCheck = meetsTargets(bestTotals);
  if (!finalCheck.allOk) {
    console.warn(`[claude-ai] FAIL_CONSTRAINTS: ${JSON.stringify(bestTotals)} vs targets cal=${calTarget} p=${pTarget} c=${cTarget} f=${fTarget}`);
  }

  return {
    success: true,
    status: finalCheck.allOk ? 'PASS' : 'FAIL_CONSTRAINTS',
    portions: bestPortions,
    totals: bestTotals,
    tolerances_check: {
      kcal_ok: finalCheck.calOk,
      protein_ok: finalCheck.pOk,
      carbs_ok: finalCheck.cOk,
      fat_ok: finalCheck.fOk,
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
