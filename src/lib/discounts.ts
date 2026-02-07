// ============= Shared Discount Calculations =============
// Used by Groceries and Toiletries modules

export type DiscountType = "tesco_benefits" | "easysaver" | "clubcard" | "none" | "other";

export interface DiscountCalculation {
  originalPrice: number;
  roundedPrice: number;
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
}

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
 * 
 * @param price Original price before discount
 * @param discountType Type of discount to apply
 * @returns Discount calculation with original, rounded, discount amount and final price
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

/**
 * Apply basket-level discount (sum retailer subtotal, apply once).
 * This is the default mode for grocery calculations.
 * 
 * @param subtotal Total cost before discount
 * @param discountType Type of discount to apply
 * @returns Discount calculation
 */
export function calculateBasketDiscount(
  subtotal: number,
  discountType: DiscountType
): DiscountCalculation {
  return calculateLoyaltyDiscount(subtotal, discountType);
}

/**
 * Calculate total savings from a list of purchases.
 */
export function calculateTotalSavings(
  purchases: Array<{ discount_amount?: number | null }>
): number {
  return purchases.reduce((sum, p) => sum + (p.discount_amount ?? 0), 0);
}

/**
 * Calculate monthly spend from purchase history.
 */
export function calculateActualMonthlySpend(
  purchases: Array<{ final_cost?: number | null; purchase_date: string }>,
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
  
  const totalSpend = recentPurchases.reduce((sum, p) => sum + (p.final_cost ?? 0), 0);
  
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

// Common retailer options
export const RETAILER_OPTIONS = [
  "Tesco",
  "Sainsbury's", 
  "ASDA",
  "Morrisons",
  "Aldi",
  "Lidl",
  "Iceland",
  "MyProtein",
  "Amazon",
  "Other",
] as const;

export type Retailer = typeof RETAILER_OPTIONS[number] | string;
