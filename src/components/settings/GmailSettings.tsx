import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Mail, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Clock,
  Settings,
  Loader2
} from "lucide-react";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import { format } from "date-fns";

export function GmailSettings() {
  const {
    connection,
    settings,
    isLoading,
    isConnected,
    connect,
    disconnect,
    updateSettings,
    sync,
    isConnecting,
    isDisconnecting,
    isSyncing,
  } = useGmailConnection();

  const [localScanDays, setLocalScanDays] = useState(settings?.scan_days || 30);

  const handleScanDaysChange = (value: number[]) => {
    setLocalScanDays(value[0]);
  };

  const handleScanDaysCommit = () => {
    updateSettings({ scan_days: localScanDays });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Gmail Connection</CardTitle>
                <CardDescription>
                  Connect Gmail to automatically import receipts
                </CardDescription>
              </div>
            </div>
            {isConnected ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3" />
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected && connection ? (
            <>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">{connection.email}</p>
                  {connection.last_synced_at && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last synced: {format(new Date(connection.last_synced_at), "d MMM yyyy, HH:mm")}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sync()}
                    disabled={isSyncing}
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sync Now
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => disconnect()}
                    disabled={isDisconnecting}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>

              {connection.status === 'error' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">
                    There was an error with your Gmail connection. Please reconnect.
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                Connect your Gmail account to automatically scan for receipts and match them to transactions.
              </p>
              <Button onClick={() => connect()} disabled={isConnecting}>
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Connect Gmail
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Settings */}
      {isConnected && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <CardTitle className="text-lg">Sync Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Auto-attach toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-attach Receipts</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically attach high-confidence receipt matches to transactions
                </p>
              </div>
              <Switch
                checked={settings?.auto_attach ?? true}
                onCheckedChange={(checked) => updateSettings({ auto_attach: checked })}
              />
            </div>

            <Separator />

            {/* Scan days slider */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Scan Period</Label>
                  <p className="text-sm text-muted-foreground">
                    Only scan emails from the last {localScanDays} days
                  </p>
                </div>
                <span className="font-medium">{localScanDays} days</span>
              </div>
              <Slider
                value={[localScanDays]}
                onValueChange={handleScanDaysChange}
                onValueCommit={handleScanDaysCommit}
                min={7}
                max={90}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>7 days</span>
                <span>90 days</span>
              </div>
            </div>

            <Separator />

            {/* Allowed domains */}
            <div className="space-y-2">
              <Label>Allowed Sender Domains (optional)</Label>
              <p className="text-sm text-muted-foreground">
                Only scan emails from these domains. Leave empty to scan all.
              </p>
              <Input
                placeholder="e.g., amazon.co.uk, tesco.com"
                value={settings?.allowed_domains?.join(", ") || ""}
                onChange={(e) => {
                  const domains = e.target.value
                    .split(",")
                    .map(d => d.trim())
                    .filter(d => d.length > 0);
                  updateSettings({ allowed_domains: domains.length > 0 ? domains : null });
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How Gmail Receipt Matching Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</div>
                <h4 className="font-medium">Scan Emails</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                We search your inbox for receipt-like emails from common retailers
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</div>
                <h4 className="font-medium">Extract Details</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Amount, date, merchant name, and any PDF/image attachments
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</div>
                <h4 className="font-medium">Match Transactions</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Match receipts to your transactions using amount, date, and merchant
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">4</div>
                <h4 className="font-medium">Attach & Review</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                High-confidence matches auto-attach; others are flagged for review
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
