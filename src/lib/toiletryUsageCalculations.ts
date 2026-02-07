import { differenceInDays } from "date-fns";

// ============= Types =============

export type DiscountType = "tesco_benefits" | "easysaver" | "clubcard" | "none" | "other";

export interface DiscountCalculation {
  originalPrice: number;
  roundedPrice: number;
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
}

export interface WeightReading {
  weight: number;
  readingType: "full" | "regular" | "empty";
  recordedAt: Date;
}

export interface UsageRateResult {
  usageRatePerDay: number | null;
  remainingGrams: number;
  daysRemaining: number | null;
  source: "weight_based" | "manual";
}

// ============= Discount Calculations =============

const DISCOUNT_RATES: Record<DiscountType, number> = {
  tesco_benefits: 0.04, // 4%
  easysaver: 0.07,      // 7%
  clubcard: 0,          // Clubcard prices are pre-reduced
  none: 0,
  other: 0,
};

/**
 * Calculate loyalty discount using the "round up then apply" rule.
 * 
 * IMPORTANT: This matches Tesco Benefits on Tap & EasySaver behaviour:
 * - Round the price UP to the nearest £1
 * - Calculate discount on the rounded price
 * - Subtract discount from the ORIGINAL price
 */
export function calculateLoyaltyDiscount(
  price: number,
  discountType: DiscountType
): DiscountCalculation {
  const discountPercent = DISCOUNT_RATES[discountType] ?? 0;
  
  // Round UP to nearest £1 before applying discount
  const roundedPrice = Math.ceil(price);
  
  // Discount is calculated on the rounded price
  const discountAmount = roundedPrice * discountPercent;
  
  // But subtracted from the original price
  const finalPrice = Math.max(0, price - discountAmount);
  
  return {
    originalPrice: price,
    roundedPrice,
    discountPercent,
    discountAmount,
    finalPrice: Math.round(finalPrice * 100) / 100, // Round to 2 decimal places
  };
}

// ============= Usage Rate Calculations =============

/**
 * Calculate usage rate from two weight readings.
 * Returns null if calculation is not possible.
 */
export function calculateUsageRate(
  previousWeight: number,
  currentWeight: number,
  daysBetween: number
): number | null {
  if (daysBetween <= 0) return null;
  
  const used = previousWeight - currentWeight;
  if (used <= 0) return null;
  
  return used / daysBetween;
}

/**
 * Calculate remaining product amount from current scale weight.
 * remaining = current_weight - empty_packaging_weight
 */
export function calculateRemainingFromWeight(
  currentWeightGrams: number,
  emptyWeightGrams: number
): number {
  return Math.max(0, currentWeightGrams - emptyWeightGrams);
}

/**
 * Calculate comprehensive usage data for a toiletry item with weight tracking.
 * 
 * Priority order for usage rate:
 * 1. Weight-based calculation (if we have previous and current readings)
 * 2. Full weight to current (if we have full weight and current weight)
 * 3. Manual rate (fallback)
 */
export function calculateWeightBasedUsage(
  fullWeightGrams: number | null,
  currentWeightGrams: number | null,
  emptyWeightGrams: number,
  openedAt: Date | null,
  lastWeighedAt: Date | null,
  manualUsageRate: number
): UsageRateResult {
  // If no weight data, fall back to manual rate
  if (currentWeightGrams === null) {
    return {
      usageRatePerDay: manualUsageRate,
      remainingGrams: 0,
      daysRemaining: null,
      source: "manual",
    };
  }

  const remainingGrams = calculateRemainingFromWeight(currentWeightGrams, emptyWeightGrams);
  
  // Try to calculate usage rate from weight data
  let usageRatePerDay: number | null = null;
  
  if (fullWeightGrams !== null && openedAt !== null) {
    const startingAmount = fullWeightGrams - emptyWeightGrams;
    const usedAmount = startingAmount - remainingGrams;
    
    // Use last weighed date or today for calculation
    const endDate = lastWeighedAt ?? new Date();
    const daysSinceOpened = differenceInDays(endDate, openedAt);
    
    if (daysSinceOpened > 0 && usedAmount > 0) {
      usageRatePerDay = usedAmount / daysSinceOpened;
    }
  }
  
  // If we couldn't calculate, use manual rate
  if (usageRatePerDay === null || usageRatePerDay <= 0) {
    usageRatePerDay = manualUsageRate;
  }
  
  // Calculate days remaining
  const daysRemaining = usageRatePerDay > 0 
    ? Math.max(0, remainingGrams / usageRatePerDay)
    : null;
  
  return {
    usageRatePerDay,
    remainingGrams,
    daysRemaining,
    source: fullWeightGrams !== null ? "weight_based" : "manual",
  };
}

/**
 * Validate weight logging rules.
 * 
 * Core rules:
 * - full_weight can only be set once per active item
 * - empty_weight can only be logged after full is set
 * - Logging empty locks further weight logs
 */
export function validateWeightLog(
  readingType: "full" | "regular" | "empty",
  existingFullWeight: number | null,
  existingFinishedAt: Date | null
): { valid: boolean; error?: string } {
  // If item is already finished, no more weight logs allowed
  if (existingFinishedAt !== null) {
    return {
      valid: false,
      error: "This item has been marked as finished. Create a new item to track usage.",
    };
  }
  
  // Full weight can only be set once
  if (readingType === "full" && existingFullWeight !== null) {
    return {
      valid: false,
      error: "Full weight has already been recorded for this item.",
    };
  }
  
  // Empty weight requires full weight to be set first
  if (readingType === "empty" && existingFullWeight === null) {
    return {
      valid: false,
      error: "Please log the full weight first before marking as empty.",
    };
  }
  
  // Regular reading requires full weight to be set first
  if (readingType === "regular" && existingFullWeight === null) {
    return {
      valid: false,
      error: "Please log the full weight when opening the item first.",
    };
  }
  
  return { valid: true };
}

// ============= Spend Calculations =============

export interface MonthlySpendSummary {
  actual: number;
  forecasted: number;
  savings: number;
  byCategory: Record<string, { actual: number; forecasted: number }>;
}

/**
 * Calculate monthly spend from purchase history.
 */
export function calculateActualMonthlySpend(
  purchases: Array<{ final_price: number; purchase_date: string }>,
  monthsToAverage: number = 12
): number {
  if (purchases.length === 0) return 0;
  
  const now = new Date();
  const cutoffDate = new Date(now);
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsToAverage);
  
  const recentPurchases = purchases.filter(
    (p) => new Date(p.purchase_date) >= cutoffDate
  );
  
  if (recentPurchases.length === 0) return 0;
  
  const totalSpend = recentPurchases.reduce((sum, p) => sum + p.final_price, 0);
  
  // Calculate actual months covered
  const oldestPurchase = recentPurchases.reduce(
    (oldest, p) => {
      const date = new Date(p.purchase_date);
      return date < oldest ? date : oldest;
    },
    new Date()
  );
  
  const monthsCovered = Math.max(1, 
    (now.getTime() - oldestPurchase.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );
  
  return totalSpend / monthsCovered;
}

/**
 * Calculate total discount savings from purchases.
 */
export function calculateTotalSavings(
  purchases: Array<{ discount_amount: number }>
): number {
  return purchases.reduce((sum, p) => sum + (p.discount_amount ?? 0), 0);
}
