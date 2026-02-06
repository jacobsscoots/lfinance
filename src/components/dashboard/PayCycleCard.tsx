import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { getNextPayday, getDaysUntilPayday, getCurrentPayCycle } from "@/lib/payday";
import { usePayCycleSummary } from "@/hooks/useDashboardData";
import { Skeleton } from "@/components/ui/skeleton";

export function PayCycleCard() {
  const nextPayday = getNextPayday();
  const daysUntil = getDaysUntilPayday();
  const { start, end } = getCurrentPayCycle();
  const { data, isLoading } = usePayCycleSummary();

  const percentUsed = data?.percentUsed || 0;
  const isOnTrack = percentUsed <= 75;
  const isWarning = percentUsed > 75 && percentUsed <= 90;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-primary/5 border-b">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="h-5 w-5 text-primary" />
          Pay Cycle Status
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Days until payday */}
          <div className="text-center">
            <div className="text-5xl font-bold text-primary mb-1">
              {daysUntil}
            </div>
            <p className="text-sm text-muted-foreground">
              {daysUntil === 1 ? "day" : "days"} until payday
            </p>
          </div>

          {/* Next payday date */}
          <div className="flex items-center justify-between py-3 border-t">
            <span className="text-sm text-muted-foreground">Next payday</span>
            <span className="font-medium">{format(nextPayday, "EEE, d MMM yyyy")}</span>
          </div>

          {/* Current cycle */}
          <div className="flex items-center justify-between py-3 border-t">
            <span className="text-sm text-muted-foreground">Current cycle</span>
            <span className="text-sm font-medium">
              {format(start, "d MMM")} - {format(end, "d MMM")}
            </span>
          </div>

          {/* Spending pace indicator */}
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Spending pace</span>
              {isLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                <span className={`text-sm font-medium flex items-center gap-1 ${
                  isOnTrack ? "text-success" : isWarning ? "text-warning" : "text-destructive"
                }`}>
                  {isOnTrack ? (
                    <>
                      <TrendingUp className="h-4 w-4" />
                      On track
                    </>
                  ) : isWarning ? (
                    <>
                      <AlertTriangle className="h-4 w-4" />
                      Caution
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-4 w-4" />
                      Over budget
                    </>
                  )}
                </span>
              )}
            </div>
            {isLoading ? (
              <Skeleton className="h-2 w-full rounded-full" />
            ) : (
              <>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      isOnTrack ? "bg-success" : isWarning ? "bg-warning" : "bg-destructive"
                    }`}
                    style={{ width: `${Math.min(percentUsed, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {percentUsed.toFixed(0)}% of budget used • {(100 - percentUsed).toFixed(0)}% remaining
                </p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
