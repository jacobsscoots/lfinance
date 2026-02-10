import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MonthData } from "@/hooks/useYearlyPlannerData";

interface YearlySummaryBarProps {
  months: MonthData[];
}

function fmt(n: number) {
  return `£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function YearlySummaryBar({ months }: YearlySummaryBarProps) {
  const totalIncome = months.reduce((s, m) => s + m.totalIncome, 0);
  const totalOutgoings = months.reduce((s, m) => s + m.totalOutgoings, 0);
  const totalNet = totalIncome - totalOutgoings;
  const lowestMonth = months.reduce((min, m) => m.runningSurplus < min.runningSurplus ? m : min, months[0]);

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <Card>
      <CardContent className="py-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3 w-3" />
              Total Income
            </div>
            <p className="text-xl font-bold text-success">{fmt(totalIncome)}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
              <Receipt className="h-3 w-3" />
              Total Outgoings
            </div>
            <p className="text-xl font-bold">{fmt(totalOutgoings)}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
              <Wallet className="h-3 w-3" />
              Year Net
            </div>
            <p className={cn("text-xl font-bold", totalNet >= 0 ? "text-success" : "text-destructive")}>
              {totalNet >= 0 ? '+' : '-'}{fmt(totalNet)}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
              <TrendingDown className="h-3 w-3" />
              Tightest Month
            </div>
            <p className={cn("text-xl font-bold", lowestMonth?.runningSurplus >= 0 ? "text-warning" : "text-destructive")}>
              {MONTH_NAMES[lowestMonth?.month ?? 0]}
            </p>
            <p className="text-xs text-muted-foreground">
              Running: {lowestMonth ? (lowestMonth.runningSurplus >= 0 ? '+' : '-') : ''}{fmt(lowestMonth?.runningSurplus ?? 0)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
