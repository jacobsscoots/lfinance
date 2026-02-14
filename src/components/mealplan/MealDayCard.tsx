import { useState } from "react";
import { format, parse } from "date-fns";
import { Plus, MoreVertical, Lock, Unlock, ExternalLink, XCircle, Utensils, Eye, Copy, Trash2, RefreshCw, Loader2, Palmtree, CalendarDays, Sparkles, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MealPlan, MealType, MealStatus, useMealPlanItems } from "@/hooks/useMealPlanItems";
import { Product } from "@/hooks/useProducts";
import { NutritionSettings } from "@/hooks/useNutritionSettings";
import { DayMacros, MealMacros } from "@/lib/mealCalculations";
import { getDailyTargets, MacroTotals, WeeklyTargetsOverride } from "@/lib/dailyTargets";
import { MealItemMultiSelectDialog } from "./MealItemMultiSelectDialog";
import { EatingOutDialog, EatingOutData } from "./EatingOutDialog";
import { DayDetailModal } from "./DayDetailModal";
import { DayMacroSummary } from "./DayMacroSummary";
import { CopyToDateDialog } from "./CopyToDateDialog";
import { DEFAULT_PORTIONING_SETTINGS } from "@/lib/autoPortioning";
import { cn } from "@/lib/utils";

interface MealDayCardProps {
  plan: MealPlan;
  dayMacros: DayMacros;
  products: Product[];
  settings: NutritionSettings | null | undefined;
  weekStart: Date;
  isBlackout?: boolean;
  blackoutReason?: string | null;
  weeklyOverride?: WeeklyTargetsOverride | null;
  previousWeekOverride?: WeeklyTargetsOverride | null;
  weekDates?: string[];
  mealPlans?: MealPlan[];
}

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

const STATUS_ICONS: Record<MealStatus, React.ReactNode> = {
  planned: null,
  skipped: <XCircle className="h-3 w-3 text-muted-foreground" />,
  eating_out: <ExternalLink className="h-3 w-3 text-primary" />,
};

export function MealDayCard({ plan, dayMacros, products, settings, weekStart, isBlackout = false, blackoutReason, weeklyOverride, previousWeekOverride, weekDates, mealPlans = [] }: MealDayCardProps) {
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [eatingOutOpen, setEatingOutOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [copyToDateOpen, setCopyToDateOpen] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>("breakfast");
  const [aiFailInfo, setAiFailInfo] = useState<{ failed: boolean; bestEffort?: boolean; message?: string; suggestions?: string[] } | null>(null);
  
  const { updateMealStatus, removeItem, updateItem, copyDayToNext, copyDayToPrevious, copyDayToDate, clearDay, recalculateDay, aiPlanDay } = useMealPlanItems(weekStart);
  
  // Parse as local date to avoid UTC-shift issues
  const date = parse(plan.meal_date, "yyyy-MM-dd", new Date());
  const isToday = format(new Date(), "yyyy-MM-dd") === plan.meal_date;
  const items = plan.items || [];
  const isTargetMode = settings?.mode === "target_based";
  const isLastDayOfWeek = weekDates 
    ? plan.meal_date === weekDates[weekDates.length - 1] 
    : date.getDay() === 1;
  const isFirstDayOfWeek = weekDates 
    ? plan.meal_date === weekDates[0] 
    : date.getDay() === 0;
  const hasItems = items.length > 0;
  
  const targets: MacroTotals = getDailyTargets(date, settings, weeklyOverride, previousWeekOverride);
  
  // Bug 6 fix: Only show uncalculated banner when NO AI fail is active
  // and items genuinely have 0g (fresh, never-calculated items)
  const hasUncalculatedItems = !aiFailInfo && items.some(item => 
    item.quantity_grams === 0 && item.product?.product_type === "editable"
  );

  // Bug 6 fix: REMOVED the useEffect that cleared aiFailInfo on items.length change.
  // Instead, aiFailInfo is cleared explicitly in these user-initiated actions:
  // - handleGenerate()
  // - handleAiPlan() (already done)
  // - handleAddItem() (via MealItemMultiSelectDialog onSuccess)
  // - handleClearDay()

  if (isBlackout) {
    return (
      <Card className={cn(
        "flex flex-col",
        isToday && "ring-2 ring-primary",
        "bg-muted/30"
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <div>
              <div className="font-semibold">{format(date, "EEEE")}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {format(date, "d MMM")}
              </div>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Palmtree className="h-3 w-3" />
              Holiday
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center py-8 text-center">
          <Palmtree className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <div className="text-sm text-muted-foreground">
            {blackoutReason || "No meal prep"}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getMealStatus = (mealType: MealType): MealStatus => {
    switch (mealType) {
      case "breakfast": return plan.breakfast_status as MealStatus;
      case "lunch": return plan.lunch_status as MealStatus;
      case "dinner": return plan.dinner_status as MealStatus;
      case "snack": return plan.snack_status as MealStatus;
    }
  };

  const getMealMacros = (mealType: MealType): MealMacros | undefined => {
    return dayMacros.meals.find(m => m.mealType === mealType);
  };

  const handleAddItem = (mealType: MealType) => {
    setSelectedMealType(mealType);
    setAddItemOpen(true);
    setAiFailInfo(null); // Bug 6 fix: clear fail on user action
  };

  const handleSetStatus = (mealType: MealType, status: MealStatus) => {
    if (status === "eating_out") {
      setSelectedMealType(mealType);
      setEatingOutOpen(true);
    } else {
      updateMealStatus.mutate({ planId: plan.id, mealType, status });
    }
  };

  const handleEatingOutConfirm = (data: EatingOutData) => {
    updateMealStatus.mutate({
      planId: plan.id,
      mealType: selectedMealType,
      status: "eating_out",
      eatingOutCalories: data.calories,
      eatingOutProtein: data.protein,
      eatingOutCarbs: data.carbs,
      eatingOutFat: data.fat,
      eatingOutLabel: data.label,
    });
    setEatingOutOpen(false);
  };

  const toggleLock = (itemId: string, currentlyLocked: boolean) => {
    updateItem.mutate({ id: itemId, is_locked: !currentlyLocked });
  };

  const handleCopyToNextDay = () => {
    copyDayToNext.mutate({ sourcePlanId: plan.id, sourcePlanDate: plan.meal_date });
  };

  const handleCopyToPreviousDay = () => {
    copyDayToPrevious.mutate({ sourcePlanId: plan.id, sourcePlanDate: plan.meal_date });
  };

  const handleCopyToDate = (targetDate: string) => {
    copyDayToDate.mutate({ 
      sourcePlanId: plan.id, 
      sourcePlanDate: plan.meal_date, 
      targetDate 
    });
    setCopyToDateOpen(false);
  };

  const handleClearDay = () => {
    setAiFailInfo(null); // Bug 6 fix: clear fail on user action
    clearDay.mutate(plan.id);
  };

  const handleGenerate = () => {
    if (!settings) return;
    setAiFailInfo(null); // Bug 6 fix: clear fail on user action
    
    const portioningSettings = {
      minGrams: settings.min_grams_per_item || DEFAULT_PORTIONING_SETTINGS.minGrams,
      maxGrams: settings.max_grams_per_item || DEFAULT_PORTIONING_SETTINGS.maxGrams,
      rounding: settings.portion_rounding || DEFAULT_PORTIONING_SETTINGS.rounding,
      tolerancePercent: settings.target_tolerance_percent || DEFAULT_PORTIONING_SETTINGS.tolerancePercent,
    };
    
    recalculateDay.mutate({ planId: plan.id, settings, portioningSettings, weeklyOverride, previousWeekOverride });
  };

  const handleAiPlan = () => {
    if (!settings) return;
    setAiFailInfo(null); // Clear previous fail state
    aiPlanDay.mutate(
      { planId: plan.id, settings, weeklyOverride, previousWeekOverride },
      {
        onSuccess: (result) => {
          if (result.failed) {
            setAiFailInfo({
              failed: true,
              message: result.violations?.join(", ") || "Targets not achievable",
              suggestions: result.suggested_fixes?.filter((s: string) => !!s) || [],
            });
          } else if (result.bestEffort) {
            // Best effort saved — show amber warning, not red error
            setAiFailInfo({
              failed: false,
              bestEffort: true,
              message: result.violations?.join(", ") || "Closest achievable plan saved",
              suggestions: result.suggested_fixes?.filter((s: string) => !!s) || [],
            });
          } else {
            setAiFailInfo(null);
          }
        },
      }
    );
  };

  return (
    <>
      <Card className={cn(
        "flex flex-col",
        isToday && "ring-2 ring-primary"
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <div>
              <div className="font-semibold">{format(date, "EEEE")}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {format(date, "d MMM")}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isTargetMode && hasItems && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleAiPlan}
                    disabled={aiPlanDay.isPending}
                    title="AI Plan portions"
                  >
                    {aiPlanDay.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleGenerate}
                    disabled={recalculateDay.isPending}
                    title="Generate portions (solver)"
                  >
                    {recalculateDay.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setDetailModalOpen(true)}
                title="View day details"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={handleCopyToNextDay}
                    disabled={isLastDayOfWeek || items.length === 0 || copyDayToNext.isPending}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy to Next Day
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleCopyToPreviousDay}
                    disabled={isFirstDayOfWeek || items.length === 0 || copyDayToPrevious.isPending}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy to Previous Day
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setCopyToDateOpen(true)}
                    disabled={items.length === 0}
                  >
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Copy to Date...
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleClearDay}
                    disabled={items.length === 0 || clearDay.isPending}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Reset Day
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardTitle>
          
          {/* Banner priority: FAIL (red) > Best Effort (amber) > Uncalculated (amber) > Normal macros */}
          <div className="mt-2">
          {aiFailInfo?.failed ? (
              <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5 space-y-1.5">
                <div className="flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  <span className="font-medium">AI Plan failed — no changes saved</span>
                </div>
                {aiFailInfo.message && (
                  <div className="text-[10px] text-destructive/80">{aiFailInfo.message}</div>
                )}
                {aiFailInfo.suggestions && aiFailInfo.suggestions.length > 0 && (
                  <ul className="text-[10px] text-destructive/70 space-y-0.5 list-disc pl-3">
                    {aiFailInfo.suggestions.slice(0, 3).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : aiFailInfo?.bestEffort ? (
              <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-2 py-1.5 space-y-1.5">
                <div className="flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  <span className="font-medium">Best-effort plan saved</span>
                </div>
                {aiFailInfo.message && (
                  <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80">{aiFailInfo.message}</div>
                )}
                {aiFailInfo.suggestions && aiFailInfo.suggestions.length > 0 && (
                  <ul className="text-[10px] text-amber-600/70 dark:text-amber-400/70 space-y-0.5 list-disc pl-3">
                    {aiFailInfo.suggestions.slice(0, 3).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : hasUncalculatedItems && isTargetMode ? (
              <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-2 py-1.5 text-center">
                <span className="font-medium">Add items → click Generate</span>
              </div>
            ) : (
              <DayMacroSummary
                totals={dayMacros.totals}
                targets={targets}
                isTargetMode={isTargetMode}
                compact
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 pt-0">
          {(["breakfast", "lunch", "dinner", "snack"] as MealType[]).map(mealType => {
            const status = getMealStatus(mealType);
            const mealMacros = getMealMacros(mealType);
            const mealItems = items.filter(i => i.meal_type === mealType);
            
            return (
              <div key={mealType} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {STATUS_ICONS[status]}
                    {MEAL_LABELS[mealType]}
                    {mealMacros && status !== "skipped" && (
                      <span className="text-foreground">
                        ({Math.round(mealMacros.calories)} kcal)
                      </span>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-6 sm:w-6">
                        <MoreVertical className="h-4 w-4 sm:h-3 sm:w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleAddItem(mealType)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleSetStatus(mealType, "planned")}
                        disabled={status === "planned"}
                      >
                        <Utensils className="h-4 w-4 mr-2" />
                        Mark as Planned
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleSetStatus(mealType, "skipped")}
                        disabled={status === "skipped"}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Skip Meal
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleSetStatus(mealType, "eating_out")}
                        disabled={status === "eating_out"}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Eating Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {status === "skipped" ? (
                  <div className="text-xs text-muted-foreground italic py-1">Skipped</div>
                ) : status === "eating_out" ? (
                  <div className="text-xs text-primary py-1 space-y-0.5">
                    <div className="font-medium truncate">
                      {(plan as any)[`eating_out_${mealType}_label`] || "Eating out"}
                    </div>
                    <div className="text-muted-foreground">
                      {Math.round(mealMacros?.calories || 0)} kcal
                      {(mealMacros?.protein || 0) > 0 && ` · ${Math.round(mealMacros!.protein)}P`}
                      {(mealMacros?.carbs || 0) > 0 && ` · ${Math.round(mealMacros!.carbs)}C`}
                      {(mealMacros?.fat || 0) > 0 && ` · ${Math.round(mealMacros!.fat)}F`}
                    </div>
                  </div>
                ) : mealItems.length === 0 ? (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full h-9 sm:h-7 text-xs text-muted-foreground"
                    onClick={() => handleAddItem(mealType)}
                  >
                    <Plus className="h-4 w-4 sm:h-3 sm:w-3 mr-1" />
                    Add food
                  </Button>
                ) : (
                  <div className="space-y-1">
                    {mealItems.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1"
                      >
                        <div className="flex items-center gap-1 truncate">
                          {item.is_locked && <Lock className="h-3 w-3 text-primary" />}
                          {item.product?.product_type === "fixed" && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">Fixed</Badge>
                          )}
                          <span className="truncate">{item.product?.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={cn(
                            "text-muted-foreground tabular-nums",
                            item.quantity_grams === 0 && "text-amber-600"
                          )}>
                            {item.quantity_grams === 0 ? "—" : `${item.quantity_grams}g`}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-5 sm:w-5">
                                <MoreVertical className="h-4 w-4 sm:h-3 sm:w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => toggleLock(item.id, item.is_locked)}>
                                {item.is_locked ? (
                                  <>
                                    <Unlock className="h-4 w-4 mr-2" />
                                    Unlock
                                  </>
                                ) : (
                                  <>
                                    <Lock className="h-4 w-4 mr-2" />
                                    Lock Quantity
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => {
                                  setAiFailInfo(null); // Bug 6 fix: clear fail on item removal
                                  removeItem.mutate(item.id);
                                }}
                              >
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <MealItemMultiSelectDialog
        open={addItemOpen}
        onOpenChange={setAddItemOpen}
        planId={plan.id}
        mealType={selectedMealType}
        products={products}
        weekStart={weekStart}
        existingItems={items}
      />

      <EatingOutDialog
        open={eatingOutOpen}
        onOpenChange={setEatingOutOpen}
        onConfirm={handleEatingOutConfirm}
      />

      <DayDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        plan={plan}
        dayMacros={dayMacros}
        settings={settings}
        weeklyOverride={weeklyOverride}
        previousWeekOverride={previousWeekOverride}
      />

      {weekDates && mealPlans.length > 0 && (
        <CopyToDateDialog
          open={copyToDateOpen}
          onOpenChange={setCopyToDateOpen}
          sourcePlan={plan}
          weekDates={weekDates}
          mealPlans={mealPlans}
          onConfirm={handleCopyToDate}
          isPending={copyDayToDate.isPending}
        />
      )}
    </>
  );
}
