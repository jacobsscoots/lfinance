import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Package, ShoppingCart, Clock } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import {
  calculateForecast,
  formatCurrency,
  type ToiletryItem,
  type ToiletryForecast,
} from "@/lib/toiletryCalculations";
import {
  getReorderBadgeVariant,
  getReorderStatusLabel,
  type ShippingProfile,
} from "@/lib/reorderCalculations";
import { cn } from "@/lib/utils";

interface OnHandPanelProps {
  items: ToiletryItem[];
  usageRates: Record<string, number | null>;
  shippingProfiles: Record<string, ShippingProfile | null>;
}

interface OnHandItem {
  item: ToiletryItem;
  forecast: ToiletryForecast;
  urgency: "critical" | "warning" | "ok";
  daysUntilRunOut: number;
}

export function OnHandPanel({ items, usageRates, shippingProfiles }: OnHandPanelProps) {
  const onHandItems = useMemo(() => {
    const activeItems = items.filter(i => i.status === "active" && i.quantity_in_use > 0);
    
    return activeItems
      .map((item): OnHandItem => {
        const forecast = calculateForecast(item, {
          logBasedUsageRate: usageRates[item.id] ?? null,
          shippingProfile: item.retailer
            ? shippingProfiles[item.retailer.toLowerCase()] ?? null
            : null,
        });

        const daysUntilRunOut = forecast.daysRemaining;
        let urgency: "critical" | "warning" | "ok" = "ok";
        if (daysUntilRunOut <= 7) urgency = "critical";
        else if (daysUntilRunOut <= 14) urgency = "warning";

        // Also flag as critical if order-by date is past or today
        if (forecast.reorderStatus === "overdue" || forecast.reorderStatus === "order_now") {
          urgency = "critical";
        } else if (forecast.reorderStatus === "reorder_soon" && urgency === "ok") {
          urgency = "warning";
        }

        return { item, forecast, urgency, daysUntilRunOut };
      })
      .sort((a, b) => a.daysUntilRunOut - b.daysUntilRunOut);
  }, [items, usageRates, shippingProfiles]);

  const criticalCount = onHandItems.filter(i => i.urgency === "critical").length;
  const warningCount = onHandItems.filter(i => i.urgency === "warning").length;

  if (onHandItems.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            On Hand
          </CardTitle>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} urgent
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {warningCount} low
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {onHandItems.map(({ item, forecast, urgency }) => (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-3 p-2.5 rounded-lg border",
              urgency === "critical" && "bg-destructive/5 border-destructive/20",
              urgency === "warning" && "bg-warning/5 border-warning/20",
              urgency === "ok" && "border-border"
            )}
          >
            {/* Icon */}
            <div className={cn(
              "shrink-0 rounded-full p-1.5",
              urgency === "critical" && "bg-destructive/10 text-destructive",
              urgency === "warning" && "bg-warning/10 text-warning",
              urgency === "ok" && "bg-muted text-muted-foreground"
            )}>
              {urgency === "critical" ? (
                <AlertTriangle className="h-3.5 w-3.5" />
              ) : urgency === "warning" ? (
                <Clock className="h-3.5 w-3.5" />
              ) : (
                <Package className="h-3.5 w-3.5" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{item.name}</span>
                {item.quantity_on_hand > 0 && (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    +{item.quantity_on_hand} spare
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <Progress value={forecast.percentRemaining} className="h-1.5 flex-1" />
                <span className="text-xs text-muted-foreground shrink-0">
                  {forecast.percentRemaining}%
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>
                  {forecast.daysRemaining === Infinity
                    ? "—"
                    : `${forecast.daysRemaining}d left`}
                </span>
                {forecast.runOutDateFormatted !== "N/A" && (
                  <>
                    <span>•</span>
                    <span>Runs out {forecast.runOutDateFormatted}</span>
                  </>
                )}
                {forecast.orderByFormatted && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <ShoppingCart className="h-3 w-3" />
                      Order by {forecast.orderByFormatted}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Reorder badge */}
            {forecast.reorderStatus !== "no_data" && forecast.reorderStatus !== "plenty" && (
              <Badge
                variant={getReorderBadgeVariant(forecast.reorderStatus)}
                className="text-[10px] shrink-0"
              >
                {getReorderStatusLabel(forecast.reorderStatus)}
              </Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
