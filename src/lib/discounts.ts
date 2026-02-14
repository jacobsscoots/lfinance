// ============= Shared Discount Calculations =============
// Used by Groceries and Toiletries modules

export type DiscountType = "tesco_benefits" | "easysaver" | "clubcard" | "rewardgateway" | "none" | "other";

export interface DiscountCalculation {
  originalPrice: number;
  roundedPrice: number;
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
}

export interface MultiBuyOffer {
  buyQuantity: number;
  payQuantity: number;
  offerLabel: string;
}

const DISCOUNT_RATES: Record<DiscountType, number> = {
  tesco_benefits: 0.04, // 4%
  easysaver: 0.07,      // 7%
  clubcard: 0,          // Clubcard prices are pre-reduced
  rewardgateway: 0.10,  // 10% RewardGateway (MyProtein)
  none: 0,
  other: 0,
};

/**
 * Get the default discount type for a retailer.
 */
export function getDefaultRetailerDiscount(retailer: string): DiscountType {
  switch (retailer) {
    case "Tesco": return "tesco_benefits";
    case "Iceland": return "easysaver";
    case "MyProtein": return "rewardgateway";
    default: return "none";
  }
}

/**
 * Get allowed discount options for a retailer.
 */
export function getRetailerDiscountOptions(retailer: string): Array<{ value: DiscountType; label: string }> {
  const none = { value: "none" as DiscountType, label: "No discount" };
  switch (retailer) {
    case "Tesco":
      return [
        none,
        { value: "tesco_benefits", label: "Benefits on Tap (4%)" },
        { value: "clubcard", label: "Clubcard (pre-reduced)" },
      ];
    case "Iceland":
      return [
        none,
        { value: "easysaver", label: "EasySaver Card (7%)" },
      ];
    case "MyProtein":
      return [
        none,
        { value: "rewardgateway", label: "RewardGateway (10%)" },
      ];
    default:
      return [none];
  }
}

/**
 * Parse offer_label to detect multi-buy offers like "4 for 3", "3 for 2", "Buy 2 Get 1 Free"
 * 
 * @param offerLabel The offer description string
 * @returns MultiBuyOffer if detected, null otherwise
 */
export function parseMultiBuyOffer(offerLabel: string | null | undefined): MultiBuyOffer | null {
  if (!offerLabel) return null;
  
  const normalized = offerLabel.toLowerCase().trim();
  
  // Pattern: "X for Y" (e.g., "4 for 3", "3 for 2")
  const forPattern = /(\d+)\s*for\s*(?:the\s*price\s*of\s*)?(\d+)/i;
  const forMatch = normalized.match(forPattern);
  if (forMatch) {
    const buyQty = parseInt(forMatch[1], 10);
    const payQty = parseInt(forMatch[2], 10);
    if (buyQty > payQty && buyQty > 0 && payQty > 0) {
      return { buyQuantity: buyQty, payQuantity: payQty, offerLabel };
    }
  }
  
  // Pattern: "Buy X Get Y Free" (e.g., "Buy 2 Get 1 Free", "Buy 3 Get 1 Free")
  const bogofPattern = /buy\s*(\d+)\s*get\s*(\d+)\s*free/i;
  const bogofMatch = normalized.match(bogofPattern);
  if (bogofMatch) {
    const buyQty = parseInt(bogofMatch[1], 10);
    const freeQty = parseInt(bogofMatch[2], 10);
    if (buyQty > 0 && freeQty > 0) {
      return { buyQuantity: buyQty + freeQty, payQuantity: buyQty, offerLabel };
    }
  }
  
  // Pattern: "BOGOF" or "Buy One Get One Free"
  if (normalized.includes("bogof") || normalized.includes("buy one get one")) {
    return { buyQuantity: 2, payQuantity: 1, offerLabel };
  }
  
  // Pattern: "3 for £X" - this is a fixed price, not a multi-buy ratio
  // We don't handle this here as it needs the actual price
  
  return null;
}

/**
 * Calculate the effective unit price when multi-buy offer is applied.
 * 
 * @param unitPrice Price per single item
 * @param quantity Number of items being purchased
 * @param offer Multi-buy offer details
 * @returns Object with gross cost, discount amount, and final cost
 */
export function calculateMultiBuyPrice(
  unitPrice: number,
  quantity: number,
  offer: MultiBuyOffer | null
): { grossCost: number; discountAmount: number; finalCost: number } {
  const grossCost = unitPrice * quantity;
  
  if (!offer || quantity < offer.buyQuantity) {
    // Offer doesn't apply - not enough items
    return { grossCost, discountAmount: 0, finalCost: grossCost };
  }
  
  // Calculate how many complete offer sets we have
  const completeSets = Math.floor(quantity / offer.buyQuantity);
  const remainder = quantity % offer.buyQuantity;
  
  // Cost for complete sets (pay for payQuantity per set)
  const setCost = completeSets * offer.payQuantity * unitPrice;
  // Cost for remaining items at full price
  const remainderCost = remainder * unitPrice;
  
  const finalCost = setCost + remainderCost;
  const discountAmount = grossCost - finalCost;
  
  return {
    grossCost: Math.round(grossCost * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    finalCost: Math.round(finalCost * 100) / 100,
  };
}

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
