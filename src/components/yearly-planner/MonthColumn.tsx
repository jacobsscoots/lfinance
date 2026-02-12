import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MonthData, YearlyOverride } from "@/hooks/useYearlyPlannerData";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface MonthColumnProps {
  data: MonthData;
  onAddOverride: (month: number) => void;
  onDeleteOverride: (id: string) => void;
}

function formatCurrency(n: number) {
  return `£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function MonthColumn({ data, onAddOverride, onDeleteOverride }: MonthColumnProps) {
  const netColor = data.net >= 0 ? "text-success" : "text-destructive";
  const surplusColor = data.runningSurplus >= 0 ? "text-success" : "text-destructive";
  const surplusBg = data.runningSurplus < 0 
    ? "bg-destructive/10 border-destructive/30" 
    : data.runningSurplus < 100 
      ? "bg-warning/10 border-warning/30" 
      : "bg-success/10 border-success/30";

  return (
    <Card className={cn("min-w-[140px]", data.isPast && "opacity-80")}>
      <CardHeader className="pb-2 px-3 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          {MONTH_NAMES[data.month]}
          {data.isPast ? (
            <Badge variant="secondary" className="text-[10px] px-1">Actual</Badge>
          ) : data.isEstimated ? (
            <Badge variant="outline" className="text-[10px] px-1 border-primary/50 text-primary">Est.</Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Income</span>
          <span className="font-medium text-success">{formatCurrency(data.totalIncome)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Bills</span>
          <span className="font-medium">{formatCurrency(data.bills)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Spending</span>
          <span className="font-medium">{formatCurrency(data.discretionary)}</span>
        </div>
        {data.birthdayOutgoings > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">🎂 Birthdays</span>
            <span className="font-medium">{formatCurrency(data.birthdayOutgoings)}</span>
          </div>
        )}

        {/* Overrides */}
        {data.overrides.length > 0 && (
          <div className="border-t pt-1 space-y-1">
            {data.overrides.map(o => (
              <div key={o.id} className="flex items-center justify-between gap-1">
                <span className="truncate text-muted-foreground">{o.label}</span>
                <div className="flex items-center gap-1">
                  <span className={o.type === 'income' ? 'text-success' : 'text-destructive'}>
                    {o.type === 'income' ? '+' : '-'}{formatCurrency(o.amount)}
                  </span>
                  <button onClick={() => onDeleteOverride(o.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t pt-2 space-y-1">
          <div className="flex justify-between font-semibold">
            <span>Net</span>
            <span className={netColor}>
              {data.net >= 0 ? '+' : '-'}{formatCurrency(data.net)}
            </span>
          </div>
          <div className={cn("flex justify-between font-bold rounded px-1 py-0.5 border", surplusBg)}>
            <span className="text-[10px]">Running</span>
            <span className={surplusColor}>
              {data.runningSurplus >= 0 ? '+' : '-'}{formatCurrency(data.runningSurplus)}
            </span>
          </div>
        </div>

        {!data.isPast && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-6 text-xs"
            onClick={() => onAddOverride(data.month + 1)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Adjust
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
