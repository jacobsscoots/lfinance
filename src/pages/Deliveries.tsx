import { Package, Truck, Mail, RefreshCw, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useShipments } from "@/hooks/useShipments";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import { useGmailTrackingSync } from "@/hooks/useGmailTrackingSync";
import { ShipmentCard } from "@/components/deliveries/ShipmentCard";
import { AddTrackingDialog } from "@/components/deliveries/AddTrackingDialog";
import { ExtractionLog } from "@/components/deliveries/ExtractionLog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

export default function Deliveries() {
  const { shipments, events, isLoading, deleteShipment } = useShipments();
  const { isConnected, connection, connect, isConnecting } = useGmailConnection();
  const { extractions, syncTracking, isSyncing } = useGmailTrackingSync();

  const active = shipments.filter((s) => s.status !== "delivered");
  const delivered = shipments.filter((s) => s.status === "delivered");
  const fromEmail = shipments.filter((s) => (s as any).source === "gmail");

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Truck className="h-6 w-6" /> Deliveries
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Auto-tracked parcels via Gmail + TrackingMore
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncTracking()}
                disabled={isSyncing}
                className="gap-1"
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync Gmail
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => connect()}
                disabled={isConnecting}
                className="gap-1"
              >
                <Mail className="h-4 w-4" />
                Connect Gmail
              </Button>
            )}
            <AddTrackingDialog />
          </div>
        </div>

        {/* Gmail status banner */}
        {isConnected && connection && (
          <Card className="bg-muted/30">
            <CardContent className="py-3 px-4 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Connected: <span className="text-foreground font-medium">{connection.email}</span>
                </span>
                {connection.last_synced_at && (
                  <span className="text-xs text-muted-foreground">
                    · Last sync {formatDistanceToNow(new Date(connection.last_synced_at), { addSuffix: true })}
                  </span>
                )}
              </div>
              {fromEmail.length > 0 && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Mail className="h-3 w-3" /> {fromEmail.length} from email
                </Badge>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main tabs */}
        <Tabs defaultValue="active">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-auto">
              <TabsTrigger value="active" className="gap-1 text-xs sm:text-sm whitespace-nowrap">
                Active ({active.length})
              </TabsTrigger>
              <TabsTrigger value="delivered" className="gap-1 text-xs sm:text-sm whitespace-nowrap">
                Delivered ({delivered.length})
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-1 text-xs sm:text-sm whitespace-nowrap">
                All ({shipments.length})
              </TabsTrigger>
              <TabsTrigger value="email-log" className="gap-1 text-xs sm:text-sm whitespace-nowrap">
                <Mail className="h-3 w-3" /> Email Log
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="active" className="mt-4">
            <ShipmentList shipments={active} events={events} onDelete={(id) => deleteShipment.mutate(id)} isLoading={isLoading} emptyMessage="No active deliveries" />
          </TabsContent>

          <TabsContent value="delivered" className="mt-4">
            <ShipmentList shipments={delivered} events={events} onDelete={(id) => deleteShipment.mutate(id)} isLoading={isLoading} emptyMessage="No delivered parcels yet" />
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <ShipmentList shipments={shipments} events={events} onDelete={(id) => deleteShipment.mutate(id)} isLoading={isLoading} emptyMessage="No tracked parcels" />
          </TabsContent>

          <TabsContent value="email-log" className="mt-4">
            <ExtractionLog extractions={extractions} />
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
