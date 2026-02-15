import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Landmark, Mail, Zap, Search, TrendingUp, 
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock 
} from "lucide-react";
import { useBankConnections } from "@/hooks/useBankConnections";
import { useGmailConnection } from "@/hooks/useGmailConnection";
import { useBrightConnection } from "@/hooks/useBrightConnection";
import { useTrackedServices } from "@/hooks/useTrackedServices";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type ServiceStatus = "connected" | "disconnected" | "error" | "expired";

interface ServiceInfo {
  name: string;
  description: string;
  icon: React.ReactNode;
  status: ServiceStatus;
  details?: string;
  lastSync?: string | null;
  action?: { label: string; onClick: () => void; loading?: boolean };
  syncKey?: string;
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  const config: Record<ServiceStatus, { label: string; className: string; icon: React.ReactNode }> = {
    connected: { label: "Connected", className: "bg-success/10 text-success border-success/20", icon: <CheckCircle2 className="h-3 w-3" /> },
    disconnected: { label: "Not Connected", className: "bg-muted text-muted-foreground border-border", icon: <XCircle className="h-3 w-3" /> },
    error: { label: "Error", className: "bg-destructive/10 text-destructive border-destructive/20", icon: <AlertTriangle className="h-3 w-3" /> },
    expired: { label: "Expired", className: "bg-warning/10 text-warning border-warning/20", icon: <Clock className="h-3 w-3" /> },
  };
  const c = config[status];
  return (
    <Badge variant="outline" className={`gap-1 ${c.className}`}>
      {c.icon} {c.label}
    </Badge>
  );
}

const COOLDOWN_SECONDS = 60;

export function ServiceStatusSettings() {
  const { connections, isLoading: bankLoading, autoSync, isAutoSyncing } = useBankConnections();
  const { connection: gmail, isConnected: gmailConnected, connect: connectGmail, sync: syncGmail, isConnecting: gmailConnecting, isSyncing: gmailSyncing } = useGmailConnection();
  const { connection: bright, isConnected: brightConnected, isExpired: brightExpired, sync: syncBright, isSyncing: brightSyncing } = useBrightConnection();
  const { services: trackedServices } = useTrackedServices();

  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connectedBanks = connections.filter((c) => c.status === "connected");

  const startCooldown = useCallback(() => {
    setCooldownRemaining(COOLDOWN_SECONDS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshingAll(true);
    const results: { name: string; ok: boolean }[] = [];

    // Bank sync
    if (connectedBanks.length > 0) {
      try {
        await autoSync();
        results.push({ name: "Bank Connections", ok: true });
      } catch {
        results.push({ name: "Bank Connections", ok: false });
      }
    }

    // Gmail sync
    if (gmailConnected) {
      try {
        await syncGmail();
        results.push({ name: "Gmail Receipts", ok: true });
      } catch {
        results.push({ name: "Gmail Receipts", ok: false });
      }
    }

    // Smart Meter sync
    if (brightConnected && !brightExpired) {
      try {
        await syncBright(undefined as any);
        results.push({ name: "Smart Meter", ok: true });
      } catch {
        results.push({ name: "Smart Meter", ok: false });
      }
    }

    setIsRefreshingAll(false);
    startCooldown();

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);

    if (results.length === 0) {
      toast.info("No syncable services connected");
    } else if (failed.length === 0) {
      toast.success(`All ${succeeded} service${succeeded > 1 ? "s" : ""} refreshed successfully`);
    } else {
      toast.warning(
        `${succeeded}/${results.length} services refreshed — ${failed.map((f) => f.name).join(", ")} failed. Try again.`
      );
    }
  }, [connectedBanks.length, gmailConnected, brightConnected, brightExpired, autoSync, syncGmail, syncBright, startCooldown]);

  const services: ServiceInfo[] = [
    {
      name: "Bank Connections",
      description: "Open banking via TrueLayer for account & transaction sync",
      icon: <Landmark className="h-5 w-5" />,
      status: connectedBanks.length > 0 ? "connected" : "disconnected",
      details: connectedBanks.length > 0 ? `${connectedBanks.length} bank(s) linked` : "No banks connected",
      lastSync: connectedBanks[0]?.last_synced_at,
      action: connectedBanks.length > 0 ? { label: "Sync Now", onClick: () => { autoSync(); }, loading: isAutoSyncing } : undefined,
    },
    {
      name: "Gmail Receipts",
      description: "Auto-scan emails for receipts and match to transactions",
      icon: <Mail className="h-5 w-5" />,
      status: gmail?.status === "error" ? "error" : gmailConnected ? "connected" : "disconnected",
      details: gmail ? gmail.email : undefined,
      lastSync: gmail?.last_synced_at,
      action: gmailConnected
        ? { label: "Sync", onClick: () => syncGmail(), loading: gmailSyncing }
        : { label: "Connect", onClick: () => connectGmail(), loading: gmailConnecting },
    },
    {
      name: "Smart Meter",
      description: "Bright / Hildebrand smart meter data for energy tracking",
      icon: <Zap className="h-5 w-5" />,
      status: brightExpired ? "expired" : brightConnected ? "connected" : "disconnected",
      lastSync: bright?.last_synced_at,
      action: brightConnected ? { label: "Sync", onClick: () => syncBright(undefined as any), loading: brightSyncing } : undefined,
    },
    {
      name: "Bill Comparison",
      description: "Scans for cheaper energy, broadband & insurance deals",
      icon: <Search className="h-5 w-5" />,
      status: (trackedServices?.length ?? 0) > 0 ? "connected" : "disconnected",
      details: (trackedServices?.length ?? 0) > 0 ? `${trackedServices!.length} service(s) tracked` : "No services tracked",
    },
    {
      name: "Live Pricing",
      description: "Yahoo Finance ticker data for investment valuations",
      icon: <TrendingUp className="h-5 w-5" />,
      status: "connected",
      details: "Automatic — no setup required",
    },
  ];

  const isCoolingDown = cooldownRemaining > 0;
  const isAnySyncing = isAutoSyncing || gmailSyncing || brightSyncing;

  return (
    <div className="space-y-4">
      {/* Refresh All Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-medium text-sm">Refresh All Services</h3>
              <p className="text-xs text-muted-foreground">
                Sync all connected services in one go
              </p>
            </div>
            <Button
              onClick={handleRefreshAll}
              disabled={isRefreshingAll || isCoolingDown || isAnySyncing}
              className="shrink-0"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshingAll ? "animate-spin" : ""}`} />
              {isRefreshingAll
                ? "Refreshing…"
                : isCoolingDown
                ? `Wait ${cooldownRemaining}s`
                : "Refresh All"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Service Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {services.map((s) => (
            <div key={s.name} className="flex items-start gap-4 p-4 rounded-lg border bg-card">
              <div className="rounded-lg bg-muted p-2.5 shrink-0">{s.icon}</div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{s.name}</span>
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-xs text-muted-foreground">{s.description}</p>
                {s.details && <p className="text-xs text-foreground/70">{s.details}</p>}
                {s.lastSync && (
                  <p className="text-xs text-muted-foreground">
                    Last synced {formatDistanceToNow(new Date(s.lastSync), { addSuffix: true })}
                  </p>
                )}
              </div>
              {s.action && (
                <Button variant="outline" size="sm" onClick={s.action.onClick} disabled={s.action.loading || isRefreshingAll} className="shrink-0">
                  {s.action.loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  {s.action.label}
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
