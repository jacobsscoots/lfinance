import { format, parseISO } from "date-fns";
import { TrendingUp, Target, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DayMacros, MacroTotals } from "@/lib/mealCalculations";
import { NutritionSettings } from "@/hooks/useNutritionSettings";

interface WeeklySummaryCardProps {
  dayMacros: DayMacros[];
  weeklyAverages: MacroTotals;
  settings: NutritionSettings | null | undefined;
}

export function WeeklySummaryCard({ dayMacros, weeklyAverages, settings }: WeeklySummaryCardProps) {
  const isTargetMode = settings?.mode === "target_based";

  const getProgressColor = (current: number, target: number) => {
    const ratio = current / target;
    if (ratio < 0.8) return "bg-amber-500";
    if (ratio > 1.1) return "bg-destructive";
    return "bg-primary";
  };

  const getMacroStatus = (current: number, target: number) => {
    const diff = current - target;
    if (Math.abs(diff) < 10) return { status: "on-track", label: "On Track" };
    if (diff > 0) return { status: "over", label: `+${Math.round(diff)}` };
    return { status: "under", label: `${Math.round(diff)}` };
  };

  return (
    <div className="space-y-4">
      {/* Weekly Averages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Weekly Averages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Calories</div>
              <div className="text-2xl font-bold">{Math.round(weeklyAverages.calories)}</div>
              <div className="text-xs text-muted-foreground">kcal/day</div>
              {isTargetMode && settings?.daily_calorie_target && (
                <Progress 
                  value={(weeklyAverages.calories / settings.daily_calorie_target) * 100} 
                  className="h-2"
                />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Protein</div>
              <div className="text-2xl font-bold">{Math.round(weeklyAverages.protein)}g</div>
              <div className="text-xs text-muted-foreground">per day</div>
              {isTargetMode && settings?.protein_target_grams && (
                <Progress 
                  value={(weeklyAverages.protein / settings.protein_target_grams) * 100} 
                  className="h-2"
                />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Carbs</div>
              <div className="text-2xl font-bold">{Math.round(weeklyAverages.carbs)}g</div>
              <div className="text-xs text-muted-foreground">per day</div>
              {isTargetMode && settings?.carbs_target_grams && (
                <Progress 
                  value={(weeklyAverages.carbs / settings.carbs_target_grams) * 100} 
                  className="h-2"
                />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Fat</div>
              <div className="text-2xl font-bold">{Math.round(weeklyAverages.fat)}g</div>
              <div className="text-xs text-muted-foreground">per day</div>
              {isTargetMode && settings?.fat_target_grams && (
                <Progress 
                  value={(weeklyAverages.fat / settings.fat_target_grams) * 100} 
                  className="h-2"
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dayMacros.map((day) => {
              const plannedMeals = day.meals.filter(m => m.status !== "skipped").length;
              const date = parseISO(day.date);
              const isToday = format(new Date(), "yyyy-MM-dd") === day.date;

              return (
                <div 
                  key={day.date} 
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    isToday ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      <div className="font-medium">{format(date, "EEEE")}</div>
                      <div className="text-xs text-muted-foreground">{format(date, "d MMM")}</div>
                    </div>
                    {plannedMeals < 4 && (
                      <Badge variant="outline" className="text-xs">
                        {4 - plannedMeals} meal{plannedMeals < 3 ? "s" : ""} skipped
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <div className="font-semibold">{Math.round(day.totals.calories)} kcal</div>
                      {isTargetMode && day.targetDiff && (
                        <div className={`text-xs ${
                          Math.abs(day.targetDiff.calories) < 100 
                            ? "text-green-600" 
                            : day.targetDiff.calories > 0 
                              ? "text-destructive" 
                              : "text-amber-600"
                        }`}>
                          {day.targetDiff.calories >= 0 ? "+" : ""}{Math.round(day.targetDiff.calories)}
                        </div>
                      )}
                    </div>
                    <div className="text-right min-w-[60px]">
                      <div className="font-medium">P: {Math.round(day.totals.protein)}g</div>
                    </div>
                    <div className="text-right min-w-[60px]">
                      <div className="font-medium">C: {Math.round(day.totals.carbs)}g</div>
                    </div>
                    <div className="text-right min-w-[60px]">
                      <div className="font-medium">F: {Math.round(day.totals.fat)}g</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Target Mode Summary */}
      {isTargetMode && settings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Target Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">Daily Calorie Target</div>
                <div className="text-lg font-bold">{settings.daily_calorie_target} kcal</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Avg: {Math.round(weeklyAverages.calories)} kcal
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">Protein Target</div>
                <div className="text-lg font-bold">{settings.protein_target_grams}g</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Avg: {Math.round(weeklyAverages.protein)}g
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">Carbs Target</div>
                <div className="text-lg font-bold">{settings.carbs_target_grams}g</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Avg: {Math.round(weeklyAverages.carbs)}g
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">Fat Target</div>
                <div className="text-lg font-bold">{settings.fat_target_grams}g</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Avg: {Math.round(weeklyAverages.fat)}g
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
