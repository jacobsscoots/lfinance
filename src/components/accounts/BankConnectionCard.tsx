import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Trash2, Building2, Link, Radio } from "lucide-react";
import { useBankConnections, AUTO_SYNC_INTERVAL_MS } from "@/hooks/useBankConnections";
import { useAccounts } from "@/hooks/useAccounts";
import { getProviderLabel } from "@/lib/bankProviders";
import { format } from "date-fns";

export function BankConnectionCard() {
  const {
    connections,
    isLoading,
    startConnection,
    syncConnection,
    deleteConnection,
    isAutoSyncing,
    lastAutoSyncAt,
  } = useBankConnections();
  const { allAccounts } = useAccounts();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleConnect = () => {
    startConnection.mutate();
  };

  const handleSync = (connectionId: string) => {
    setSyncingId(connectionId);
    syncConnection.mutate(connectionId, {
      onSettled: () => setSyncingId(null),
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteConnection.mutate(deleteId);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-primary" />
                Bank Connections
              </CardTitle>
              <CardDescription>
                Connect your bank for automatic syncing
              </CardDescription>
            </div>
            <Button
              onClick={handleConnect}
              disabled={startConnection.isPending}
              size="sm"
            >
              {startConnection.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Link className="h-4 w-4 mr-2" />
              )}
              Connect Bank
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No banks connected. Click "Connect Bank" to link your account.
            </p>
          ) : (
            <div className="space-y-3">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {(() => {
                          const linkedAccounts = allAccounts.filter(a => a.connection_id === connection.id);
                          if (linkedAccounts.length > 0) {
                            const bankName = linkedAccounts.find(a => a.provider)?.provider;
                            return bankName ? getProviderLabel(bankName) : getProviderLabel(connection.provider);
                          }
                          return getProviderLabel(connection.provider);
                        })()}
                      </p>
                      {(() => {
                        const linkedAccounts = allAccounts.filter(a => a.connection_id === connection.id);
                        if (linkedAccounts.length > 0) {
                          return (
                            <p className="text-xs text-muted-foreground truncate">
                              {linkedAccounts.map(a => a.display_name || a.name).join(", ")}
                            </p>
                          );
                        }
                        return null;
                      })()}
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge
                          variant={connection.status === "connected" ? "default" : "secondary"}
                        >
                          {connection.status}
                        </Badge>
                        {connection.last_synced_at && (
                          <span className="text-xs text-muted-foreground">
                            Last synced: {format(new Date(connection.last_synced_at), "d MMM, HH:mm")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleSync(connection.id)}
                      disabled={syncingId === connection.id}
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${syncingId === connection.id ? "animate-spin" : ""}`}
                      />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setDeleteId(connection.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Auto-sync status bar */}
          {connections.some(c => c.status === "connected") && (
            <AutoSyncStatus isAutoSyncing={isAutoSyncing} lastAutoSyncAt={lastAutoSyncAt} />
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Bank</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the bank connection but keep your imported accounts and transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AutoSyncStatus({ isAutoSyncing, lastAutoSyncAt }: { isAutoSyncing: boolean; lastAutoSyncAt: Date | null }) {
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!lastAutoSyncAt || isAutoSyncing) return;
    const tick = () => {
      const nextSync = lastAutoSyncAt.getTime() + AUTO_SYNC_INTERVAL_MS;
      const remaining = Math.max(0, nextSync - Date.now());
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${mins}:${String(secs).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastAutoSyncAt, isAutoSyncing]);

  return (
    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-border text-xs text-muted-foreground">
      {isAutoSyncing ? (
        <>
          <RefreshCw className="h-3 w-3 animate-spin text-primary" />
          <span className="text-primary font-medium">Syncing…</span>
        </>
      ) : (
        <>
          <Radio className="h-3 w-3 text-primary" />
          <span>Auto-sync every 5 min</span>
          {lastAutoSyncAt && countdown && (
            <span className="ml-auto tabular-nums">Next in {countdown}</span>
          )}
        </>
      )}
    </div>
  );
}
