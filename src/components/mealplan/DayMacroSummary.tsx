import { MacroTotals } from "@/lib/mealCalculations";
import { cn } from "@/lib/utils";

interface DayMacroSummaryProps {
  totals: MacroTotals;
  targets: MacroTotals;
  isTargetMode: boolean;
  compact?: boolean;
}

type Status = "success" | "warning" | "error";

function getStatus(actual: number, target: number, isCal = false): Status {
  if (target === 0) return "success";
  const diff = Math.abs(actual - target);
  // Use tolerance rules: ±1g for macros, ±50 kcal for calories
  const tolerance = isCal ? 50 : 1;
  if (diff <= tolerance) return "success";
  // Wider warning band
  const warnTolerance = isCal ? 100 : 5;
  if (diff <= warnTolerance) return "warning";
  return "error";
}

function getStatusColor(status: Status): string {
  switch (status) {
    case "success": return "bg-green-500";
    case "warning": return "bg-amber-500";
    case "error": return "bg-red-500";
  }
}

function getDiffLabel(actual: number, target: number): string {
  const diff = actual - target;
  if (Math.abs(diff) < 1) return "";
  return diff > 0 ? `+${Math.round(diff)}` : `${Math.round(diff)}`;
}

interface MacroCellProps {
  label: string;
  actual: number;
  target: number;
  unit: string;
  showBar: boolean;
  compact?: boolean;
  isCal?: boolean;
}

function MacroCell({ label, actual, target, unit, showBar, compact, isCal = false }: MacroCellProps) {
  const status = getStatus(actual, target, isCal);
  const percent = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
  const diff = getDiffLabel(actual, target);

  if (compact) {
    return (
      <div className="text-center min-w-0 overflow-hidden">
        <div className="text-[10px] text-muted-foreground truncate">{label}</div>
        <div className={cn(
          "text-[11px] font-medium tabular-nums leading-tight",
          status === "success" && "text-green-600 dark:text-green-400",
          status === "warning" && "text-amber-600 dark:text-amber-400",
          status === "error" && "text-red-600 dark:text-red-400"
        )}>
          <span>{Math.round(actual)}</span>
          {showBar && target > 0 && (
            <span className="text-muted-foreground font-normal">/{target}</span>
          )}
        </div>
        {diff && showBar && (
          <div className={cn(
            "text-[9px] tabular-nums leading-tight",
            status === "success" && "text-green-600 dark:text-green-400",
            status === "warning" && "text-amber-600 dark:text-amber-400",
            status === "error" && "text-red-600 dark:text-red-400"
          )}>
            {diff}{unit}
          </div>
        )}
        {showBar && (
          <div className="mt-0.5 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full transition-all", getStatusColor(status))}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {Math.round(actual)}
          {showBar && target > 0 && (
            <span className="text-muted-foreground">/{target}</span>
          )}
          <span className="text-[10px] text-muted-foreground ml-0.5">{unit}</span>
        </span>
      </div>
      {showBar && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div 
              className={cn("h-full transition-all", getStatusColor(status))}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          {diff && (
            <span className={cn(
              "text-[10px] min-w-[30px] text-right tabular-nums",
              status === "success" && "text-emerald-600 dark:text-emerald-400",
              status === "warning" && "text-amber-600 dark:text-amber-400",
              status === "error" && "text-destructive"
            )}>
              {diff}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function DayMacroSummary({ totals, targets, isTargetMode, compact = false }: DayMacroSummaryProps) {
  if (compact) {
    return (
      <div className="grid grid-cols-4 gap-1 text-xs py-1">
        <MacroCell label="Cal" actual={totals.calories} target={targets.calories} unit="kcal" showBar={isTargetMode} compact isCal />
        <MacroCell label="P" actual={totals.protein} target={targets.protein} unit="g" showBar={isTargetMode} compact />
        <MacroCell label="C" actual={totals.carbs} target={targets.carbs} unit="g" showBar={isTargetMode} compact />
        <MacroCell label="F" actual={totals.fat} target={targets.fat} unit="g" showBar={isTargetMode} compact />
      </div>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      <MacroCell label="Calories" actual={totals.calories} target={targets.calories} unit="kcal" showBar={isTargetMode} isCal />
      <MacroCell label="Protein" actual={totals.protein} target={targets.protein} unit="g" showBar={isTargetMode} />
      <MacroCell label="Carbs" actual={totals.carbs} target={targets.carbs} unit="g" showBar={isTargetMode} />
      <MacroCell label="Fat" actual={totals.fat} target={targets.fat} unit="g" showBar={isTargetMode} />
    </div>
  );
}
