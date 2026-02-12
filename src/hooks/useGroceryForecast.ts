import { useMemo } from "react";
import { startOfWeek } from "date-fns";
import { useMealPlanItems } from "@/hooks/useMealPlanItems";
import { useProducts } from "@/hooks/useProducts";
import { generateShopReadyList, calculateForecastedMonthlySpend } from "@/lib/groceryListCalculations";

/**
 * Shared hook that computes the grocery forecast based on
 * the current meal plan needs minus stock on hand.
 * 
 * Used by: Groceries Summary, Bills page, Yearly Planner
 */
export function useGroceryForecast() {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const { mealPlans } = useMealPlanItems(weekStart);
  const { products } = useProducts();

  const forecast = useMemo(() => {
    const shopList = generateShopReadyList(mealPlans, products);
    const weeklySpend = shopList.totals.finalCost;
    const monthlySpend = calculateForecastedMonthlySpend(shopList);

    return {
      weeklySpend,
      monthlySpend,
      itemCount: shopList.totals.itemCount,
      shopList,
    };
  }, [mealPlans, products]);

  return forecast;
}
