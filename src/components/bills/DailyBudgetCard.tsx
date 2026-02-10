import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { usePayCycleData } from "@/hooks/usePayCycleData";
import { usePaydaySettings } from "@/hooks/usePaydaySettings";

export function DailyBudgetCard() {
  const { metrics, isLoading } = usePayCycleData();
  const { effectiveSettings } = usePaydaySettings();

  if (isLoading || !metrics.hasData) return null;

  const dailyBudget = effectiveSettings.daily_budget;
  const totalBudgetSoFar = dailyBudget * metrics.daysPassed;
  
  // Discretionary spend = total expenses minus committed bills
  const discretionarySpent = Math.max(0, metrics.totalSpent - metrics.committedRemaining);
  const surplus = totalBudgetSoFar - discretionarySpent;
  const isOver = surplus < 0;
  
  const progressPercent = totalBudgetSoFar > 0
    ? Math.min(100, (discretionarySpent / totalBudgetSoFar) * 100)
    : 0;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isOver ? 'bg-destructive/10' : 'bg-success/10'}`}>
              <Wallet className={`h-5 w-5 ${isOver ? 'text-destructive' : 'text-success'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Daily Budget · £{dailyBudget}/day · Day {metrics.daysPassed}/{metrics.daysTotal}
              </p>
              <div className="flex items-center gap-2">
                {isOver ? (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-success" />
                )}
                <span className={`text-xl font-bold ${isOver ? 'text-destructive' : 'text-success'}`}>
                  {isOver ? '−' : '+'}£{Math.abs(surplus).toFixed(2)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {isOver ? 'over budget' : 'saved up'}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>£{discretionarySpent.toFixed(0)} / £{totalBudgetSoFar.toFixed(0)}</p>
          </div>
        </div>
        <Progress 
          value={progressPercent} 
          className={`mt-3 h-2 ${isOver ? '[&>div]:bg-destructive' : '[&>div]:bg-success'}`}
        />
      </CardContent>
    </Card>
  );
}
