import { format, parse } from "date-fns";
import { AlertTriangle, Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MealPlan, MealType } from "@/hooks/useMealPlanItems";
import { NutritionSettings } from "@/hooks/useNutritionSettings";
import { 
  DayMacros, 
  getBalanceWarnings,
  BalanceWarning,
} from "@/lib/mealCalculations";
import { getDailyTargets, computeTotals, MacroTotals, WeeklyTargetsOverride } from "@/lib/dailyTargets";
import { MealBreakdownList } from "./MealBreakdownList";
import { DayMacroSummary } from "./DayMacroSummary";
import { cn } from "@/lib/utils";
import { logPortioningUiComparison, PortioningDebugItem, PortioningDebugTotals } from "@/lib/portioningDebug";
import { useEffect } from "react";


interface DayDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: MealPlan;
  dayMacros: DayMacros;
  settings: NutritionSettings | null | undefined;
  onEdit?: () => void;
  weeklyOverride?: WeeklyTargetsOverride | null;
}

function getDiffText(actual: number, target: number, unit: string): string {
  const diff = actual - target;
  if (Math.abs(diff) < 1) return "on target";
  return diff > 0 ? `+${Math.round(diff)}${unit}` : `${Math.round(diff)}${unit}`;
}

function getDiffClass(actual: number, target: number): string {
  const ratio = target > 0 ? actual / target : 1;
  if (ratio >= 0.90 && ratio <= 1.05) return "text-green-600";
  if (ratio >= 0.80 && ratio <= 1.15) return "text-amber-600";
  return "text-red-600";
}

export function DayDetailModal({ 
  open, 
  onOpenChange, 
  plan, 
  dayMacros, 
  settings,
  onEdit,
  weeklyOverride 
}: DayDetailModalProps) {
  // Parse as local date to avoid UTC-shift issues
  const date = parse(plan.meal_date, "yyyy-MM-dd", new Date());
  const isTargetMode = settings?.mode === "target_based";
  
  // Use unified getDailyTargets for single source of truth
  const targets = getDailyTargets(date, settings, weeklyOverride);
  
  const warnings = getBalanceWarnings(dayMacros, settings);
  const items = plan.items || [];
  
  // Use unified computeTotals for consistent totals calculation
  const uiTotals = computeTotals(items);

  // Check if there are items with zero grams (uncalculated)
  const hasUncalculatedItems = items.some(item => 
    item.quantity_grams === 0 && item.product?.product_type === "editable"
  );

  // Check for missing nutrition data
  const itemsMissingNutrition = items.filter(item => 
    item.product && 
    !item.product.ignore_macros && 
    (item.product.calories_per_100g === 0 || item.product.protein_per_100g === 0)
  );

  // Calculate actual success based on macro differences using unified totals
  const calDiff = Math.abs(uiTotals.calories - targets.calories);
  const proDiff = Math.abs(uiTotals.protein - targets.protein);
  const carbDiff = Math.abs(uiTotals.carbs - targets.carbs);
  const fatDiff = Math.abs(uiTotals.fat - targets.fat);
  
  // Success = all macros within tolerance (±1g for P/C/F, <5 kcal for calories)
  const macrosWithinTolerance = calDiff < 5 && proDiff <= 1 && carbDiff <= 1 && fatDiff <= 1;
  const hasItems = items.length > 0;
  
  // Build specific failure messages for clarity
  const failedMacros: string[] = [];
  if (proDiff > 1) failedMacros.push(`Protein: ${Math.round(uiTotals.protein - targets.protein) >= 0 ? '+' : ''}${Math.round(uiTotals.protein - targets.protein)}g`);
  if (carbDiff > 1) failedMacros.push(`Carbs: ${Math.round(uiTotals.carbs - targets.carbs) >= 0 ? '+' : ''}${Math.round(uiTotals.carbs - targets.carbs)}g`);
  if (fatDiff > 1) failedMacros.push(`Fat: ${Math.round(uiTotals.fat - targets.fat) >= 0 ? '+' : ''}${Math.round(uiTotals.fat - targets.fat)}g`);
  if (calDiff >= 5) failedMacros.push(`Calories: ${Math.round(uiTotals.calories - targets.calories) >= 0 ? '+' : ''}${Math.round(uiTotals.calories - targets.calories)}`);

  // Portioning settings info (not used in UI but kept for future)
  const portioningSettings = {
    rounding: settings?.portion_rounding || 5,
    min: settings?.min_grams_per_item || 10,
    max: settings?.max_grams_per_item || 500,
    tolerance: settings?.target_tolerance_percent || 2,
  };

  // DEV ONLY: log comparison with solver totals when modal opens
  useEffect(() => {
    if (!open) return;
    // Build UI item list
    const uiItems: PortioningDebugItem[] = items.map(item => {
      const p = item.product;
      return {
        itemId: item.id,
        name: p?.name ?? "?",
        mealType: item.meal_type,
        grams: item.quantity_grams,
        per100g: {
          calories: p?.calories_per_100g ?? 0,
          protein: p?.protein_per_100g ?? 0,
          carbs: p?.carbs_per_100g ?? 0,
          fat: p?.fat_per_100g ?? 0,
        },
        contribution: {
          calories: (p?.calories_per_100g ?? 0) * item.quantity_grams / 100,
          protein: (p?.protein_per_100g ?? 0) * item.quantity_grams / 100,
          carbs: (p?.carbs_per_100g ?? 0) * item.quantity_grams / 100,
          fat: (p?.fat_per_100g ?? 0) * item.quantity_grams / 100,
        },
        flags: {
          locked: item.is_locked,
          fixed: p?.product_type === "fixed",
          ignored: !!p?.ignore_macros,
          seasoningLike: false,
        },
      };
    });
    logPortioningUiComparison({
      mealDate: plan.meal_date,
      uiTargets: targets,
      uiAchieved: uiTotals,
      uiItems,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <div className="text-lg">{format(date, "EEEE d MMMM")}</div>
              {isTargetMode && (
                <div className="text-xs font-normal text-muted-foreground mt-1">
                  Target: {targets.calories} kcal | {targets.protein}g P | {targets.carbs}g C | {targets.fat}g F
                </div>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Warnings */}
        {(warnings.length > 0 || hasUncalculatedItems || itemsMissingNutrition.length > 0) && (
          <Alert variant={hasUncalculatedItems ? "default" : "destructive"} className={hasUncalculatedItems ? "bg-amber-500/10 border-amber-500/30" : "bg-destructive/10"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <ul className="list-disc list-inside space-y-0.5">
                {hasUncalculatedItems && (
                  <li className="text-amber-700 dark:text-amber-400">
                    Some items have 0g portions — click <strong>Generate Portions</strong> to auto-calculate
                  </li>
                )}
                {itemsMissingNutrition.length > 0 && (
                  <li>
                    {itemsMissingNutrition.length} item(s) missing nutrition data 
                    (treated as 0, may affect accuracy)
                  </li>
                )}
                {warnings.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* Meal Breakdown */}
        <div className="space-y-4">
          {(["breakfast", "lunch", "dinner", "snack"] as MealType[]).map(mealType => {
            const mealItems = items.filter(i => i.meal_type === mealType);
            const status = getMealStatus(plan, mealType);
            const mealMacros = dayMacros.meals.find(m => m.mealType === mealType);
            
            return (
              <MealBreakdownList
                key={mealType}
                mealType={mealType}
                items={mealItems}
                status={status}
                mealMacros={mealMacros}
              />
            );
          })}
        </div>

        <Separator />

        {/* Day Totals */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Day Totals</h4>
          
          {isTargetMode ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Calories</span>
                <span>
                  {Math.round(uiTotals.calories)} / {targets.calories}
                  <span className={cn("ml-2 text-xs", getDiffClass(uiTotals.calories, targets.calories))}>
                    ({getDiffText(uiTotals.calories, targets.calories, "")})
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Protein</span>
                <span>
                  {Math.round(uiTotals.protein)}g / {targets.protein}g
                  <span className={cn("ml-2 text-xs", getDiffClass(uiTotals.protein, targets.protein))}>
                    ({getDiffText(uiTotals.protein, targets.protein, "g")})
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Carbs</span>
                <span>
                  {Math.round(uiTotals.carbs)}g / {targets.carbs}g
                  <span className={cn("ml-2 text-xs", getDiffClass(uiTotals.carbs, targets.carbs))}>
                    ({getDiffText(uiTotals.carbs, targets.carbs, "g")})
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fat</span>
                <span>
                  {Math.round(uiTotals.fat)}g / {targets.fat}g
                  <span className={cn("ml-2 text-xs", getDiffClass(uiTotals.fat, targets.fat))}>
                    ({getDiffText(uiTotals.fat, targets.fat, "g")})
                  </span>
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Calories</span>
                <span>{Math.round(uiTotals.calories)} kcal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Protein</span>
                <span>{Math.round(uiTotals.protein)}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Carbs</span>
                <span>{Math.round(uiTotals.carbs)}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fat</span>
                <span>{Math.round(uiTotals.fat)}g</span>
              </div>
            </div>
          )}
        </div>

        {/* Portioning Notes (only in target mode) */}
        {isTargetMode && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Calculation Status
              </h4>
              
              {/* Dynamic status based on ACTUAL results, not settings */}
              {hasItems && !hasUncalculatedItems && (
                <div className={cn(
                  "text-xs px-3 py-2 rounded-md border",
                  macrosWithinTolerance 
                    ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                )}>
                  {macrosWithinTolerance ? (
                    <span className="flex items-center gap-2">
                      <span className="font-semibold">✓ Targets achieved</span>
                      <span className="text-muted-foreground">— all macros within ±1g tolerance</span>
                    </span>
                  ) : (
                    <div className="space-y-1">
                      <span className="font-semibold">⚠ Targets not fully achieved</span>
                      {failedMacros.length > 0 && (
                        <div className="text-[11px] text-muted-foreground">
                          Off by: {failedMacros.join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <ul className="text-xs text-muted-foreground space-y-1 pl-4 list-disc">
                <li>Calories split evenly across breakfast/lunch/dinner</li>
                {items.some(i => i.is_locked) && (
                  <li>Locked items are not adjusted during generation</li>
                )}
                {items.some(i => i.product?.product_type === "fixed") && (
                  <li>Fixed-portion items use their preset gram amount</li>
                )}
              </ul>
            </div>
          </>
        )}

        {/* Footer */}
        {onEdit && (
          <>
            <Separator />
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={onEdit}>
                Edit Day
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function getMealStatus(plan: MealPlan, mealType: MealType) {
  switch (mealType) {
    case "breakfast": return plan.breakfast_status;
    case "lunch": return plan.lunch_status;
    case "dinner": return plan.dinner_status;
    case "snack": return plan.snack_status;
  }
}
