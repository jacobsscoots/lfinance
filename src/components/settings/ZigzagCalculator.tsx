import { useState, useEffect, useMemo } from "react";
import { format, addDays } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingDown, Scale, Flame, AlertTriangle, Calendar, Sparkles } from "lucide-react";
import { 
  PlanMode, 
  ZigzagSchedule, 
  PLAN_MODES, 
  getNextWeekStartFromSundayWeighIn,
  buildFlatSchedule,
  buildZigzagSchedule,
  getWeeklyAverage,
  scheduleToArray,
  formatWeekLabel,
  WeeklyCalorieSchedule 
} from "@/lib/weekTargets";
import { useWeeklyNutritionTargets } from "@/hooks/useWeeklyNutritionTargets";
import { useNutritionSettings } from "@/hooks/useNutritionSettings";
import { cn } from "@/lib/utils";

interface ZigzagCalculatorProps {
  onApply?: () => void;
}

export function ZigzagCalculator({ onApply }: ZigzagCalculatorProps) {
  const { settings: globalSettings } = useNutritionSettings();
  const [planMode, setPlanMode] = useState<PlanMode>("maintain");
  const [zigzagEnabled, setZigzagEnabled] = useState(false);
  const [zigzagSchedule, setZigzagSchedule] = useState<ZigzagSchedule>("schedule_1");

  // Calculate the next week's Monday (for Sunday weigh-in)
  const nextWeekStart = useMemo(() => getNextWeekStartFromSundayWeighIn(new Date()), []);
  const nextWeekStartStr = format(nextWeekStart, "yyyy-MM-dd");

  const { weeklyTargets, saveWeeklyTargets, hasWeeklyTargets } = useWeeklyNutritionTargets(nextWeekStart);

  // Get TDEE from global settings (or use a default)
  const tdee = useMemo(() => {
    if (globalSettings?.daily_calorie_target) {
      // If they have a target set, assume that's their TDEE for maintain
      return globalSettings.daily_calorie_target;
    }
    return 2000; // Default TDEE
  }, [globalSettings]);

  // Load existing weekly targets if present
  useEffect(() => {
    if (weeklyTargets) {
      setPlanMode(weeklyTargets.plan_mode as PlanMode);
      setZigzagEnabled(weeklyTargets.zigzag_enabled);
      if (weeklyTargets.zigzag_schedule) {
        setZigzagSchedule(weeklyTargets.zigzag_schedule as ZigzagSchedule);
      }
    }
  }, [weeklyTargets]);

  // Calculate the schedule based on current selections
  const calculatedSchedule = useMemo<WeeklyCalorieSchedule>(() => {
    if (zigzagEnabled) {
      return buildZigzagSchedule(tdee, planMode, zigzagSchedule);
    }
    const targetCalories = tdee + PLAN_MODES[planMode].dailyCalorieAdjustment;
    return buildFlatSchedule(targetCalories);
  }, [tdee, planMode, zigzagEnabled, zigzagSchedule]);

  const weeklyAverage = getWeeklyAverage(calculatedSchedule);
  const scheduleArray = scheduleToArray(calculatedSchedule);

  const handleApply = async () => {
    await saveWeeklyTargets.mutateAsync({
      week_start_date: nextWeekStartStr,
      plan_mode: planMode,
      zigzag_enabled: zigzagEnabled,
      zigzag_schedule: zigzagEnabled ? zigzagSchedule : null,
      schedule: calculatedSchedule,
      protein_target_grams: globalSettings?.protein_target_grams,
      carbs_target_grams: globalSettings?.carbs_target_grams,
      fat_target_grams: globalSettings?.fat_target_grams,
    });
    onApply?.();
  };

  const getPlanIcon = (mode: PlanMode) => {
    switch (mode) {
      case "maintain": return <Scale className="h-4 w-4" />;
      case "mild_loss": return <TrendingDown className="h-4 w-4" />;
      case "loss": return <Flame className="h-4 w-4" />;
      case "extreme_loss": return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getDeficitText = (mode: PlanMode) => {
    const config = PLAN_MODES[mode];
    if (config.weeklyDeficitKg === 0) return "No deficit";
    return `~${config.weeklyDeficitKg} kg/week`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Weekly Calorie Plan
        </CardTitle>
        <CardDescription>
          Set targets for <strong>{formatWeekLabel(nextWeekStart)}</strong>
          {hasWeeklyTargets && (
            <Badge variant="outline" className="ml-2">Configured</Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan Mode Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Goal</Label>
          <RadioGroup
            value={planMode}
            onValueChange={(v) => setPlanMode(v as PlanMode)}
            className="grid grid-cols-2 gap-3"
          >
            {(Object.entries(PLAN_MODES) as [PlanMode, typeof PLAN_MODES.maintain][]).map(([mode, config]) => (
              <label
                key={mode}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  planMode === mode 
                    ? "border-primary bg-primary/5" 
                    : "hover:bg-accent"
                )}
              >
                <RadioGroupItem value={mode} id={mode} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {getPlanIcon(mode)}
                    <span className="font-medium text-sm">{config.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {getDeficitText(mode)}
                  </p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>

        {/* Zigzag Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <Label htmlFor="zigzag" className="font-medium">Calorie Zigzag</Label>
              <p className="text-xs text-muted-foreground">
                Vary daily calories while keeping weekly average
              </p>
            </div>
          </div>
          <Switch
            id="zigzag"
            checked={zigzagEnabled}
            onCheckedChange={setZigzagEnabled}
          />
        </div>

        {/* Zigzag Schedule Selection */}
        {zigzagEnabled && (
          <RadioGroup
            value={zigzagSchedule}
            onValueChange={(v) => setZigzagSchedule(v as ZigzagSchedule)}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <label
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                zigzagSchedule === "schedule_1" 
                  ? "border-primary bg-primary/5" 
                  : "hover:bg-accent"
              )}
            >
              <RadioGroupItem value="schedule_1" id="schedule_1" className="mt-0.5" />
              <div>
                <span className="font-medium text-sm">High Weekend</span>
                <p className="text-xs text-muted-foreground">
                  Higher on Sat/Sun, lower Mon-Fri
                </p>
              </div>
            </label>
            <label
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                zigzagSchedule === "schedule_2" 
                  ? "border-primary bg-primary/5" 
                  : "hover:bg-accent"
              )}
            >
              <RadioGroupItem value="schedule_2" id="schedule_2" className="mt-0.5" />
              <div>
                <span className="font-medium text-sm">Varied Daily</span>
                <p className="text-xs text-muted-foreground">
                  Different calories each day
                </p>
              </div>
            </label>
          </RadioGroup>
        )}

        {/* Schedule Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Daily Breakdown</Label>
            <Badge variant="secondary">
              Avg: {weeklyAverage.toLocaleString()} kcal
            </Badge>
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {scheduleArray.map((day, i) => (
              <div 
                key={day.day}
                className={cn(
                  "text-center p-2 rounded-lg",
                  i >= 5 ? "bg-primary/10" : "bg-muted/50"
                )}
              >
                <div className="text-xs text-muted-foreground font-medium">
                  {day.day.slice(0, 3)}
                </div>
                <div className="text-sm font-semibold mt-1">
                  {day.calories.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-xl font-bold">{(weeklyAverage * 7).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Weekly Total</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-xl font-bold">
              {PLAN_MODES[planMode].dailyCalorieAdjustment >= 0 ? "+" : ""}
              {PLAN_MODES[planMode].dailyCalorieAdjustment}
            </div>
            <div className="text-xs text-muted-foreground">Daily Adjustment</div>
          </div>
        </div>

        {/* Apply Button */}
        <Button 
          onClick={handleApply} 
          className="w-full gap-2"
          disabled={saveWeeklyTargets.isPending}
        >
          <Zap className="h-4 w-4" />
          {hasWeeklyTargets ? "Update Week's Targets" : "Apply to Next Week"}
        </Button>
      </CardContent>
    </Card>
  );
}
