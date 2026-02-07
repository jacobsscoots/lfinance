import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight, Copy, UtensilsCrossed, MoreVertical, RefreshCw, Loader2, RotateCcw, Palmtree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMealPlanItems, MealPlan, MealType } from "@/hooks/useMealPlanItems";
import { useMealPlanBlackouts } from "@/hooks/useMealPlanBlackouts";
import { useNutritionSettings } from "@/hooks/useNutritionSettings";
import { useProducts } from "@/hooks/useProducts";
import { calculateDayMacros, calculateWeeklyAverages, DayMacros, getBalanceWarnings } from "@/lib/mealCalculations";
import { DEFAULT_PORTIONING_SETTINGS } from "@/lib/autoPortioning";
import { 
  getShoppingWeekRange, 
  formatShoppingWeekRange,
  getNextShoppingWeek,
  getPreviousShoppingWeek,
  isCurrentShoppingWeek,
  isDateBlackout,
  getBlackoutReason,
  getActiveDateStringsInRange,
} from "@/lib/mealPlannerWeek";
import { MealDayCard } from "./MealDayCard";
import { GroceryListPanel } from "./GroceryListPanel";
import { WeeklySummaryCard } from "./WeeklySummaryCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const DAY_ABBREVS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"];

export function WeeklyMealPlanner() {
  // Start with current shopping week
  const [weekRange, setWeekRange] = useState(() => getShoppingWeekRange(new Date()));
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [resetWeekOpen, setResetWeekOpen] = useState(false);
  const isMobile = useIsMobile();
  
  const { mealPlans, weekDates, isLoading, copyFromPreviousWeek, clearWeek, recalculateAll, lastCalculated } = useMealPlanItems(weekRange.start);
  const { blackouts } = useMealPlanBlackouts();
  const { settings, isLoading: settingsLoading, isTargetMode } = useNutritionSettings();
  const { products, isLoading: productsLoading } = useProducts();

  // Navigation
  const goToPreviousWeek = () => setWeekRange(prev => getPreviousShoppingWeek(prev));
  const goToNextWeek = () => setWeekRange(prev => getNextShoppingWeek(prev));
  const goToCurrentWeek = () => setWeekRange(getShoppingWeekRange(new Date()));

  const isCurrentWeek = isCurrentShoppingWeek(weekRange);
  
  // Get active dates (excluding blackouts)
  const activeDates = getActiveDateStringsInRange(weekRange, blackouts);

  // Calculate macros for all days (excluding blackout days from warnings)
  const dayMacros: DayMacros[] = mealPlans.map(plan => calculateDayMacros(plan, settings));
  
  // Only include active days in weekly averages
  const activeDayMacros = dayMacros.filter(dm => activeDates.includes(dm.date));
  const weeklyAverages = calculateWeeklyAverages(activeDayMacros);
  
  // Check if week has any items on active days
  const weekHasItems = mealPlans.some(plan => 
    activeDates.includes(plan.meal_date) && (plan.items?.length || 0) > 0
  );
  
  // Collect warnings only from active days
  const allWarnings = activeDayMacros.flatMap(dm => getBalanceWarnings(dm, settings));

  const handleRecalculate = () => {
    if (!settings) return;
    
    const portioningSettings = {
      minGrams: settings.min_grams_per_item || DEFAULT_PORTIONING_SETTINGS.minGrams,
      maxGrams: settings.max_grams_per_item || DEFAULT_PORTIONING_SETTINGS.maxGrams,
      rounding: settings.portion_rounding || DEFAULT_PORTIONING_SETTINGS.rounding,
      tolerancePercent: settings.target_tolerance_percent || DEFAULT_PORTIONING_SETTINGS.tolerancePercent,
    };
    
    recalculateAll.mutate({ settings, portioningSettings });
  };

  if (isLoading || settingsLoading || productsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Week Navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-base sm:text-lg font-medium min-w-[220px] sm:min-w-[280px] text-center">
            {formatShoppingWeekRange(weekRange)}
          </div>
          <Button variant="outline" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentWeek && (
            <Button variant="ghost" size="sm" onClick={goToCurrentWeek}>
              Today
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isTargetMode ? "default" : "secondary"}>
            {isTargetMode ? "Target Mode" : "Manual Mode"}
          </Badge>
          
          {/* Generate Button - only in Target Mode */}
          {isTargetMode && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleRecalculate}
              disabled={recalculateAll.isPending || !settings}
              className="gap-1.5"
            >
              {recalculateAll.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {recalculateAll.isPending ? "Generating..." : "Generate Portions"}
              </span>
              <span className="sm:hidden">
                {recalculateAll.isPending ? "..." : "Generate"}
              </span>
            </Button>
          )}
          
          {isMobile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem 
                  onClick={() => setResetWeekOpen(true)}
                  disabled={!weekHasItems || clearWeek.isPending}
                  className="text-destructive"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Week
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => copyFromPreviousWeek.mutate()}
                  disabled={copyFromPreviousWeek.isPending}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Previous Week
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setResetWeekOpen(true)}
                disabled={!weekHasItems || clearWeek.isPending}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset Week
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => copyFromPreviousWeek.mutate()}
                disabled={copyFromPreviousWeek.isPending}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy Previous Week
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Reset Week Confirmation Dialog (shared for mobile & desktop) */}
      <AlertDialog open={resetWeekOpen} onOpenChange={setResetWeekOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset entire week?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all meals and portions for the week. 
              Your saved foods and settings will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => clearWeek.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reset Week
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Last Calculated Timestamp */}
      {isTargetMode && lastCalculated && (
        <div className="text-xs text-muted-foreground">
          Last calculated: {formatDistanceToNow(lastCalculated, { addSuffix: true })}
        </div>
      )}

      {/* Warnings */}
      {allWarnings.length > 0 && (
        <Alert variant="destructive" className="bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {allWarnings.slice(0, 3).map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
              {allWarnings.length > 3 && (
                <li className="text-muted-foreground">+ {allWarnings.length - 3} more warnings</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="planner">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="planner" className="flex-1 sm:flex-none">
            <UtensilsCrossed className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Meal Planner</span>
            <span className="sm:hidden">Planner</span>
          </TabsTrigger>
          <TabsTrigger value="grocery" className="flex-1 sm:flex-none">Grocery</TabsTrigger>
          <TabsTrigger value="summary" className="flex-1 sm:flex-none">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="planner" className="mt-4">
          {isMobile ? (
            /* Mobile: Day selector + single day view */
            <div className="space-y-4">
              {/* Day Selector Strip */}
              <div className="flex gap-1 overflow-x-auto pb-2">
                {mealPlans.map((plan, index) => {
                  const date = new Date(plan.meal_date);
                  const isToday = format(new Date(), "yyyy-MM-dd") === plan.meal_date;
                  return (
                    <Button
                      key={plan.id}
                      variant={selectedDayIndex === index ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "flex-shrink-0 flex-col h-auto py-2 px-3 min-w-[52px]",
                        isToday && selectedDayIndex !== index && "border-primary"
                      )}
                      onClick={() => setSelectedDayIndex(index)}
                    >
                      <span className="text-xs font-normal">{format(date, "EEE")}</span>
                      <span className="text-sm font-semibold">{format(date, "d")}</span>
                    </Button>
                  );
                })}
              </div>

              {/* Single Day Card */}
              {mealPlans[selectedDayIndex] && (
                <MealDayCard
                  plan={mealPlans[selectedDayIndex]}
                  dayMacros={dayMacros[selectedDayIndex]}
                  products={products}
                  settings={settings}
                  weekStart={weekRange.start}
                  isBlackout={isDateBlackout(mealPlans[selectedDayIndex].meal_date, blackouts)}
                  blackoutReason={getBlackoutReason(mealPlans[selectedDayIndex].meal_date, blackouts)}
                />
              )}
            </div>
          ) : (
            /* Desktop: Full week grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {mealPlans.map((plan, index) => (
                <MealDayCard
                  key={plan.id}
                  plan={plan}
                  dayMacros={dayMacros[index]}
                  products={products}
                  settings={settings}
                  weekStart={weekRange.start}
                  isBlackout={isDateBlackout(plan.meal_date, blackouts)}
                  blackoutReason={getBlackoutReason(plan.meal_date, blackouts)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="grocery" className="mt-4">
          <GroceryListPanel plans={mealPlans} blackouts={blackouts} />
        </TabsContent>

        <TabsContent value="summary" className="mt-4">
          <WeeklySummaryCard 
            dayMacros={dayMacros} 
            weeklyAverages={weeklyAverages}
            settings={settings}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
