import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Octopus Energy API - public, no auth needed for tariff data
const OCTOPUS_API_BASE = 'https://api.octopus.energy/v1';

interface TariffComparison {
  provider: string;
  planName: string;
  unitRate: number; // p/kWh
  standingCharge: number; // p/day
  estimatedMonthlyCost: number;
  estimatedAnnualCost: number;
  isFixed: boolean;
  source: string;
}

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

    const { annualConsumptionKwh, currentTariff, serviceId } = await req.json();

    // Calculate daily and monthly consumption
    const dailyKwh = annualConsumptionKwh / 365;
    const monthlyKwh = annualConsumptionKwh / 12;

    // Fetch Octopus Energy tariffs (public API)
    const comparisons: TariffComparison[] = [];

    try {
      // Fetch available products from Octopus
      const productsResponse = await fetch(
        `${OCTOPUS_API_BASE}/products/?is_variable=true&is_green=false&is_tracker=false&is_business=false`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (productsResponse.ok) {
        const products = await productsResponse.json();
        
        // Get standard variable tariff (SVT) rates
        for (const product of products.results?.slice(0, 5) || []) {
          try {
            // Fetch electricity rates for a sample region (London - _C)
            const ratesResponse = await fetch(
              `${OCTOPUS_API_BASE}/products/${product.code}/electricity-tariffs/E-1R-${product.code}-C/standard-unit-rates/`,
              { headers: { 'Accept': 'application/json' } }
            );

            const standingResponse = await fetch(
              `${OCTOPUS_API_BASE}/products/${product.code}/electricity-tariffs/E-1R-${product.code}-C/standing-charges/`,
              { headers: { 'Accept': 'application/json' } }
            );

            if (ratesResponse.ok && standingResponse.ok) {
              const rates = await ratesResponse.json();
              const standing = await standingResponse.json();

              const unitRate = rates.results?.[0]?.value_inc_vat || 0;
              const standingCharge = standing.results?.[0]?.value_inc_vat || 0;

              // Calculate costs
              const dailyCost = (dailyKwh * unitRate / 100) + (standingCharge / 100);
              const monthlyCost = dailyCost * 30;
              const annualCost = dailyCost * 365;

              comparisons.push({
                provider: 'Octopus Energy',
                planName: product.display_name || product.code,
                unitRate,
                standingCharge,
                estimatedMonthlyCost: Math.round(monthlyCost * 100) / 100,
                estimatedAnnualCost: Math.round(annualCost * 100) / 100,
                isFixed: !product.is_variable,
                source: 'octopus_api',
              });
            }
          } catch (e) {
            // Skip this tariff if we can't get rates
            console.log(`Skipping tariff ${product.code}:`, e);
          }
        }
      }
    } catch (e) {
      console.log('Octopus API error, using fallback rates:', e);
    }

    // Add some typical market rates as fallback/comparison
    const typicalRates = [
      { provider: 'British Gas', planName: 'Flexible', unitRate: 24.5, standingCharge: 53.35, isFixed: false },
      { provider: 'EDF', planName: 'Simply Fixed', unitRate: 23.8, standingCharge: 51.20, isFixed: true },
      { provider: 'E.ON Next', planName: 'Next Online', unitRate: 24.1, standingCharge: 52.00, isFixed: false },
      { provider: 'Scottish Power', planName: 'Standard Variable', unitRate: 25.2, standingCharge: 54.10, isFixed: false },
    ];

    for (const rate of typicalRates) {
      const dailyCost = (dailyKwh * rate.unitRate / 100) + (rate.standingCharge / 100);
      const monthlyCost = dailyCost * 30;
      const annualCost = dailyCost * 365;

      comparisons.push({
        ...rate,
        estimatedMonthlyCost: Math.round(monthlyCost * 100) / 100,
        estimatedAnnualCost: Math.round(annualCost * 100) / 100,
        source: 'market_estimate',
      });
    }

    // Sort by annual cost
    comparisons.sort((a, b) => a.estimatedAnnualCost - b.estimatedAnnualCost);

    // Calculate current cost
    let currentAnnualCost = 0;
    if (currentTariff) {
      const dailyCost = (dailyKwh * currentTariff.unitRate / 100) + (currentTariff.standingCharge / 100);
      currentAnnualCost = dailyCost * 365;
    }

    // Get user settings for recommendation
    const { data: settings } = await supabase
      .from('cheaper_bills_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const savingsThreshold = settings?.savings_threshold || 50;
    const riskPreference = settings?.risk_preference || 'balanced';

    // Generate recommendations
    const recommendations = comparisons.map(comp => {
      const grossSavings = currentAnnualCost - comp.estimatedAnnualCost;
      const netSavings = grossSavings; // Would subtract exit fee if known

      let recommend = false;
      let reason = '';

      if (netSavings < savingsThreshold) {
        reason = `Net savings (£${netSavings.toFixed(0)}) below your £${savingsThreshold} threshold`;
      } else if (riskPreference === 'stable' && !comp.isFixed) {
        reason = "Variable tariff doesn't match your preference for stable bills";
      } else {
        recommend = true;
        reason = `Switch to save £${netSavings.toFixed(0)}/year`;
      }

      return {
        ...comp,
        savings: Math.round(grossSavings * 100) / 100,
        recommend,
        reason,
      };
    });

    // Store top results in database
    const bestOffers = recommendations.slice(0, 5);
    for (const offer of bestOffers) {
      await supabase
        .from('comparison_results')
        .upsert({
          user_id: user.id,
          tracked_service_id: serviceId || null,
          service_type: 'energy',
          provider: offer.provider,
          plan_name: offer.planName,
          monthly_cost: offer.estimatedMonthlyCost,
          annual_cost: offer.estimatedAnnualCost,
          features: {
            unitRate: offer.unitRate,
            standingCharge: offer.standingCharge,
            isFixed: offer.isFixed,
          },
          source: offer.source,
          scanned_at: new Date().toISOString(),
          is_best_offer: offer === bestOffers[0],
        }, {
          onConflict: 'user_id,provider,plan_name',
          ignoreDuplicates: false,
        });
    }

    // Update service with scan results
    if (serviceId && bestOffers.length > 0) {
      const best = bestOffers[0];
      await supabase
        .from('tracked_services')
        .update({
          last_scan_date: new Date().toISOString(),
          last_recommendation: best.recommend ? 'switch' : 'dont_switch',
          last_recommendation_reason: best.reason,
          estimated_savings_annual: best.savings > 0 ? best.savings : 0,
        })
        .eq('id', serviceId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        currentAnnualCost: Math.round(currentAnnualCost * 100) / 100,
        comparisons: recommendations,
        bestOffer: recommendations[0],
        scannedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Compare energy deals error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
