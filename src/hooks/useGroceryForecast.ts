import { useMemo } from "react";
import { startOfWeek, differenceInDays } from "date-fns";
import { useMealPlanItems } from "@/hooks/useMealPlanItems";
import { useProducts } from "@/hooks/useProducts";
import { usePaydaySettings } from "@/hooks/usePaydaySettings";
import { generateShopReadyList, calculateForecastedMonthlySpend } from "@/lib/groceryListCalculations";
import { getPayCycleForDate, toPaydaySettings } from "@/lib/payCycle";

/**
 * Shared hook that computes the grocery forecast based on
 * the current meal plan needs minus stock on hand.
 *
 * Returns weekly spend (from current meal plan), payday-cycle spend,
 * monthly spend, and metadata for display.
 *
 * Used by: Groceries Summary, Bills page, Yearly Planner
 */
export function useGroceryForecast() {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const { mealPlans } = useMealPlanItems(weekStart);
  const { products } = useProducts();
  const { effectiveSettings } = usePaydaySettings();

  const forecast = useMemo(() => {
    const hasProducts = products.length > 0;
    const hasMealPlan = mealPlans.length > 0;

    if (!hasProducts || !hasMealPlan) {
      return {
        weeklySpend: 0,
        monthlySpend: 0,
        payCycleSpend: 0,
        payCycleDays: 0,
        dailyCost: 0,
        itemCount: 0,
        shopList: null,
        hasData: false,
      };
    }

    const shopList = generateShopReadyList(mealPlans, products);
    const weeklySpend = shopList.totals.finalCost;
    const dailyCost = weeklySpend / 7;
    const monthlySpend = calculateForecastedMonthlySpend(shopList);

    // Calculate payday cycle length for accurate period projection
    const paydaySettings = toPaydaySettings(effectiveSettings);
    const currentCycle = getPayCycleForDate(new Date(), paydaySettings);
    const payCycleDays = differenceInDays(currentCycle.end, currentCycle.start) + 1;
    const payCycleSpend = dailyCost * payCycleDays;

    return {
      weeklySpend,
      monthlySpend,
      payCycleSpend,
      payCycleDays,
      dailyCost,
      itemCount: shopList.totals.itemCount,
      shopList,
      hasData: true,
    };
  }, [mealPlans, products, effectiveSettings]);

  return forecast;
}
