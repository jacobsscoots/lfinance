import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, TrendingDown, AlertTriangle, Calendar } from "lucide-react";
import { formatCurrency, calculateAggregateStats, type ToiletryItem } from "@/lib/toiletryCalculations";

interface ToiletrySummaryCardsProps {
  items: ToiletryItem[];
}

export function ToiletrySummaryCards({ items }: ToiletrySummaryCardsProps) {
  const stats = calculateAggregateStats(items);
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Spend</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(stats.totalMonthlyCost)}
          </div>
          <p className="text-xs text-muted-foreground">
            Based on current usage rates
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Yearly Spend</CardTitle>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(stats.totalYearlyCost)}
          </div>
          <p className="text-xs text-muted-foreground">
            Projected annual cost
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.lowStockCount}
          </div>
          <p className="text-xs text-muted-foreground">
            Items running low (&lt;14 days)
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Items</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.activeItemCount}
          </div>
          <p className="text-xs text-muted-foreground">
            Active items tracked
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
