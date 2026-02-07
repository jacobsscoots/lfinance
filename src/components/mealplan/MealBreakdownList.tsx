import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MealPlanItem, MealType, MealStatus } from "@/hooks/useMealPlanItems";
import { MealMacros, calculateItemMacros } from "@/lib/mealCalculations";
import { cn } from "@/lib/utils";

interface MealBreakdownListProps {
  mealType: MealType;
  items: MealPlanItem[];
  status: MealStatus;
  mealMacros?: MealMacros;
}

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "BREAKFAST",
  lunch: "LUNCH",
  dinner: "DINNER",
  snack: "SNACKS",
};

export function MealBreakdownList({ mealType, items, status, mealMacros }: MealBreakdownListProps) {
  const totalCalories = mealMacros?.calories || 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-muted-foreground">
          {MEAL_LABELS[mealType]} 
          {status !== "skipped" && (
            <span className="ml-2 text-foreground">
              ({Math.round(totalCalories)} kcal)
            </span>
          )}
        </h4>
        {status === "skipped" && (
          <Badge variant="secondary" className="text-xs">Skipped</Badge>
        )}
        {status === "eating_out" && (
          <Badge variant="outline" className="text-xs text-primary">Eating Out</Badge>
        )}
      </div>

      {status === "skipped" ? (
        <p className="text-xs text-muted-foreground italic pl-4">No meal planned</p>
      ) : status === "eating_out" ? (
        <p className="text-xs text-muted-foreground pl-4">
          Estimated {Math.round(totalCalories)} kcal from eating out
        </p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic pl-4">No items added</p>
      ) : (
        <div className="space-y-1 pl-4">
          {items.map((item, index) => {
            const itemMacros = calculateItemMacros(item);
            const isLast = index === items.length - 1;
            const prefix = isLast ? "└" : "├";

            return (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs gap-2"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-muted-foreground font-mono">{prefix}</span>
                  {item.is_locked && (
                    <Lock className="h-3 w-3 text-primary flex-shrink-0" />
                  )}
                  {item.product?.product_type === "fixed" && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 flex-shrink-0">
                      Fixed
                    </Badge>
                  )}
                  <span className="truncate">{item.product?.name || "Unknown"}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground flex-shrink-0">
                  <span>{item.quantity_grams}g</span>
                  <span className="min-w-[60px] text-right">
                    {Math.round(itemMacros.calories)} kcal
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
