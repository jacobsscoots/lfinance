import { useMemo } from "react";
import { startOfWeek } from "date-fns";
import { TrendingUp, PiggyBank, ShoppingCart, AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMealPlanItems } from "@/hooks/useMealPlanItems";
import { useProducts } from "@/hooks/useProducts";
import { useGroceryPurchases } from "@/hooks/useGroceryPurchases";
import { useGroceryOrders } from "@/hooks/useGroceryOrders";
import { generateShopReadyList, calculateForecastedMonthlySpend, getReorderAlerts } from "@/lib/groceryListCalculations";
import { calculateActualMonthlySpend, calculateTotalSavings } from "@/lib/discounts";

export function GrocerySummaryTab() {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  
  const { mealPlans, isLoading: plansLoading } = useMealPlanItems(weekStart);
  const { products, isLoading: productsLoading } = useProducts();
  const { purchases, isLoading: purchasesLoading } = useGroceryPurchases();
  const { orders, isLoading: ordersLoading } = useGroceryOrders();
  
  const isLoading = plansLoading || productsLoading || purchasesLoading || ordersLoading;
  
  const stats = useMemo(() => {
    const shopList = generateShopReadyList(mealPlans, products);
    const forecastedWeekly = shopList.totals.finalCost;
    const forecastedMonthly = calculateForecastedMonthlySpend(shopList);
    
    const purchaseData = purchases.map(p => ({
      final_cost: p.final_cost,
      purchase_date: p.purchase_date,
    }));
    const orderData = orders.map(o => ({
      final_cost: o.total_amount,
      purchase_date: o.order_date,
    }));
    const actualMonthly = calculateActualMonthlySpend([...purchaseData, ...orderData]);
    const totalSavings = calculateTotalSavings(purchases);
    const reorderAlerts = getReorderAlerts(shopList);
    
    return { forecastedWeekly, forecastedMonthly, actualMonthly, totalSavings, reorderAlerts, shopList };
  }, [mealPlans, products, purchases, orders]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasNoData = mealPlans.length === 0 && purchases.length === 0 && orders.length === 0;
  
  return (
    <div className="space-y-6">
      {hasNoData && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No data yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Plan your meals for the week and record purchases to see your spending summary here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{stats.forecastedWeekly.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Forecasted spend</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Monthly Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{stats.forecastedMonthly.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Based on current week</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Actual Monthly
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.actualMonthly > 0 ? `£${stats.actualMonthly.toFixed(2)}` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.actualMonthly > 0 ? "Average from purchases" : "No purchase data yet"}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <PiggyBank className="h-4 w-4" />
              Total Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {stats.totalSavings > 0 ? `£${stats.totalSavings.toFixed(2)}` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">From loyalty discounts</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Reorder Alerts */}
      {stats.reorderAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Items to Purchase
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.reorderAlerts.slice(0, 10).map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.product.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.retailer !== "Unassigned" ? item.retailer : "No retailer set"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">
                      {item.purchasePacks} {item.purchasePacks === 1 ? "pack" : "packs"}
                    </Badge>
                    <span className="font-medium">£{item.grossCost.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              {stats.reorderAlerts.length > 10 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  + {stats.reorderAlerts.length - 10} more items
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Spend Comparison */}
      {stats.actualMonthly > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Spend Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Forecasted Monthly</span>
                <span className="font-medium">£{stats.forecastedMonthly.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Actual Monthly</span>
                <span className="font-medium">£{stats.actualMonthly.toFixed(2)}</span>
              </div>
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Difference</span>
                  <span className={`font-bold ${
                    stats.actualMonthly <= stats.forecastedMonthly
                      ? "text-primary"
                      : "text-destructive"
                  }`}>
                    {stats.actualMonthly <= stats.forecastedMonthly ? "-" : "+"}
                    £{Math.abs(stats.forecastedMonthly - stats.actualMonthly).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
