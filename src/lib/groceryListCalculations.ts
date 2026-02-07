import { Product } from "@/hooks/useProducts";
import { MealPlan } from "@/hooks/useMealPlanItems";
import { generateGroceryList, GroceryItem } from "./mealCalculations";
import { calculateBasketDiscount, DiscountType, parseMultiBuyOffer, calculateMultiBuyPrice, MultiBuyOffer } from "./discounts";

// ============= Types =============

export interface ShopReadyItem {
  product: Product;
  retailer: string;
  
  // From meal plan
  requiredGrams: number;
  
  // Stock calculations
  stockOnHandGrams: number;
  netNeededGrams: number;
  
  // Purchase calculations
  purchasePacks: number;
  packNetGrams: number;
  
  // Cost calculations (per item, before basket discount)
  grossCost: number;
  
  // Multi-buy offer (if applicable)
  multiBuyOffer: MultiBuyOffer | null;
  multiBuyDiscount: number;
  costAfterMultiBuy: number;
}

export interface RetailerGroup {
  retailer: string;
  items: ShopReadyItem[];
  subtotal: number;
  multiBuyDiscount: number;
  subtotalAfterMultiBuy: number;
  discountType: DiscountType;
  loyaltyDiscountAmount: number;
  finalTotal: number;
  // Legacy field for backwards compatibility
  discountAmount: number;
}

export interface ShopReadyList {
  byRetailer: RetailerGroup[];
  alreadyCovered: ShopReadyItem[];
  totals: {
    grossCost: number;
    multiBuyDiscount: number;
    loyaltyDiscount: number;
    totalDiscount: number;
    finalCost: number;
    itemCount: number;
  };
}

// ============= Core Logic =============

/**
 * Calculate net usable grams per pack.
 * netPackGrams = max(0, pack_size_grams - packaging_weight_grams)
 * Falls back to pack_size_grams if packaging_weight is not set.
 */
function calculateNetPackGrams(product: Product): number {
  const packSize = product.pack_size_grams ?? 0;
  const packagingWeight = product.packaging_weight_grams ?? 0;
  
  // Ensure we never return negative
  const netGrams = Math.max(0, packSize - packagingWeight);
  
  // If no pack size, return 0 (will be handled by fallback)
  return netGrams;
}

/**
 * Calculate stock on hand in grams.
 * Uses both quantity_on_hand and quantity_in_use as available stock.
 * 
 * stockGrams = (quantity_on_hand + quantity_in_use) * netPackGrams
 */
function calculateStockGrams(product: Product, netPackGrams: number): number {
  const onHand = product.quantity_on_hand ?? 0;
  const inUse = product.quantity_in_use ?? 0;
  
  // Both on-hand and in-use count as available stock
  const totalPacks = onHand + inUse;
  
  return totalPacks * netPackGrams;
}

/**
 * Generate a shop-ready grocery list from meal plans.
 * 
 * This function wraps the existing generateGroceryList() and adds:
 * - Stock subtraction (using inventory fields)
 * - Retailer grouping
 * - Basket-level discount calculation per retailer
 * 
 * IMPORTANT: Does not modify the original generateGroceryList() function.
 */
export function generateShopReadyList(
  plans: MealPlan[],
  products: Product[],
  retailerDiscounts: Record<string, DiscountType> = {}
): ShopReadyList {
  // Get base grocery list from meal plan (unchanged function)
  const baseList = generateGroceryList(plans);
  
  // Create product lookup for additional fields
  const productLookup = new Map<string, Product>();
  for (const product of products) {
    productLookup.set(product.id, product);
  }
  
  const byRetailerMap = new Map<string, ShopReadyItem[]>();
  const alreadyCovered: ShopReadyItem[] = [];
  
  for (const item of baseList) {
    // Get full product data (with inventory fields)
    const product = productLookup.get(item.product.id) ?? item.product;
    
    // Calculate net usable grams per pack
    let packNetGrams = calculateNetPackGrams(product);
    
    // Fallback: if packNetGrams is 0, use pack_size_grams directly or required grams
    if (packNetGrams <= 0) {
      packNetGrams = product.pack_size_grams ?? item.requiredGrams;
    }
    
    // Calculate stock on hand in grams
    const stockOnHandGrams = calculateStockGrams(product, packNetGrams);
    
    // Calculate net needed grams after subtracting stock
    const netNeededGrams = Math.max(0, item.requiredGrams - stockOnHandGrams);
    
    // Get retailer (default from product or 'Unassigned')
    const retailer = product.retailer || "Unassigned";
    
    // Parse multi-buy offer from offer_label
    const multiBuyOffer = parseMultiBuyOffer(product.offer_label);
    
    // Create shop ready item
    const shopItem: ShopReadyItem = {
      product,
      retailer,
      requiredGrams: item.requiredGrams,
      stockOnHandGrams,
      netNeededGrams,
      purchasePacks: 0,
      packNetGrams,
      grossCost: 0,
      multiBuyOffer,
      multiBuyDiscount: 0,
      costAfterMultiBuy: 0,
    };
    
    // Check if fully covered by stock
    if (netNeededGrams === 0) {
      alreadyCovered.push(shopItem);
      continue;
    }
    
    // Calculate purchase quantity
    if (packNetGrams > 0) {
      shopItem.purchasePacks = Math.ceil(netNeededGrams / packNetGrams);
    } else {
      // Fallback for items without pack size
      shopItem.purchasePacks = 1;
    }
    
    // Calculate gross cost (before any discount)
    shopItem.grossCost = shopItem.purchasePacks * product.price;
    
    // Apply multi-buy discount if applicable
    const multiBuyResult = calculateMultiBuyPrice(product.price, shopItem.purchasePacks, multiBuyOffer);
    shopItem.multiBuyDiscount = multiBuyResult.discountAmount;
    shopItem.costAfterMultiBuy = multiBuyResult.finalCost;
    
    // Group by retailer
    if (!byRetailerMap.has(retailer)) {
      byRetailerMap.set(retailer, []);
    }
    byRetailerMap.get(retailer)!.push(shopItem);
  }
  
  // Calculate totals and apply basket-level discounts per retailer
  const byRetailer: RetailerGroup[] = [];
  let totalGrossCost = 0;
  let totalMultiBuyDiscount = 0;
  let totalLoyaltyDiscount = 0;
  let totalFinalCost = 0;
  let totalItemCount = 0;
  
  for (const [retailer, items] of byRetailerMap) {
    // Gross subtotal before any discounts
    const subtotal = items.reduce((sum, item) => sum + item.grossCost, 0);
    
    // Multi-buy discounts for this retailer
    const multiBuyDiscount = items.reduce((sum, item) => sum + item.multiBuyDiscount, 0);
    
    // Subtotal after multi-buy (this is what loyalty discount applies to)
    const subtotalAfterMultiBuy = subtotal - multiBuyDiscount;
    
    const discountType = retailerDiscounts[retailer] ?? "none";
    
    // Apply basket-level loyalty discount on subtotal AFTER multi-buy
    const loyaltyResult = calculateBasketDiscount(subtotalAfterMultiBuy, discountType);
    
    const group: RetailerGroup = {
      retailer,
      items,
      subtotal,
      multiBuyDiscount,
      subtotalAfterMultiBuy,
      discountType,
      loyaltyDiscountAmount: loyaltyResult.discountAmount,
      finalTotal: loyaltyResult.finalPrice,
      // Legacy field for backwards compatibility
      discountAmount: multiBuyDiscount + loyaltyResult.discountAmount,
    };
    
    byRetailer.push(group);
    
    totalGrossCost += subtotal;
    totalMultiBuyDiscount += multiBuyDiscount;
    totalLoyaltyDiscount += loyaltyResult.discountAmount;
    totalFinalCost += loyaltyResult.finalPrice;
    totalItemCount += items.length;
  }
  
  // Sort retailers: Unassigned last, then alphabetically
  byRetailer.sort((a, b) => {
    if (a.retailer === "Unassigned") return 1;
    if (b.retailer === "Unassigned") return -1;
    return a.retailer.localeCompare(b.retailer);
  });
  
  return {
    byRetailer,
    alreadyCovered,
    totals: {
      grossCost: totalGrossCost,
      multiBuyDiscount: totalMultiBuyDiscount,
      loyaltyDiscount: totalLoyaltyDiscount,
      totalDiscount: totalMultiBuyDiscount + totalLoyaltyDiscount,
      finalCost: totalFinalCost,
      itemCount: totalItemCount,
    },
  };
}

/**
 * Calculate forecasted weekly spend from shop-ready list.
 */
export function calculateForecastedWeeklySpend(shopList: ShopReadyList): number {
  return shopList.totals.finalCost;
}

/**
 * Calculate forecasted monthly spend (weekly * 4.33).
 * Note: This is an estimate. Actual monthly spend should come from purchases.
 */
export function calculateForecastedMonthlySpend(shopList: ShopReadyList): number {
  return shopList.totals.finalCost * 4.33;
}

/**
 * Get products that need reordering based on meal plan requirements and stock.
 */
export function getReorderAlerts(shopList: ShopReadyList): ShopReadyItem[] {
  // Items that need purchasing (not covered by stock)
  const needsPurchase: ShopReadyItem[] = [];
  
  for (const group of shopList.byRetailer) {
    for (const item of group.items) {
      if (item.purchasePacks > 0) {
        needsPurchase.push(item);
      }
    }
  }
  
  return needsPurchase;
}
