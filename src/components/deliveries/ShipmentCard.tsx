import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Package, Copy, ChevronDown, ChevronUp, MapPin, Clock, Truck, CheckCircle2, AlertTriangle, Circle, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { type Shipment, type ShipmentEvent, getStatusLabel, getStatusColor } from "@/hooks/useShipments";
import { cn } from "@/lib/utils";

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Circle className="h-4 w-4" />,
  in_transit: <Truck className="h-4 w-4" />,
  out_for_delivery: <Truck className="h-4 w-4" />,
  delivered: <CheckCircle2 className="h-4 w-4" />,
  exception: <AlertTriangle className="h-4 w-4" />,
  unknown: <Circle className="h-4 w-4" />,
};

interface ShipmentCardProps {
  shipment: Shipment;
  events: ShipmentEvent[];
  onDelete?: (id: string) => void;
}

export function ShipmentCard({ shipment, events, onDelete }: ShipmentCardProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const shipmentEvents = events
    .filter((e) => e.shipment_id === shipment.id)
    .sort((a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime());

  const copyTracking = () => {
    navigator.clipboard.writeText(shipment.tracking_number);
    toast({ title: "Copied", description: "Tracking number copied to clipboard" });
  };

  const lastUpdate = shipment.last_event_at || shipment.last_synced_at || shipment.updated_at;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm truncate">{shipment.tracking_number}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copyTracking}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              {shipment.carrier_code && (
                <p className="text-xs text-muted-foreground capitalize mt-0.5">
                  {shipment.carrier_code.replace(/-/g, " ")}
                </p>
              )}
            </div>
          </div>
          <Badge className={cn("shrink-0 gap-1", getStatusColor(shipment.status))}>
            {statusIcons[shipment.status]}
            {getStatusLabel(shipment.status)}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <p className="text-xs text-muted-foreground">
            <Clock className="h-3 w-3 inline mr-1" />
            Updated {formatDistanceToNow(new Date(lastUpdate), { addSuffix: true })}
          </p>
          {(shipment as any).source === "gmail" && (
            <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
              <Mail className="h-3 w-3" /> Auto-added from email
            </Badge>
          )}
        </div>
      </CardHeader>

      {shipmentEvents.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full rounded-none border-t justify-between px-6 h-9 text-xs">
              Timeline ({shipmentEvents.length} events)
              {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-6 pb-4 pt-2">
              <div className="space-y-3">
                {shipmentEvents.map((evt, i) => (
                  <div key={evt.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "w-2 h-2 rounded-full mt-2 shrink-0",
                        i === 0 ? "bg-primary" : "bg-border"
                      )} />
                      {i < shipmentEvents.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-1" />
                      )}
                    </div>
                    <div className="pb-2 min-w-0">
                      <p className="text-sm leading-snug">{evt.message || "Status update"}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(evt.event_time), "dd MMM yyyy, HH:mm")}
                        </span>
                        {evt.location && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" />
                            {evt.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
}
