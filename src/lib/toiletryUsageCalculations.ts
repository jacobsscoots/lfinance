import { differenceInDays } from "date-fns";

// Re-export discount types and functions from shared module
export {
  type DiscountType,
  type DiscountCalculation,
  calculateLoyaltyDiscount,
  calculateTotalSavings,
  calculateActualMonthlySpend,
} from "./discounts";

// ============= Toiletry-specific Types =============

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
  
  // Empty weight — always allowed (records packaging weight and marks finished)
  
  // Regular reading is always allowed (no full weight prerequisite)
  
  return { valid: true };
}

// ============= Spend Calculations (Toiletry-specific) =============

export interface MonthlySpendSummary {
  actual: number;
  forecasted: number;
  savings: number;
  byCategory: Record<string, { actual: number; forecasted: number }>;
}
