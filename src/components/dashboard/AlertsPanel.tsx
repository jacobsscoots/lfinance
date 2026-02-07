import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  ChevronRight,
  Lightbulb,
} from "lucide-react";
import { type Alert } from "@/lib/dashboardCalculations";
import { cn } from "@/lib/utils";

interface AlertsPanelProps {
  alerts: Alert[];
  isLoading?: boolean;
}

const alertStyles = {
  danger: {
    icon: AlertCircle,
    bgClass: "bg-destructive/10 border-destructive/20",
    iconClass: "text-destructive",
    badgeVariant: "destructive" as const,
  },
  warning: {
    icon: AlertTriangle,
    bgClass: "bg-amber-500/10 border-amber-500/20",
    iconClass: "text-amber-600 dark:text-amber-400",
    badgeVariant: "secondary" as const,
  },
  info: {
    icon: Info,
    bgClass: "bg-blue-500/10 border-blue-500/20",
    iconClass: "text-blue-600 dark:text-blue-400",
    badgeVariant: "secondary" as const,
  },
  success: {
    icon: CheckCircle2,
    bgClass: "bg-emerald-500/10 border-emerald-500/20",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    badgeVariant: "secondary" as const,
  },
};

function AlertItem({ alert }: { alert: Alert }) {
  const style = alertStyles[alert.type];
  const Icon = style.icon;
  
  return (
    <div className={cn(
      "p-3 rounded-lg border",
      style.bgClass
    )}>
      <div className="flex items-start gap-3">
        <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", style.iconClass)} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{alert.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
          
          {alert.action && (
            <div className="mt-2 flex items-center gap-2">
              <Lightbulb className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {alert.action.description}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AlertsPanel({ alerts, isLoading }: AlertsPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }
  
  // Sort alerts by severity
  const sortedAlerts = [...alerts].sort((a, b) => {
    const order = { danger: 0, warning: 1, info: 2, success: 3 };
    return order[a.type] - order[b.type];
  });
  
  const dangerCount = alerts.filter(a => a.type === "danger").length;
  const warningCount = alerts.filter(a => a.type === "warning").length;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Alerts & Actions</CardTitle>
          {(dangerCount > 0 || warningCount > 0) && (
            <div className="flex gap-1">
              {dangerCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {dangerCount}
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  {warningCount}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sortedAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
            <p className="text-sm font-medium">All good!</p>
            <p className="text-xs text-muted-foreground">No alerts right now</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedAlerts.map(alert => (
              <AlertItem key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
