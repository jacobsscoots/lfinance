import { useMemo } from "react";
import { format } from "date-fns";
import { Package, Truck, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOnlineOrders, type OnlineOrder } from "@/hooks/useOnlineOrders";

const STATUS_CONFIG: Record<string, {
  label: string;
  icon: typeof Package;
  variant: "default" | "secondary" | "destructive" | "outline";
}> = {
  detected: { label: "Detected", icon: Clock, variant: "outline" },
  shipped: { label: "In Transit", icon: Truck, variant: "secondary" },
  delivered: { label: "Delivered", icon: CheckCircle2, variant: "default" },
  cancelled: { label: "Cancelled", icon: AlertTriangle, variant: "destructive" },
};

export function OrdersPanel() {
  const { orders, shipments, isLoading } = useOnlineOrders();

  const activeOrders = useMemo(() => {
    return orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
  }, [orders]);

  const recentDelivered = useMemo(() => {
    return orders
      .filter((o) => o.status === "delivered")
      .slice(0, 3);
  }, [orders]);

  if (isLoading) return null;
  if (orders.length === 0) return null;

  const getShipment = (orderId: string) =>
    shipments.find((s) => s.order_id === orderId);

  const renderOrder = (order: OnlineOrder) => {
    const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.detected;
    const StatusIcon = config.icon;
    const shipment = getShipment(order.id);

    return (
      <div
        key={order.id}
        className="flex items-center justify-between p-3 rounded-lg border bg-card"
      >
        <div className="flex items-center gap-3 min-w-0">
          <StatusIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">
                {order.retailer_name}
              </span>
              <Badge variant={config.variant} className="text-xs shrink-0">
                {config.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(order.order_date), "d MMM")}
              {order.order_number && ` • ${order.order_number}`}
              {shipment?.carrier && ` • ${shipment.carrier}`}
            </p>
          </div>
        </div>
        {shipment?.tracking_number && (
          <span className="text-xs font-mono text-muted-foreground hidden sm:block">
            {shipment.tracking_number.slice(0, 12)}…
          </span>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Package className="h-4 w-4" />
          Order Tracking
          {activeOrders.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeOrders.length} active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {activeOrders.length === 0 && recentDelivered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            No active orders
          </p>
        )}
        {activeOrders.map(renderOrder)}
        {recentDelivered.length > 0 && activeOrders.length > 0 && (
          <div className="border-t pt-2 mt-2">
            <p className="text-xs text-muted-foreground mb-2">Recently delivered</p>
          </div>
        )}
        {recentDelivered.map(renderOrder)}
      </CardContent>
    </Card>
  );
}
