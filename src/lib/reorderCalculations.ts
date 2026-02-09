import { addDays, isWeekend, format } from "date-fns";

export interface UsageLog {
  logged_date: string;
  amount_used: number;
}

export interface UsageRateResult {
  dailyUsage: number | null;
  dataPoints: number;
  confidence: "none" | "low" | "moderate" | "good";
}

export interface ShippingProfile {
  dispatch_days_min: number;
  dispatch_days_max: number;
  delivery_days_min: number;
  delivery_days_max: number;
  dispatches_weekends: boolean;
  delivers_weekends: boolean;
  cutoff_time: string | null;
}

export interface OrderByResult {
  orderByDate: Date;
  maxLeadTimeDays: number;
}

export type ReorderStatus = "plenty" | "reorder_soon" | "order_now" | "overdue" | "no_data";

/**
 * Calculate daily usage rate from usage logs over a lookback window.
 */
export function calculateDailyUsageFromLogs(
  logs: UsageLog[],
  lookbackDays: number = 30
): UsageRateResult {
  if (!logs || logs.length === 0) {
    return { dailyUsage: null, dataPoints: 0, confidence: "none" };
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);
  const cutoffStr = format(cutoff, "yyyy-MM-dd");

  const recentLogs = logs.filter((l) => l.logged_date >= cutoffStr);

  if (recentLogs.length === 0) {
    return { dailyUsage: null, dataPoints: 0, confidence: "none" };
  }

  const totalUsed = recentLogs.reduce((sum, l) => sum + l.amount_used, 0);

  // Find the span of days covered
  const dates = recentLogs.map((l) => new Date(l.logged_date).getTime());
  const earliest = Math.min(...dates);
  const latest = Math.max(...dates);
  const spanDays = Math.max(1, Math.round((latest - earliest) / 86400000));

  const dailyUsage = totalUsed / spanDays;

  let confidence: "none" | "low" | "moderate" | "good" = "none";
  if (recentLogs.length >= 7) confidence = "good";
  else if (recentLogs.length >= 3) confidence = "moderate";
  else if (recentLogs.length >= 1) confidence = "low";

  return {
    dailyUsage: Math.round(dailyUsage * 100) / 100,
    dataPoints: recentLogs.length,
    confidence,
  };
}

/**
 * Calculate the "Order by" date by subtracting max lead time + buffer from run-out date,
 * respecting weekend dispatch/delivery rules.
 */
export function calculateOrderByDate(
  runOutDate: Date,
  profile: ShippingProfile,
  safetyBufferDays: number = 2,
  nowLocal: Date = new Date()
): OrderByResult {
  const maxLeadTimeDays =
    profile.dispatch_days_max + profile.delivery_days_max + safetyBufferDays;

  // Walk backwards from runOutDate, skipping non-working days
  let orderBy = new Date(runOutDate);
  let daysToSubtract = maxLeadTimeDays;

  while (daysToSubtract > 0) {
    orderBy = addDays(orderBy, -1);

    // Check if this day "counts" — skip weekends if relevant
    const weekend = isWeekend(orderBy);
    if (weekend && !profile.dispatches_weekends && !profile.delivers_weekends) {
      continue; // skip this day entirely
    }

    daysToSubtract--;
  }

  // If past cutoff time today and orderBy is today, push to tomorrow
  if (profile.cutoff_time && orderBy.toDateString() === nowLocal.toDateString()) {
    const [h, m] = profile.cutoff_time.split(":").map(Number);
    if (nowLocal.getHours() > h || (nowLocal.getHours() === h && nowLocal.getMinutes() >= (m || 0))) {
      orderBy = addDays(orderBy, -1);
    }
  }

  return { orderByDate: orderBy, maxLeadTimeDays };
}

/**
 * Get reorder status based on orderByDate vs today.
 */
export function getReorderStatus(
  orderByDate: Date | null,
  today: Date = new Date()
): ReorderStatus {
  if (!orderByDate) return "no_data";

  const diffMs = orderByDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / 86400000);

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "order_now";
  if (diffDays <= 7) return "reorder_soon";
  return "plenty";
}

/**
 * Get badge styling info for reorder status.
 */
export function getReorderBadgeVariant(
  status: ReorderStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "overdue":
    case "order_now":
      return "destructive";
    case "reorder_soon":
      return "secondary";
    case "plenty":
      return "default";
    default:
      return "outline";
  }
}

export function getReorderStatusLabel(status: ReorderStatus): string {
  switch (status) {
    case "overdue":
      return "Overdue";
    case "order_now":
      return "Order Now";
    case "reorder_soon":
      return "Order Soon";
    case "plenty":
      return "Plenty";
    default:
      return "Log Usage";
  }
}
