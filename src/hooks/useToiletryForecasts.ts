import { useMemo } from "react";
import { useToiletries } from "@/hooks/useToiletries";
import { useToiletryUsageLogs } from "@/hooks/useToiletryUsageLogs";
import { useRetailerProfiles } from "@/hooks/useRetailerProfiles";
import { calculateDailyUsageFromLogs } from "@/lib/reorderCalculations";
import { calculateForecast, type ToiletryForecast, type ToiletryItem } from "@/lib/toiletryCalculations";

export interface ToiletryForecastEntry {
  item: ToiletryItem;
  forecast: ToiletryForecast;
}

/**
 * Shared hook that computes toiletry forecasts for use in Calendar, Yearly Planner, etc.
 */
export function useToiletryForecasts() {
  const { toiletries } = useToiletries();
  const { logs: allUsageLogs } = useToiletryUsageLogs();
  const { profiles } = useRetailerProfiles();

  return useMemo(() => {
    const activeItems = toiletries.filter(i => i.status === "active");

    const entries: ToiletryForecastEntry[] = activeItems.map(item => {
      const itemLogs = allUsageLogs.filter(l => l.toiletry_item_id === item.id);
      const { dailyUsage } = calculateDailyUsageFromLogs(
        itemLogs.map(l => ({ logged_date: l.logged_date, amount_used: l.amount_used }))
      );

      const retailerProfile = item.retailer
        ? profiles.find(p => p.retailer_name.toLowerCase() === item.retailer!.toLowerCase())
        : null;

      const shippingProfile = retailerProfile
        ? {
            dispatch_days_min: retailerProfile.dispatch_days_min,
            dispatch_days_max: retailerProfile.dispatch_days_max,
            delivery_days_min: retailerProfile.delivery_days_min,
            delivery_days_max: retailerProfile.delivery_days_max,
            dispatches_weekends: retailerProfile.dispatches_weekends,
            delivers_weekends: retailerProfile.delivers_weekends,
            cutoff_time: retailerProfile.cutoff_time,
          }
        : null;

      const forecast = calculateForecast(item, {
        logBasedUsageRate: dailyUsage,
        shippingProfile,
      });

      return { item, forecast };
    });

    // Monthly cost totals (for yearly planner)
    const totalMonthlyCost = entries.reduce((s, e) => s + e.forecast.monthlyCost, 0);

    return { entries, totalMonthlyCost };
  }, [toiletries, allUsageLogs, profiles]);
}
