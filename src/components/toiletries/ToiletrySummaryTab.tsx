import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Percent, Package } from "lucide-react";
import { formatCurrency, calculateForecast, TOILETRY_CATEGORIES, type ToiletryItem } from "@/lib/toiletryCalculations";
import { calculateTotalSavings, calculateActualMonthlySpend } from "@/lib/toiletryUsageCalculations";
import type { ToiletryPurchase } from "@/hooks/useToiletryPurchases";

interface ToiletrySummaryTabProps {
  items: ToiletryItem[];
  purchases: ToiletryPurchase[];
}

export function ToiletrySummaryTab({ items, purchases }: ToiletrySummaryTabProps) {
  const stats = useMemo(() => {
    // Calculate forecasted monthly spend from items
    const forecastedMonthly = items
      .filter((item) => item.status === "active")
      .reduce((sum, item) => {
        const forecast = calculateForecast(item);
        return sum + forecast.monthlyCost;
      }, 0);

    // Calculate actual monthly spend from purchases
    const actualMonthly = calculateActualMonthlySpend(purchases);

    // Calculate total savings from discounts
    const totalSavings = calculateTotalSavings(purchases);

    // Category breakdown
    const categoryStats = TOILETRY_CATEGORIES.map((cat) => {
      const categoryItems = items.filter(
        (item) => item.category === cat.value && item.status === "active"
      );
      const categoryPurchases = purchases.filter((p) =>
        categoryItems.some((item) => item.id === p.toiletry_item_id)
      );

      const forecasted = categoryItems.reduce((sum, item) => {
        const forecast = calculateForecast(item);
        return sum + forecast.monthlyCost;
      }, 0);

      const actual = calculateActualMonthlySpend(categoryPurchases);

      return {
        category: cat.label,
        value: cat.value,
        forecasted,
        actual,
        itemCount: categoryItems.length,
      };
    }).filter((cat) => cat.itemCount > 0);

    // Items needing reorder soon
    const reorderSoon = items
      .filter((item) => item.status === "active")
      .map((item) => ({
        item,
        forecast: calculateForecast(item),
      }))
      .filter(({ forecast }) => forecast.daysRemaining <= 14)
      .sort((a, b) => a.forecast.daysRemaining - b.forecast.daysRemaining);

    return {
      forecastedMonthly,
      actualMonthly,
      totalSavings,
      categoryStats,
      reorderSoon,
      spendVariance: actualMonthly - forecastedMonthly,
    };
  }, [items, purchases]);

  return (
    <div className="space-y-6">
      {/* Top Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Forecasted Monthly</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.forecastedMonthly)}
            </div>
            <p className="text-xs text-muted-foreground">
              Based on usage rates
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actual Monthly Avg</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.actualMonthly)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.spendVariance >= 0 ? (
                <span className="text-destructive">
                  £{Math.abs(stats.spendVariance).toFixed(2)} over forecast
                </span>
              ) : (
                <span className="text-primary">
                  £{Math.abs(stats.spendVariance).toFixed(2)} under forecast
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(stats.totalSavings)}
            </div>
            <p className="text-xs text-muted-foreground">
              From loyalty discounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reorder Soon</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.reorderSoon.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Items running low
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Spend by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.categoryStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No active items to show
            </p>
          ) : (
            <div className="space-y-4">
              {stats.categoryStats.map((cat) => (
                <div key={cat.value} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{cat.category}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {cat.itemCount} {cat.itemCount === 1 ? "item" : "items"}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatCurrency(cat.forecasted)}/mo
                    </p>
                    {cat.actual > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Actual: {formatCurrency(cat.actual)}/mo
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reorder Alerts */}
      {stats.reorderSoon.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-destructive" />
              Items to Reorder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.reorderSoon.map(({ item, forecast }) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.brand && `${item.brand} • `}
                      {forecast.percentRemaining}% remaining
                    </p>
                  </div>
                  <Badge
                    variant={forecast.daysRemaining <= 7 ? "destructive" : "secondary"}
                  >
                    {forecast.daysRemaining} days left
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
