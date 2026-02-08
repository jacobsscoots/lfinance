import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, RefreshCw, Unplug, WifiOff, CheckCircle2, AlertCircle } from "lucide-react";
import { useBrightConnection } from "@/hooks/useBrightConnection";
import { BrightConnectDialog } from "./BrightConnectDialog";

export function SmartMeterCard() {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const { connection, isLoading, isConnected, isExpired, sync, isSyncing, disconnect, isDisconnecting } = useBrightConnection();

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Smart Meter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Smart Meter
          </CardTitle>
          {isConnected && (
            <Badge variant="outline" className="text-success border-success">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
          {isExpired && (
            <Badge variant="outline" className="text-amber-500 border-amber-500">
              <AlertCircle className="h-3 w-3 mr-1" />
              Token Expired
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {!connection ? (
            <div className="text-center py-4">
              <WifiOff className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">
                Connect your Chameleon IHD to automatically import meter readings
              </p>
              <Button onClick={() => setConnectDialogOpen(true)}>
                Connect Smart Meter
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Electricity</p>
                  <p className="font-medium">
                    {connection.electricity_resource_id ? "✓ Available" : "Not found"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Gas</p>
                  <p className="font-medium">
                    {connection.gas_resource_id ? "✓ Available" : "Not found"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Last Synced</p>
                  <p className="font-medium">
                    {connection.last_synced_at
                      ? format(new Date(connection.last_synced_at), "d MMM yyyy, HH:mm")
                      : "Never"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {isExpired ? (
                  <Button onClick={() => setConnectDialogOpen(true)} className="flex-1">
                    Reconnect
                  </Button>
                ) : (
                  <Button
                    onClick={() => sync({})}
                    disabled={isSyncing}
                    className="flex-1"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                    {isSyncing ? "Syncing..." : "Sync Now"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => disconnect()}
                  disabled={isDisconnecting}
                >
                  <Unplug className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <BrightConnectDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
      />
    </>
  );
}
