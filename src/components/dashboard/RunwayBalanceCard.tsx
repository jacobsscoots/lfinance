import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { formatCurrency, getSafeToSpendColor, type PayCycleMetrics, type BalanceProjection } from "@/lib/dashboardCalculations";
import { cn } from "@/lib/utils";

interface RunwayBalanceCardProps {
  metrics: PayCycleMetrics;
  isLoading?: boolean;
}

function BalanceTimeline({ 
  startBalance, 
  currentBalance, 
  projection,
  daysPassed,
  daysTotal,
}: { 
  startBalance: number; 
  currentBalance: number; 
  projection: BalanceProjection;
  daysPassed: number;
  daysTotal: number;
}) {
  const progressPercent = Math.min(100, (daysPassed / daysTotal) * 100);
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Start</span>
        <span>Now</span>
        <span>End (projected)</span>
      </div>
      <div className="relative">
        <Progress value={progressPercent} className="h-3" />
        <div 
          className="absolute top-0 h-3 w-1 bg-foreground rounded"
          style={{ left: `${progressPercent}%`, transform: 'translateX(-50%)' }}
        />
      </div>
      <div className="flex justify-between text-sm font-medium">
        <span className="text-muted-foreground">{formatCurrency(startBalance)}</span>
        <span className="text-foreground">{formatCurrency(currentBalance)}</span>
        <span className={cn(
          projection.expected >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        )}>
          ~{formatCurrency(projection.expected)}
        </span>
      </div>
    </div>
  );
}

function ProjectionBand({ projection }: { projection: BalanceProjection }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <TrendingUp className="h-3 w-3 text-emerald-500" />
      <span>Best: {formatCurrency(projection.best)}</span>
      <span className="text-border">|</span>
      <TrendingDown className="h-3 w-3 text-amber-500" />
      <span>Worst: {formatCurrency(projection.worst)}</span>
    </div>
  );
}

export function RunwayBalanceCard({ metrics, isLoading }: RunwayBalanceCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (!metrics.hasData) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" />
            Runway & Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Connect an account to see your runway
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const safeToSpendColor = getSafeToSpendColor(metrics.safeToSpendPerDay);
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" />
            Runway & Balance
          </CardTitle>
          <Badge variant="secondary" className="text-sm">
            {metrics.daysRemaining} days left
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Key Stats Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Balance</p>
            <p className="text-2xl font-bold">{formatCurrency(metrics.currentBalance)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Safe to spend</p>
            <p className={cn(
              "text-2xl font-bold",
              safeToSpendColor === "danger" && "text-red-600 dark:text-red-400",
              safeToSpendColor === "warning" && "text-amber-600 dark:text-amber-400",
              safeToSpendColor === "default" && "text-emerald-600 dark:text-emerald-400"
            )}>
              {formatCurrency(metrics.safeToSpendPerDay)}<span className="text-sm font-normal">/day</span>
            </p>
          </div>
        </div>

        {/* Runway breakdown */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Start of today</span>
            <span className="font-medium">{formatCurrency(metrics.anchorBalance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Spent today</span>
            <span className="font-medium text-destructive">−{formatCurrency(metrics.spentToday)}</span>
          </div>
          <div className="border-t pt-1.5 flex justify-between font-medium">
            <span>Remaining</span>
            <span>{formatCurrency(metrics.remainingBalance)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>÷ {metrics.daysRemaining} days left</span>
            <span>= {formatCurrency(metrics.safeToSpendPerDay)}/day</span>
          </div>
        </div>

        {/* Budget Buffer - Ahead/Behind Plan */}
        <div className="rounded-lg border p-3 space-y-1.5 text-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Budget Plan (£{metrics.dailyBudget}/day)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plan remaining ({metrics.daysRemaining} days)</span>
            <span className="font-medium">{formatCurrency(metrics.planRemaining)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Start-of-day buffer</span>
            <span className={cn("font-medium", metrics.bufferStart >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
              {metrics.bufferStart >= 0 ? "+" : ""}{formatCurrency(metrics.bufferStart)}
            </span>
          </div>
          <div className="border-t pt-1.5 flex justify-between font-semibold">
            <span>{metrics.bufferTomorrow >= 0 ? "Ahead of plan" : "Behind plan"}</span>
            <span className={cn(
              metrics.bufferTomorrow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}>
              {metrics.bufferTomorrow >= 0 ? "+" : ""}{formatCurrency(metrics.bufferTomorrow)}
            </span>
          </div>
        </div>
        
        {/* Balance Timeline */}
        <BalanceTimeline 
          startBalance={metrics.startBalance}
          currentBalance={metrics.currentBalance}
          projection={metrics.projectedEndBalance}
          daysPassed={metrics.daysPassed}
          daysTotal={metrics.daysTotal}
        />
        
        {/* Projection Band */}
        <ProjectionBand projection={metrics.projectedEndBalance} />
        
        {/* Risk Warning */}
        {metrics.runwayRisk && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">
              Low runway: {formatCurrency(metrics.discretionaryRemaining)} for {metrics.daysRemaining} days
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
