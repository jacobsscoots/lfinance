import { addDays, format } from "date-fns";

export interface ToiletryItem {
  id: string;
  user_id: string;
  name: string;
  category: string;
  total_size: number;
  size_unit: string;
  cost_per_item: number;
  pack_size: number;
  usage_rate_per_day: number;
  current_remaining: number;
  status: string;
  notes: string | null;
  last_restocked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToiletryForecast {
  daysRemaining: number;
  runOutDate: Date;
  runOutDateFormatted: string;
  monthlyUsage: number;
  monthlyCost: number;
  yearlyCost: number;
  statusLevel: "healthy" | "low" | "empty";
  percentRemaining: number;
}

export interface PurchaseCalculation {
  requiredAmount: number;
  actualPurchaseQuantity: number;
  totalCost: number;
}

export const TOILETRY_CATEGORIES = [
  { value: "body", label: "Body" },
  { value: "hair", label: "Hair" },
  { value: "oral", label: "Oral" },
  { value: "household", label: "Household" },
  { value: "cleaning", label: "Cleaning" },
  { value: "other", label: "Other" },
] as const;

export const SIZE_UNITS = [
  { value: "ml", label: "ml" },
  { value: "g", label: "g" },
  { value: "units", label: "units" },
] as const;

export const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "out_of_stock", label: "Out of Stock" },
  { value: "discontinued", label: "Discontinued" },
] as const;

const LOW_STOCK_THRESHOLD_DAYS = 14;

/**
 * Calculate forecasting data for a toiletry item
 */
export function calculateForecast(item: ToiletryItem): ToiletryForecast {
  const { current_remaining, usage_rate_per_day, total_size, cost_per_item } = item;
  
  // Days remaining = current_remaining / usage_rate_per_day
  const daysRemaining = usage_rate_per_day > 0 
    ? Math.max(0, current_remaining / usage_rate_per_day)
    : Infinity;
  
  // Run-out date = today + days remaining
  const runOutDate = addDays(new Date(), daysRemaining);
  const runOutDateFormatted = isFinite(daysRemaining) 
    ? format(runOutDate, "MMM d")
    : "N/A";
  
  // Monthly usage = usage_rate_per_day * 30
  const monthlyUsage = usage_rate_per_day * 30;
  
  // Monthly cost = (usage_rate_per_day * 30 / total_size) * cost_per_item
  const monthlyCost = total_size > 0 
    ? (monthlyUsage / total_size) * cost_per_item
    : 0;
  
  // Yearly cost = monthly cost * 12
  const yearlyCost = monthlyCost * 12;
  
  // Status level based on days remaining
  let statusLevel: "healthy" | "low" | "empty" = "healthy";
  if (current_remaining <= 0) {
    statusLevel = "empty";
  } else if (daysRemaining <= LOW_STOCK_THRESHOLD_DAYS) {
    statusLevel = "low";
  }
  
  // Percent remaining
  const percentRemaining = total_size > 0 
    ? Math.round((current_remaining / total_size) * 100)
    : 0;
  
  return {
    daysRemaining: Math.round(daysRemaining),
    runOutDate,
    runOutDateFormatted,
    monthlyUsage,
    monthlyCost,
    yearlyCost,
    statusLevel,
    percentRemaining,
  };
}

/**
 * Calculate purchase quantity (always rounds up)
 */
export function calculatePurchase(
  requiredAmount: number, 
  packSize: number,
  costPerItem: number
): PurchaseCalculation {
  // Always round up - never buy less than needed
  const actualPurchaseQuantity = Math.ceil(requiredAmount / packSize) * packSize;
  const packsNeeded = Math.ceil(requiredAmount / packSize);
  const totalCost = packsNeeded * costPerItem;
  
  return {
    requiredAmount,
    actualPurchaseQuantity,
    totalCost,
  };
}

/**
 * Calculate aggregate statistics for all items
 */
export function calculateAggregateStats(items: ToiletryItem[]) {
  const activeItems = items.filter(item => item.status === "active");
  
  let totalMonthlyCost = 0;
  let totalYearlyCost = 0;
  let lowStockCount = 0;
  let emptyCount = 0;
  
  const costByCategory: Record<string, { monthly: number; yearly: number }> = {};
  
  activeItems.forEach(item => {
    const forecast = calculateForecast(item);
    
    totalMonthlyCost += forecast.monthlyCost;
    totalYearlyCost += forecast.yearlyCost;
    
    if (forecast.statusLevel === "low") lowStockCount++;
    if (forecast.statusLevel === "empty") emptyCount++;
    
    // Category breakdown
    if (!costByCategory[item.category]) {
      costByCategory[item.category] = { monthly: 0, yearly: 0 };
    }
    costByCategory[item.category].monthly += forecast.monthlyCost;
    costByCategory[item.category].yearly += forecast.yearlyCost;
  });
  
  return {
    totalMonthlyCost,
    totalYearlyCost,
    lowStockCount,
    emptyCount,
    costByCategory,
    activeItemCount: activeItems.length,
    totalItemCount: items.length,
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

/**
 * Get status badge variant based on item status and forecast
 */
export function getStatusBadgeVariant(
  item: ToiletryItem, 
  forecast: ToiletryForecast
): "default" | "secondary" | "destructive" | "outline" {
  if (item.status === "discontinued") return "outline";
  if (item.status === "out_of_stock") return "secondary";
  if (forecast.statusLevel === "empty") return "destructive";
  if (forecast.statusLevel === "low") return "secondary";
  return "default";
}

/**
 * Get status display text
 */
export function getStatusDisplayText(
  item: ToiletryItem, 
  forecast: ToiletryForecast
): string {
  if (item.status === "discontinued") return "Discontinued";
  if (item.status === "out_of_stock") return "Out of Stock";
  if (forecast.statusLevel === "empty") return "Empty";
  if (forecast.statusLevel === "low") return "Low";
  return "In Use";
}
