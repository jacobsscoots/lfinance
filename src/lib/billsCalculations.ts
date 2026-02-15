/**
 * Bills Calculations Utility
 * Cost projections, savings calculations, and recommendation logic
 */

export interface SwitchRecommendation {
  recommend: boolean;
  reason: string;
  netSavings: number;
}

export interface EnergyProjection {
  monthlyEstimate: number;
  annualEstimate: number;
  averageDailyUsage: number;
  peakUsageDay: string | null;
}

/**
 * Calculate whether to recommend switching based on savings and preferences
 */
export function shouldSwitch(
  currentAnnualCost: number,
  bestOfferAnnualCost: number,
  exitFee: number,
  savingsThreshold: number,
  riskPreference: 'stable' | 'balanced' | 'lowest_cost',
  isBestOfferFixed: boolean
): SwitchRecommendation {
  const grossSavings = currentAnnualCost - bestOfferAnnualCost;
  const netSavings = grossSavings - exitFee;

  // Don't switch if net savings below threshold
  if (netSavings < savingsThreshold) {
    return {
      recommend: false,
      reason: `Net savings (£${netSavings.toFixed(0)}) below your £${savingsThreshold} threshold`,
      netSavings,
    };
  }

  // Risk preference adjustments
  if (riskPreference === 'stable' && !isBestOfferFixed) {
    return {
      recommend: false,
      reason: "Variable tariff doesn't match your preference for stable bills",
      netSavings,
    };
  }

  return {
    recommend: true,
    reason: `Switch to save £${netSavings.toFixed(0)}/year after exit fees`,
    netSavings,
  };
}

/**
 * Calculate estimated energy costs from readings
 */
export function calculateEnergyCost(
  consumptionKwh: number,
  unitRatePence: number,
  standingChargePence: number,
  days: number
): number {
  const unitCost = (consumptionKwh * unitRatePence) / 100;
  const standingCost = (standingChargePence * days) / 100;
  return unitCost + standingCost;
}

/**
 * Project annual energy costs from readings
 */
export function projectAnnualCost(
  readings: { consumption_kwh: number; reading_date: string }[],
  unitRatePence: number,
  standingChargePence: number
): EnergyProjection {
  if (readings.length === 0) {
    return {
      monthlyEstimate: 0,
      annualEstimate: 0,
      averageDailyUsage: 0,
      peakUsageDay: null,
    };
  }

  const totalKwh = readings.reduce((sum, r) => sum + Number(r.consumption_kwh), 0);
  const days = readings.length;
  const averageDailyUsage = totalKwh / days;

  // Find peak usage day
  let peakUsageDay: string | null = null;
  let maxUsage = 0;
  readings.forEach((r) => {
    if (Number(r.consumption_kwh) > maxUsage) {
      maxUsage = Number(r.consumption_kwh);
      peakUsageDay = r.reading_date;
    }
  });

  // Project to annual
  const annualKwh = averageDailyUsage * 365;
  const annualEstimate = calculateEnergyCost(annualKwh, unitRatePence, standingChargePence, 365);
  const monthlyEstimate = annualEstimate / 12;

  return {
    monthlyEstimate,
    annualEstimate,
    averageDailyUsage,
    peakUsageDay,
  };
}

/**
 * Calculate days until contract ends
 */
export function daysUntilContractEnd(endDate: string | null): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  const today = new Date();
  const diffTime = end.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate bill health score (0-100)
 * Based on how competitive the current deals are
 */
export function calculateBillHealthScore(
  services: {
    monthly_cost: number;
    estimated_savings_annual: number;
    last_recommendation: string | null;
  }[]
): number {
  if (services.length === 0) return 100;

  let score = 100;

  services.forEach((service) => {
    // Deduct points for potential savings
    const annualCost = service.monthly_cost * 12;
    const savingsPercent = annualCost > 0 
      ? (service.estimated_savings_annual / annualCost) * 100 
      : 0;

    // Deduct up to 25 points per service based on savings available
    score -= Math.min(25, savingsPercent);

    // Deduct extra if recommendation is to switch
    if (service.last_recommendation === 'switch') {
      score -= 10;
    }
  });

  return Math.max(0, Math.round(score));
}

/**
 * Get health score label
 */
export function getHealthScoreLabel(score: number): {
  label: string;
  color: string;
} {
  if (score >= 80) {
    return { label: 'Excellent', color: 'text-success' };
  } else if (score >= 60) {
    return { label: 'Good', color: 'text-primary' };
  } else if (score >= 40) {
    return { label: 'Fair', color: 'text-amber-500' };
  } else {
    return { label: 'Needs Attention', color: 'text-destructive' };
  }
}

/**
 * Format comparison site URL with pre-filled params
 */
export function getComparisonUrl(
  site: 'uswitch' | 'mse' | 'comparemarket',
  serviceType: 'energy' | 'broadband' | 'mobile',
  postcode?: string
): string {
  const urls: Record<string, Record<string, string>> = {
    uswitch: {
      energy: 'https://www.uswitch.com/gas-electricity/',
      broadband: 'https://www.uswitch.com/broadband/',
      mobile: 'https://www.uswitch.com/mobiles/',
    },
    mse: {
      energy: 'https://www.moneysavingexpert.com/cheapenergyclub/',
      broadband: 'https://www.moneysavingexpert.com/broadband-and-tv/',
      mobile: 'https://www.moneysavingexpert.com/phones/',
    },
    comparemarket: {
      energy: 'https://energy.comparethemarket.com/',
      broadband: 'https://www.comparethemarket.com/broadband/',
      mobile: 'https://www.comparethemarket.com/mobile-phones/',
    },
  };

  let url = urls[site]?.[serviceType] || 'https://www.uswitch.com/';

  // Some sites allow postcode in URL
  if (postcode && site === 'uswitch' && serviceType === 'energy') {
    url += `?postcode=${encodeURIComponent(postcode)}`;
  }

  return url;
}

/**
 * Generate ICS calendar content for contract end date reminder
 */
export function generateIcsContent(
  serviceName: string,
  provider: string,
  endDate: string,
  reminderDays: number = 30
): string {
  const end = new Date(endDate);
  const reminder = new Date(end);
  reminder.setDate(reminder.getDate() - reminderDays);

  const formatDate = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Lifehub//Cheaper Bills//EN
BEGIN:VEVENT
UID:${Date.now()}@lifetracker
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(reminder)}
DTEND:${formatDate(reminder)}
SUMMARY:${serviceName} contract ending soon - ${provider}
DESCRIPTION:Your ${serviceName} contract with ${provider} ends on ${end.toLocaleDateString()}. Time to compare deals!
END:VEVENT
END:VCALENDAR`;
}
