import { useState } from "react";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, Copy, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useMealPlanItems, MealPlan, MealType } from "@/hooks/useMealPlanItems";
import { useNutritionSettings } from "@/hooks/useNutritionSettings";
import { useProducts } from "@/hooks/useProducts";
import { calculateDayMacros, calculateWeeklyAverages, DayMacros, getBalanceWarnings } from "@/lib/mealCalculations";
import { MealDayCard } from "./MealDayCard";
import { GroceryListPanel } from "./GroceryListPanel";
import { WeeklySummaryCard } from "./WeeklySummaryCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export function WeeklyMealPlanner() {
  const [weekStart, setWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday
  );
  
  const { mealPlans, isLoading, copyFromPreviousWeek } = useMealPlanItems(weekStart);
  const { settings, isLoading: settingsLoading } = useNutritionSettings();
  const { products, isLoading: productsLoading } = useProducts();

  const goToPreviousWeek = () => setWeekStart(prev => subWeeks(prev, 1));
  const goToNextWeek = () => setWeekStart(prev => addWeeks(prev, 1));
  const goToCurrentWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Calculate macros for all days
  const dayMacros: DayMacros[] = mealPlans.map(plan => calculateDayMacros(plan, settings));
  const weeklyAverages = calculateWeeklyAverages(dayMacros);
  
  // Collect all warnings
  const allWarnings = dayMacros.flatMap(dm => getBalanceWarnings(dm, settings));

  const isCurrentWeek = format(weekStart, "yyyy-MM-dd") === 
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

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
    <div className="space-y-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-lg font-medium min-w-[200px] text-center">
            {format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM yyyy")}
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
          <Badge variant={settings?.mode === "target_based" ? "default" : "secondary"}>
            {settings?.mode === "target_based" ? "Target Mode" : "Manual Mode"}
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => copyFromPreviousWeek.mutate()}
            disabled={copyFromPreviousWeek.isPending}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy Previous Week
          </Button>
        </div>
      </div>

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
        <TabsList>
          <TabsTrigger value="planner">
            <UtensilsCrossed className="h-4 w-4 mr-2" />
            Meal Planner
          </TabsTrigger>
          <TabsTrigger value="grocery">Grocery List</TabsTrigger>
          <TabsTrigger value="summary">Weekly Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="planner" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            {mealPlans.map((plan, index) => (
              <MealDayCard
                key={plan.id}
                plan={plan}
                dayMacros={dayMacros[index]}
                products={products}
                settings={settings}
                weekStart={weekStart}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="grocery" className="mt-4">
          <GroceryListPanel plans={mealPlans} />
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
