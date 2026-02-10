import { Package, Truck } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useShipments } from "@/hooks/useShipments";
import { ShipmentCard } from "@/components/deliveries/ShipmentCard";
import { AddTrackingDialog } from "@/components/deliveries/AddTrackingDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Deliveries() {
  const { shipments, events, isLoading, deleteShipment } = useShipments();

  const active = shipments.filter((s) => s.status !== "delivered");
  const delivered = shipments.filter((s) => s.status === "delivered");

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Truck className="h-6 w-6" /> Deliveries
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Auto-tracked parcels via TrackingMore
            </p>
          </div>
          <AddTrackingDialog />
        </div>

        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active" className="gap-1">
              Active ({active.length})
            </TabsTrigger>
            <TabsTrigger value="delivered" className="gap-1">
              Delivered ({delivered.length})
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-1">
              All ({shipments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            <ShipmentList shipments={active} events={events} onDelete={(id) => deleteShipment.mutate(id)} isLoading={isLoading} emptyMessage="No active deliveries" />
          </TabsContent>

          <TabsContent value="delivered" className="mt-4">
            <ShipmentList shipments={delivered} events={events} onDelete={(id) => deleteShipment.mutate(id)} isLoading={isLoading} emptyMessage="No delivered parcels yet" />
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <ShipmentList shipments={shipments} events={events} onDelete={(id) => deleteShipment.mutate(id)} isLoading={isLoading} emptyMessage="No tracked parcels" />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function ShipmentList({
  shipments,
  events,
  onDelete,
  isLoading,
  emptyMessage,
}: {
  shipments: ReturnType<typeof useShipments>["shipments"];
  events: ReturnType<typeof useShipments>["events"];
  onDelete: (id: string) => void;
  isLoading: boolean;
  emptyMessage: string;
}) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>;
  }
  if (shipments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {shipments.map((s) => (
        <ShipmentCard key={s.id} shipment={s} events={events} onDelete={onDelete} />
      ))}
    </div>
  );
}
