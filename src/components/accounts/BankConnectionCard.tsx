import { useState } from "react";
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
import { Loader2, RefreshCw, Trash2, Building2, Link } from "lucide-react";
import { useBankConnections } from "@/hooks/useBankConnections";
import { format } from "date-fns";

export function BankConnectionCard() {
  const {
    connections,
    isLoading,
    startConnection,
    syncConnection,
    deleteConnection,
  } = useBankConnections();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleConnect = () => {
    startConnection.mutate();
  };

  const handleSync = (connectionId: string) => {
    syncConnection.mutate(connectionId);
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
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Open Banking</p>
                      <div className="flex items-center gap-2">
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
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleSync(connection.id)}
                      disabled={syncConnection.isPending}
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${syncConnection.isPending ? "animate-spin" : ""}`}
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
