import { MacroTotals } from "@/lib/mealCalculations";
import { cn } from "@/lib/utils";

interface DayMacroSummaryProps {
  totals: MacroTotals;
  targets: MacroTotals;
  isTargetMode: boolean;
  compact?: boolean;
}

type Status = "success" | "warning" | "error";

function getStatus(actual: number, target: number): Status {
  if (target === 0) return "success";
  const diff = Math.abs(actual - target);
  // Exact match within 5 units = success
  if (diff <= 5) return "success";
  // Within 10% = warning
  if (diff <= target * 0.1) return "warning";
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
}

function MacroCell({ label, actual, target, unit, showBar, compact }: MacroCellProps) {
  const status = getStatus(actual, target);
  const percent = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
  const diff = getDiffLabel(actual, target);
  
  if (compact) {
    // Simplified compact view - just show actual value with status indicator
    return (
      <div className="text-center min-w-0">
        <div className="text-[10px] text-muted-foreground truncate">{label}</div>
        <div className={cn(
          "text-xs font-medium tabular-nums",
          status === "success" && "text-green-600 dark:text-green-400",
          status === "warning" && "text-amber-600 dark:text-amber-400",
          status === "error" && "text-red-600 dark:text-red-400"
        )}>
          {Math.round(actual)}
        </div>
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
    // Compact 4-column layout for card headers - fixed width columns
    return (
      <div className="grid grid-cols-4 gap-2 text-xs py-1">
        <MacroCell 
          label="Cal" 
          actual={totals.calories} 
          target={targets.calories} 
          unit="kcal"
          showBar={isTargetMode}
          compact
        />
        <MacroCell 
          label="P" 
          actual={totals.protein} 
          target={targets.protein} 
          unit="g"
          showBar={isTargetMode}
          compact
        />
        <MacroCell 
          label="C" 
          actual={totals.carbs} 
          target={targets.carbs} 
          unit="g"
          showBar={isTargetMode}
          compact
        />
        <MacroCell 
          label="F" 
          actual={totals.fat} 
          target={targets.fat} 
          unit="g"
          showBar={isTargetMode}
          compact
        />
      </div>
    );
  }

  // Full layout with progress bars
  return (
    <div className="space-y-2 text-xs">
      <MacroCell 
        label="Calories" 
        actual={totals.calories} 
        target={targets.calories} 
        unit="kcal"
        showBar={isTargetMode}
      />
      <MacroCell 
        label="Protein" 
        actual={totals.protein} 
        target={targets.protein} 
        unit="g"
        showBar={isTargetMode}
      />
      <MacroCell 
        label="Carbs" 
        actual={totals.carbs} 
        target={targets.carbs} 
        unit="g"
        showBar={isTargetMode}
      />
      <MacroCell 
        label="Fat" 
        actual={totals.fat} 
        target={targets.fat} 
        unit="g"
        showBar={isTargetMode}
      />
    </div>
  );
}
