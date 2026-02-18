import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const compareInputSchema = z.object({
  serviceId: z.string().uuid().optional(),
  serviceType: z.string().max(50),
  currentMonthlyCost: z.number().min(0).max(100000).optional(),
  annualConsumptionKwh: z.number().min(0).max(1000000).optional().default(2900),
  currentTariff: z.object({
    unitRate: z.number().min(0).max(1000),
    standingCharge: z.number().min(0).max(1000),
  }).optional(),
  postcode: z.string().max(10).optional(),
  currentSpeedMbps: z.number().min(0).max(10000).optional(),
  currentDataGb: z.number().min(0).max(10000).optional(),
  preferredContractMonths: z.number().int().min(0).max(60).optional(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Octopus Energy API - public, no auth needed for tariff data
const OCTOPUS_API_BASE = 'https://api.octopus.energy/v1';

interface TariffComparison {
  provider: string;
  planName: string;
  monthlyCost: number;
  annualCost: number;
  savings: number;
  recommend: boolean;
  reason: string;
  source: string;
  features?: Record<string, any>;
  websiteUrl?: string;
  requiresEquipment?: string[];
}

interface EnergyProfile {
  has_heat_pump: boolean;
  has_electric_boiler: boolean;
  has_ev: boolean;
  has_solar: boolean;
  ownership_type: string | null;
}

// Provider website URLs
const PROVIDER_URLS: Record<string, string> = {
  // Energy
  'Octopus Energy': 'https://octopus.energy/smart/flexible-octopus/',
  'British Gas': 'https://www.britishgas.co.uk/energy.html',
  'EDF': 'https://www.edfenergy.com/gas-electricity',
  'E.ON Next': 'https://www.eonnext.com/',
  'Scottish Power': 'https://www.scottishpower.co.uk/gas-electricity/',
  'Ovo Energy': 'https://www.ovoenergy.com/energy-plans',
  'Shell Energy': 'https://www.shellenergy.co.uk/energy/electricity-gas',
  'Utility Warehouse': 'https://www.utilitywarehouse.co.uk/energy',
  // Broadband
  'BT': 'https://www.bt.com/broadband/',
  'Sky': 'https://www.sky.com/broadband/',
  'Virgin Media': 'https://www.virginmedia.com/broadband/',
  'Vodafone': 'https://www.vodafone.co.uk/broadband/',
  'Plusnet': 'https://www.plus.net/broadband/',
  'TalkTalk': 'https://www.talktalk.co.uk/broadband/',
  'NOW Broadband': 'https://www.nowtv.com/broadband',
  // Mobile
  'Three': 'https://www.three.co.uk/sim-only-plans',
  'Voxi': 'https://www.voxi.co.uk/plans/',
  'GiffGaff': 'https://www.giffgaff.com/sim-only-plans/',
  'EE': 'https://ee.co.uk/mobile/pay-monthly-plans',
  'O2': 'https://www.o2.co.uk/shop/sim-only',
  'iD Mobile': 'https://www.idmobile.co.uk/sim-only-deals',
  'Smarty': 'https://smarty.co.uk/sim-only-plans',
  'Lebara': 'https://www.lebara.co.uk/sim-only',
};

// Tariff eligibility requirements
const TARIFF_REQUIREMENTS: Record<string, { requires: string[]; description: string }> = {
  'Cosy Octopus': {
    requires: ['heat_pump_or_electric_boiler'],
    description: 'Requires a heat pump or electric boiler',
  },
  'Octopus Go': {
    requires: ['ev'],
    description: 'Designed for EV owners',
  },
  'Intelligent Octopus Go': {
    requires: ['ev'],
    description: 'Requires a compatible EV or charger',
  },
  'Octopus Flux': {
    requires: ['solar'],
    description: 'Requires solar panels with battery storage',
  },
};

function isEligibleForTariff(planName: string, profile: EnergyProfile | null): { eligible: boolean; reason?: string } {
  if (!profile) return { eligible: true }; // Can't filter without profile

  for (const [tariffPattern, req] of Object.entries(TARIFF_REQUIREMENTS)) {
    if (!planName.toLowerCase().includes(tariffPattern.toLowerCase())) continue;

    for (const requirement of req.requires) {
      switch (requirement) {
        case 'heat_pump_or_electric_boiler':
          if (!profile.has_heat_pump && !profile.has_electric_boiler) {
            return { eligible: false, reason: req.description };
          }
          break;
        case 'ev':
          if (!profile.has_ev) {
            return { eligible: false, reason: req.description };
          }
          break;
        case 'solar':
          if (!profile.has_solar) {
            return { eligible: false, reason: req.description };
          }
          break;
      }
    }
  }

  return { eligible: true };
}

// Market data for different service types (updated Feb 2026)
const BROADBAND_PLANS = [
  { provider: 'BT', planName: 'Fibre Essential', speed: 36, monthlyCost: 28.99, contract: 24, source: 'market_estimate' },
  { provider: 'BT', planName: 'Full Fibre 100', speed: 100, monthlyCost: 32.99, contract: 24, source: 'market_estimate' },
  { provider: 'BT', planName: 'Full Fibre 300', speed: 300, monthlyCost: 39.99, contract: 24, source: 'market_estimate' },
  { provider: 'BT', planName: 'Full Fibre 500', speed: 500, monthlyCost: 44.99, contract: 24, source: 'market_estimate' },
  { provider: 'Sky', planName: 'Superfast', speed: 59, monthlyCost: 27.00, contract: 18, source: 'market_estimate' },
  { provider: 'Sky', planName: 'Ultrafast', speed: 145, monthlyCost: 33.00, contract: 18, source: 'market_estimate' },
  { provider: 'Sky', planName: 'Gigafast', speed: 900, monthlyCost: 48.00, contract: 18, source: 'market_estimate' },
  { provider: 'Virgin Media', planName: 'M125', speed: 132, monthlyCost: 28.00, contract: 18, source: 'market_estimate' },
  { provider: 'Virgin Media', planName: 'M250', speed: 264, monthlyCost: 33.00, contract: 18, source: 'market_estimate' },
  { provider: 'Virgin Media', planName: 'M500', speed: 516, monthlyCost: 38.00, contract: 18, source: 'market_estimate' },
  { provider: 'Virgin Media', planName: 'Gig1', speed: 1130, monthlyCost: 46.00, contract: 18, source: 'market_estimate' },
  { provider: 'Vodafone', planName: 'Superfast 1', speed: 38, monthlyCost: 25.00, contract: 24, source: 'market_estimate' },
  { provider: 'Vodafone', planName: 'Pro Xtra', speed: 900, monthlyCost: 42.00, contract: 24, source: 'market_estimate' },
  { provider: 'Plusnet', planName: 'Unlimited Fibre', speed: 36, monthlyCost: 24.99, contract: 24, source: 'market_estimate' },
  { provider: 'Plusnet', planName: 'Full Fibre 300', speed: 300, monthlyCost: 32.99, contract: 24, source: 'market_estimate' },
  { provider: 'TalkTalk', planName: 'Fibre 35', speed: 38, monthlyCost: 24.95, contract: 18, source: 'market_estimate' },
  { provider: 'TalkTalk', planName: 'Fibre 500', speed: 500, monthlyCost: 36.00, contract: 18, source: 'market_estimate' },
  { provider: 'NOW Broadband', planName: 'Super Fibre', speed: 63, monthlyCost: 24.00, contract: 0, source: 'market_estimate' },
  { provider: 'NOW Broadband', planName: 'Fab Fibre', speed: 36, monthlyCost: 18.00, contract: 0, source: 'market_estimate' },
  { provider: 'Shell Energy', planName: 'Superfast Fibre', speed: 38, monthlyCost: 24.99, contract: 18, source: 'market_estimate' },
];

const MOBILE_PLANS = [
  { provider: 'Three', planName: '100GB 5G', data: 100, monthlyCost: 16.00, contract: 24, source: 'market_estimate' },
  { provider: 'Three', planName: 'Unlimited 5G', data: -1, monthlyCost: 24.00, contract: 24, source: 'market_estimate' },
  { provider: 'Voxi', planName: 'Unlimited Social', data: 45, monthlyCost: 10.00, contract: 0, source: 'market_estimate' },
  { provider: 'Voxi', planName: 'Unlimited Everything', data: -1, monthlyCost: 35.00, contract: 0, source: 'market_estimate' },
  { provider: 'GiffGaff', planName: '35GB Golden', data: 35, monthlyCost: 10.00, contract: 0, source: 'market_estimate' },
  { provider: 'GiffGaff', planName: 'Unlimited', data: -1, monthlyCost: 25.00, contract: 0, source: 'market_estimate' },
  { provider: 'EE', planName: '100GB 5G', data: 100, monthlyCost: 22.00, contract: 24, source: 'market_estimate' },
  { provider: 'EE', planName: 'Unlimited 5G', data: -1, monthlyCost: 34.00, contract: 24, source: 'market_estimate' },
  { provider: 'O2', planName: '100GB', data: 100, monthlyCost: 20.00, contract: 24, source: 'market_estimate' },
  { provider: 'O2', planName: 'Unlimited', data: -1, monthlyCost: 30.00, contract: 24, source: 'market_estimate' },
  { provider: 'Vodafone', planName: '100GB', data: 100, monthlyCost: 18.00, contract: 24, source: 'market_estimate' },
  { provider: 'Vodafone', planName: 'Unlimited', data: -1, monthlyCost: 28.00, contract: 24, source: 'market_estimate' },
  { provider: 'iD Mobile', planName: '100GB 5G', data: 100, monthlyCost: 12.00, contract: 24, source: 'market_estimate' },
  { provider: 'Smarty', planName: 'Unlimited', data: -1, monthlyCost: 20.00, contract: 0, source: 'market_estimate' },
  { provider: 'Lebara', planName: '25GB', data: 25, monthlyCost: 7.99, contract: 0, source: 'market_estimate' },
];

const ENERGY_RATES = [
  { provider: 'British Gas', planName: 'Flexible', unitRate: 24.5, standingCharge: 53.35, isFixed: false },
  { provider: 'EDF', planName: 'Simply Fixed', unitRate: 23.8, standingCharge: 51.20, isFixed: true },
  { provider: 'E.ON Next', planName: 'Next Online', unitRate: 24.1, standingCharge: 52.00, isFixed: false },
  { provider: 'Scottish Power', planName: 'Standard Variable', unitRate: 25.2, standingCharge: 54.10, isFixed: false },
  { provider: 'Octopus Energy', planName: 'Flexible Octopus', unitRate: 22.8, standingCharge: 49.85, isFixed: false },
  { provider: 'Octopus Energy', planName: 'Tracker', unitRate: 21.5, standingCharge: 49.85, isFixed: false },
  { provider: 'Ovo Energy', planName: 'Better Energy', unitRate: 23.5, standingCharge: 50.50, isFixed: true },
  { provider: 'Shell Energy', planName: 'Flexible', unitRate: 24.8, standingCharge: 52.75, isFixed: false },
  { provider: 'Utility Warehouse', planName: 'Gold', unitRate: 23.2, standingCharge: 51.00, isFixed: true },
];

async function scanEnergyDeals(
  userId: string,
  serviceId: string | undefined,
  annualConsumptionKwh: number,
  currentTariff: { unitRate: number; standingCharge: number } | undefined,
  savingsThreshold: number,
  riskPreference: string,
  energyProfile: EnergyProfile | null,
): Promise<TariffComparison[]> {
  const dailyKwh = annualConsumptionKwh / 365;
  const comparisons: TariffComparison[] = [];

  // Try fetching from Octopus API first
  try {
    const productsResponse = await fetch(
      `${OCTOPUS_API_BASE}/products/?is_variable=true&is_green=false&is_tracker=false&is_business=false`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (productsResponse.ok) {
      const products = await productsResponse.json();
      
      for (const product of products.results?.slice(0, 5) || []) {
        const displayName = product.display_name || product.code;

        // Check eligibility based on energy profile
        const eligibility = isEligibleForTariff(displayName, energyProfile);
        if (!eligibility.eligible) {
          console.log(`Skipping ${displayName}: ${eligibility.reason}`);
          continue;
        }

        try {
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

            const dailyCost = (dailyKwh * unitRate / 100) + (standingCharge / 100);
            const monthlyCost = dailyCost * 30;
            const annualCost = dailyCost * 365;

            comparisons.push({
              provider: 'Octopus Energy',
              planName: displayName,
              monthlyCost: Math.round(monthlyCost * 100) / 100,
              annualCost: Math.round(annualCost * 100) / 100,
              savings: 0, // calculated later
              recommend: false,
              reason: '',
              source: 'octopus_api',
              features: { unitRate, standingCharge, isFixed: !product.is_variable },
              websiteUrl: PROVIDER_URLS['Octopus Energy'],
            });
          }
        } catch (e) {
          console.log(`Skipping Octopus tariff ${product.code}:`, e);
        }
      }
    }
  } catch (e) {
    console.log('Octopus API error, using fallback rates:', e);
  }

  // Add market estimate rates (also filter for eligibility)
  for (const rate of ENERGY_RATES) {
    const eligibility = isEligibleForTariff(rate.planName, energyProfile);
    if (!eligibility.eligible) {
      console.log(`Skipping ${rate.planName}: ${eligibility.reason}`);
      continue;
    }

    const dailyCost = (dailyKwh * rate.unitRate / 100) + (rate.standingCharge / 100);
    const monthlyCost = dailyCost * 30;
    const annualCost = dailyCost * 365;

    // Skip if we already have this provider from API
    if (comparisons.some(c => c.provider === rate.provider && c.planName === rate.planName)) {
      continue;
    }

    comparisons.push({
      provider: rate.provider,
      planName: rate.planName,
      monthlyCost: Math.round(monthlyCost * 100) / 100,
      annualCost: Math.round(annualCost * 100) / 100,
      savings: 0,
      recommend: false,
      reason: '',
      source: 'market_estimate',
      features: { unitRate: rate.unitRate, standingCharge: rate.standingCharge, isFixed: rate.isFixed },
      websiteUrl: PROVIDER_URLS[rate.provider],
    });
  }

  // Calculate current annual cost
  let currentAnnualCost = 0;
  if (currentTariff) {
    const dailyCost = (dailyKwh * currentTariff.unitRate / 100) + (currentTariff.standingCharge / 100);
    currentAnnualCost = dailyCost * 365;
  } else {
    // Use average of all comparisons as baseline
    currentAnnualCost = comparisons.reduce((sum, c) => sum + c.annualCost, 0) / comparisons.length;
  }

  // Calculate savings and recommendations
  for (const comp of comparisons) {
    comp.savings = Math.round((currentAnnualCost - comp.annualCost) * 100) / 100;

    if (comp.savings < savingsThreshold) {
      comp.reason = `Net savings (£${comp.savings.toFixed(0)}) below your £${savingsThreshold} threshold`;
    } else if (riskPreference === 'stable' && !comp.features?.isFixed) {
      comp.reason = "Variable tariff doesn't match your preference for stable bills";
    } else if (comp.savings > 0) {
      comp.recommend = true;
      comp.reason = `Switch to save £${comp.savings.toFixed(0)}/year`;
    } else {
      comp.reason = 'No savings available with this plan';
    }
  }

  return comparisons.sort((a, b) => b.savings - a.savings);
}

function scanBroadbandDeals(
  currentMonthlyCost: number,
  savingsThreshold: number,
  currentSpeedMbps?: number,
  preferredContractMonths?: number
): TariffComparison[] {
  const currentAnnualCost = currentMonthlyCost * 12;

  return BROADBAND_PLANS
    .filter(plan => {
      // CRITICAL: Only show plans with same or better speed
      if (currentSpeedMbps && currentSpeedMbps > 0) {
        // Allow plans within 80% of current speed (minor speed differences are acceptable)
        const minAcceptableSpeed = currentSpeedMbps * 0.8;
        if (plan.speed < minAcceptableSpeed) return false;
      }
      return true;
    })
    .map(plan => {
      const annualCost = plan.monthlyCost * 12;
      const savings = Math.round((currentAnnualCost - annualCost) * 100) / 100;

      let recommend = false;
      let reason = '';

      const speedLabel = `${plan.speed}Mbps`;
      const contractLabel = plan.contract === 0 ? 'No contract' : `${plan.contract}mo contract`;

      if (savings < savingsThreshold) {
        reason = `Net savings (£${savings.toFixed(0)}) below your £${savingsThreshold} threshold`;
      } else if (preferredContractMonths && plan.contract > 0 && plan.contract > preferredContractMonths) {
        reason = `${contractLabel} exceeds your ${preferredContractMonths}mo preference (${speedLabel}, saves £${savings.toFixed(0)}/yr)`;
      } else if (savings > 0) {
        recommend = true;
        reason = `Switch to save £${savings.toFixed(0)}/year (${speedLabel}, ${contractLabel})`;
      } else {
        reason = 'No savings available with this plan';
      }

      return {
        provider: plan.provider,
        planName: plan.planName,
        monthlyCost: plan.monthlyCost,
        annualCost,
        savings,
        recommend,
        reason,
        source: plan.source,
        features: { speed: plan.speed, contract: plan.contract },
        websiteUrl: PROVIDER_URLS[plan.provider],
      };
    }).sort((a, b) => b.savings - a.savings);
}

function scanMobileDeals(
  currentMonthlyCost: number,
  savingsThreshold: number,
  currentDataGb?: number
): TariffComparison[] {
  const currentAnnualCost = currentMonthlyCost * 12;

  return MOBILE_PLANS
    .filter(plan => {
      // Only show plans with enough data for the user's usage
      if (currentDataGb && currentDataGb > 0) {
        // Unlimited plans (-1) always pass
        if (plan.data === -1) return true;
        // Plan must offer at least the user's current usage
        if (plan.data < currentDataGb) return false;
      }
      return true;
    })
    .map(plan => {
      const annualCost = plan.monthlyCost * 12;
      const savings = Math.round((currentAnnualCost - annualCost) * 100) / 100;

      let recommend = false;
      let reason = '';
      const dataLabel = plan.data === -1 ? 'Unlimited' : `${plan.data}GB`;

      if (savings < savingsThreshold) {
        reason = `Net savings (£${savings.toFixed(0)}) below your £${savingsThreshold} threshold`;
      } else if (savings > 0) {
        recommend = true;
        reason = `Switch to save £${savings.toFixed(0)}/year (${dataLabel} data)`;
      } else {
        reason = 'No savings available with this plan';
      }

      return {
        provider: plan.provider,
        planName: plan.planName,
        monthlyCost: plan.monthlyCost,
        annualCost,
        savings,
        recommend,
        reason,
        source: plan.source,
        features: { data: plan.data, contract: plan.contract },
        websiteUrl: PROVIDER_URLS[plan.provider],
      };
    }).sort((a, b) => b.savings - a.savings);
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

    const rawBody = await req.json();
    const parseResult = compareInputSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parseResult.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const {
      serviceId,
      serviceType,
      currentMonthlyCost,
      annualConsumptionKwh,
      currentTariff,
      postcode,
      currentSpeedMbps,
      currentDataGb,
      preferredContractMonths,
    } = parseResult.data;

    console.log(`Scanning ${serviceType} deals for user ${user.id}, serviceId: ${serviceId}, postcode: ${postcode}, speed: ${currentSpeedMbps}`);

    // Get user settings
    const { data: settings } = await supabase
      .from('cheaper_bills_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const savingsThreshold = settings?.savings_threshold || 50;
    const riskPreference = settings?.risk_preference || 'balanced';

    // Update postcode if provided
    if (postcode && postcode !== settings?.postcode) {
      await supabase
        .from('cheaper_bills_settings')
        .upsert({
          user_id: user.id,
          postcode,
          savings_threshold: savingsThreshold,
          risk_preference: riskPreference,
        }, { onConflict: 'user_id' });
    }

    // Fetch energy profile for eligibility filtering
    let energyProfile: EnergyProfile | null = null;
    if (serviceType === 'energy') {
      const { data: profileData } = await supabase
        .from('energy_profiles')
        .select('has_heat_pump, has_electric_boiler, has_ev, has_solar, ownership_type')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (profileData) {
        energyProfile = profileData as EnergyProfile;
        console.log(`Energy profile: heat_pump=${energyProfile.has_heat_pump}, electric_boiler=${energyProfile.has_electric_boiler}, ev=${energyProfile.has_ev}, solar=${energyProfile.has_solar}`);
      }
    }

    let comparisons: TariffComparison[] = [];

    switch (serviceType) {
      case 'energy':
        comparisons = await scanEnergyDeals(
          user.id,
          serviceId,
          annualConsumptionKwh,
          currentTariff,
          savingsThreshold,
          riskPreference,
          energyProfile,
        );
        break;
      case 'broadband':
        comparisons = scanBroadbandDeals(currentMonthlyCost ?? 0, savingsThreshold, currentSpeedMbps, preferredContractMonths);
        break;
      case 'mobile':
        comparisons = scanMobileDeals(currentMonthlyCost ?? 0, savingsThreshold, currentDataGb);
        break;
      default: {
        const fallbackCost = currentMonthlyCost ?? 0;
        comparisons = [{
          provider: 'Market Average',
          planName: 'Comparison',
          monthlyCost: fallbackCost * 0.9,
          annualCost: fallbackCost * 0.9 * 12,
          savings: fallbackCost * 0.1 * 12,
          recommend: fallbackCost * 0.1 * 12 >= savingsThreshold,
          reason: 'Review market for potential 10% savings',
          source: 'estimate',
        }];
      }
    }

    // Store top results in database with proper error handling
    const bestOffers = comparisons.slice(0, 5);
    let storedCount = 0;
    const upsertErrors: string[] = [];

    // First, clear old results for this service/user combo to avoid stale data
    const { error: deleteError } = await supabase
      .from('comparison_results')
      .delete()
      .eq('user_id', user.id)
      .eq('service_type', serviceType)
      .eq('tracked_service_id', serviceId || null);

    if (deleteError) {
      console.warn('Error clearing old results:', deleteError.message);
    }

    // Insert new results
    for (let i = 0; i < bestOffers.length; i++) {
      const offer = bestOffers[i];
      const { error: upsertError } = await supabase
        .from('comparison_results')
        .insert({
          user_id: user.id,
          tracked_service_id: serviceId || null,
          service_type: serviceType,
          provider: offer.provider,
          plan_name: offer.planName || '',
          monthly_cost: offer.monthlyCost,
          annual_cost: offer.annualCost,
          features: offer.features || {},
          source: offer.source,
          scanned_at: new Date().toISOString(),
          is_best_offer: i === 0, // First one is best offer
          website_url: offer.websiteUrl || null,
        });

      if (upsertError) {
        console.error('Error storing comparison result:', upsertError.message);
        upsertErrors.push(`${offer.provider}: ${upsertError.message}`);
      } else {
        storedCount++;
      }
    }

    console.log(`Stored ${storedCount}/${bestOffers.length} comparison results`);
    if (upsertErrors.length > 0) {
      console.warn('Upsert errors:', upsertErrors);
    }

    // Update service with scan results
    if (serviceId && bestOffers.length > 0) {
      const best = bestOffers[0];
      const { error: updateError } = await supabase
        .from('tracked_services')
        .update({
          last_scan_date: new Date().toISOString(),
          last_recommendation: best.recommend ? 'switch' : 'dont_switch',
          last_recommendation_reason: best.reason,
          estimated_savings_annual: best.savings > 0 ? best.savings : 0,
        })
        .eq('id', serviceId);

      if (updateError) {
        console.error('Error updating tracked service:', updateError.message);
      }
    }

    const bestOffer = bestOffers[0] || null;

    return new Response(
      JSON.stringify({
        success: true,
        serviceType,
        comparisons: bestOffers,
        bestOffer: bestOffer ? {
          provider: bestOffer.provider,
          planName: bestOffer.planName,
          savings: bestOffer.savings,
          recommend: bestOffer.recommend,
          websiteUrl: bestOffer.websiteUrl,
        } : null,
        scannedAt: new Date().toISOString(),
        storedCount,
        errors: upsertErrors.length > 0 ? upsertErrors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Compare energy deals error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
