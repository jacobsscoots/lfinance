import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Target, Scale, Copy, Settings2, ChevronDown, Calculator, Edit3, Zap, Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNutritionSettings, NutritionMode } from "@/hooks/useNutritionSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { TargetFields } from "./TargetFields";
import {
  calculateNutritionTargets,
  validateCalculatorInput,
  ACTIVITY_LABELS,
  GOAL_LABELS,
  DEFAULT_MACRO_RULES,
  Sex,
  ActivityLevel,
  Formula,
  GoalType,
  CalculatorInput,
  CalculatorOutput,
} from "@/lib/nutritionTargets";

const settingsSchema = z.object({
  mode: z.enum(["target_based", "manual"]),
  // Weekday targets
  daily_calorie_target: z.coerce.number().min(0).nullable().optional(),
  protein_target_grams: z.coerce.number().min(0).nullable().optional(),
  carbs_target_grams: z.coerce.number().min(0).nullable().optional(),
  fat_target_grams: z.coerce.number().min(0).nullable().optional(),
  // Weekend targets
  weekend_calorie_target: z.coerce.number().min(0).nullable().optional(),
  weekend_protein_target_grams: z.coerce.number().min(0).nullable().optional(),
  weekend_carbs_target_grams: z.coerce.number().min(0).nullable().optional(),
  weekend_fat_target_grams: z.coerce.number().min(0).nullable().optional(),
  weekend_targets_enabled: z.boolean(),
  // Portioning settings
  min_grams_per_item: z.coerce.number().min(1).max(100).nullable().optional(),
  max_grams_per_item: z.coerce.number().min(50).max(2000).nullable().optional(),
  portion_rounding: z.coerce.number().min(1).max(50).nullable().optional(),
  target_tolerance_percent: z.coerce.number().min(0).max(10).nullable().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

// Calculator form schema
const calculatorSchema = z.object({
  age: z.coerce.number().min(15).max(100),
  sex: z.enum(["male", "female"]),
  height_cm: z.coerce.number().min(100).max(250),
  weight_kg: z.coerce.number().min(30).max(300),
  body_fat_percent: z.coerce.number().min(3).max(60).nullable().optional(),
  activity_level: z.enum(["sedentary", "lightly_active", "moderately_active", "very_active", "extremely_active"]),
  formula: z.enum(["mifflin_st_jeor", "harris_benedict", "katch_mcardle"]),
  goal_type: z.enum(["maintain", "cut", "bulk"]),
  protein_per_kg: z.coerce.number().min(1).max(4),
  fat_per_kg: z.coerce.number().min(0.3).max(2),
});

type CalculatorFormValues = z.infer<typeof calculatorSchema>;

type MacroInputMode = "grams" | "percent";
type MacroSplit = { proteinPct: number; carbsPct: number };

export function NutritionTargetSettings() {
  const { settings, isLoading, upsertSettings } = useNutritionSettings();
  const [inputTab, setInputTab] = useState<"calculator" | "manual">("calculator");
  const [dayTab, setDayTab] = useState<"weekday" | "weekend">("weekday");
  const [calculatorResult, setCalculatorResult] = useState<CalculatorOutput | null>(null);

  // Manual targets: allow entering macros as grams OR as a percentage split of calories.
  // Note: we persist grams only; percentages are an input convenience.
  const [weekdayMacroInputMode, setWeekdayMacroInputMode] = useState<MacroInputMode>("grams");
  const [weekendMacroInputMode, setWeekendMacroInputMode] = useState<MacroInputMode>("grams");
  const [weekdayMacroSplit, setWeekdayMacroSplit] = useState<MacroSplit>({ proteinPct: 35, carbsPct: 45 });
  const [weekendMacroSplit, setWeekendMacroSplit] = useState<MacroSplit>({ proteinPct: 35, carbsPct: 45 });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      mode: "manual",
      daily_calorie_target: 2000,
      protein_target_grams: 150,
      carbs_target_grams: 200,
      fat_target_grams: 65,
      weekend_calorie_target: null,
      weekend_protein_target_grams: null,
      weekend_carbs_target_grams: null,
      weekend_fat_target_grams: null,
      weekend_targets_enabled: false,
      min_grams_per_item: 10,
      max_grams_per_item: 500,
      portion_rounding: 5,
      target_tolerance_percent: 2,
    },
  });

  const calcForm = useForm<CalculatorFormValues>({
    resolver: zodResolver(calculatorSchema),
    defaultValues: {
      age: 30,
      sex: "male",
      height_cm: 175,
      weight_kg: 75,
      body_fat_percent: null,
      activity_level: "moderately_active",
      formula: "mifflin_st_jeor",
      goal_type: "maintain",
      protein_per_kg: 2.2,
      fat_per_kg: 0.8,
    },
  });

  // Watch calculator values for live calculation
  const calcValues = calcForm.watch();

  // Update forms when settings load
  useEffect(() => {
    if (settings) {
      form.reset({
        mode: settings.mode,
        daily_calorie_target: settings.daily_calorie_target,
        protein_target_grams: settings.protein_target_grams,
        carbs_target_grams: settings.carbs_target_grams,
        fat_target_grams: settings.fat_target_grams,
        weekend_calorie_target: settings.weekend_calorie_target,
        weekend_protein_target_grams: settings.weekend_protein_target_grams,
        weekend_carbs_target_grams: settings.weekend_carbs_target_grams,
        weekend_fat_target_grams: settings.weekend_fat_target_grams,
        weekend_targets_enabled: settings.weekend_targets_enabled,
        min_grams_per_item: settings.min_grams_per_item ?? 10,
        max_grams_per_item: settings.max_grams_per_item ?? 500,
        portion_rounding: settings.portion_rounding ?? 5,
        target_tolerance_percent: settings.target_tolerance_percent ?? 2,
      });

      // Load calculator values if they exist
      if (settings.age) {
        calcForm.reset({
          age: settings.age,
          sex: settings.sex || "male",
          height_cm: settings.height_cm || 175,
          weight_kg: settings.weight_kg || 75,
          body_fat_percent: settings.body_fat_percent,
          activity_level: settings.activity_level || "moderately_active",
          formula: settings.formula || "mifflin_st_jeor",
          goal_type: settings.goal_type || "maintain",
          protein_per_kg: settings.protein_per_kg || 2.2,
          fat_per_kg: settings.fat_per_kg || 0.8,
        });
      }
    }
  }, [settings, form, calcForm]);

  const mode = form.watch("mode");
  const weekendEnabled = form.watch("weekend_targets_enabled");
  const formula = calcForm.watch("formula");

  // Calculate results when calculator inputs change
  useEffect(() => {
    const input: CalculatorInput = {
      age: calcValues.age || 30,
      sex: (calcValues.sex as Sex) || "male",
      heightCm: calcValues.height_cm || 175,
      weightKg: calcValues.weight_kg || 75,
      activityLevel: (calcValues.activity_level as ActivityLevel) || "moderately_active",
      formula: (calcValues.formula as Formula) || "mifflin_st_jeor",
      bodyFatPercent: calcValues.body_fat_percent || undefined,
    };

    const errors = validateCalculatorInput(input);
    if (errors.length === 0) {
      try {
        const result = calculateNutritionTargets(
          input,
          (calcValues.goal_type as GoalType) || "maintain",
          {
            proteinPerKg: calcValues.protein_per_kg || 2.2,
            fatPerKg: calcValues.fat_per_kg || 0.8,
          }
        );
        setCalculatorResult(result);
      } catch {
        setCalculatorResult(null);
      }
    } else {
      setCalculatorResult(null);
    }
  }, [calcValues]);

  // Copy weekday targets to weekend
  const copyToWeekend = () => {
    const weekdayValues = form.getValues();
    form.setValue("weekend_calorie_target", weekdayValues.daily_calorie_target);
    form.setValue("weekend_protein_target_grams", weekdayValues.protein_target_grams);
    form.setValue("weekend_carbs_target_grams", weekdayValues.carbs_target_grams);
    form.setValue("weekend_fat_target_grams", weekdayValues.fat_target_grams);
    form.setValue("weekend_targets_enabled", true);
    toast.success("Copied Mon-Fri targets to Sat-Sun");
  };

  // Apply calculator results to targets
  const applyCalculatorResults = async () => {
    if (!calculatorResult) return;

    const calcData = calcForm.getValues();
    
    await upsertSettings.mutateAsync({
      mode: form.getValues("mode"),
      daily_calorie_target: calculatorResult.targetCalories,
      protein_target_grams: calculatorResult.proteinGrams,
      carbs_target_grams: calculatorResult.carbsGrams,
      fat_target_grams: calculatorResult.fatGrams,
      weekend_calorie_target: form.getValues("weekend_calorie_target"),
      weekend_protein_target_grams: form.getValues("weekend_protein_target_grams"),
      weekend_carbs_target_grams: form.getValues("weekend_carbs_target_grams"),
      weekend_fat_target_grams: form.getValues("weekend_fat_target_grams"),
      weekend_targets_enabled: form.getValues("weekend_targets_enabled"),
      min_grams_per_item: form.getValues("min_grams_per_item"),
      max_grams_per_item: form.getValues("max_grams_per_item"),
      portion_rounding: form.getValues("portion_rounding"),
      target_tolerance_percent: form.getValues("target_tolerance_percent"),
      // Save calculator inputs
      age: calcData.age,
      sex: calcData.sex as Sex,
      height_cm: calcData.height_cm,
      weight_kg: calcData.weight_kg,
      body_fat_percent: calcData.body_fat_percent,
      activity_level: calcData.activity_level as ActivityLevel,
      formula: calcData.formula as Formula,
      goal_type: calcData.goal_type as GoalType,
      protein_per_kg: calcData.protein_per_kg,
      fat_per_kg: calcData.fat_per_kg,
      last_calculated_at: new Date().toISOString(),
    });

    // Update form values
    form.setValue("daily_calorie_target", calculatorResult.targetCalories);
    form.setValue("protein_target_grams", calculatorResult.proteinGrams);
    form.setValue("carbs_target_grams", calculatorResult.carbsGrams);
    form.setValue("fat_target_grams", calculatorResult.fatGrams);
    
    toast.success("Calculator targets applied!");
  };

  async function onSubmit(values: SettingsFormValues) {
    await upsertSettings.mutateAsync({
      mode: values.mode as NutritionMode,
      daily_calorie_target: values.daily_calorie_target,
      protein_target_grams: values.protein_target_grams,
      carbs_target_grams: values.carbs_target_grams,
      fat_target_grams: values.fat_target_grams,
      weekend_calorie_target: values.weekend_calorie_target,
      weekend_protein_target_grams: values.weekend_protein_target_grams,
      weekend_carbs_target_grams: values.weekend_carbs_target_grams,
      weekend_fat_target_grams: values.weekend_fat_target_grams,
      weekend_targets_enabled: values.weekend_targets_enabled,
      min_grams_per_item: values.min_grams_per_item,
      max_grams_per_item: values.max_grams_per_item,
      portion_rounding: values.portion_rounding,
      target_tolerance_percent: values.target_tolerance_percent,
    });
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nutrition Targets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  // TargetFields helper functions for weekday/weekend
  const getWeekdayTargetFieldsProps = () => ({
    prefix: "weekday" as const,
    form,
    macroMode: weekdayMacroInputMode,
    setMacroMode: setWeekdayMacroInputMode,
    split: weekdayMacroSplit,
    setSplit: setWeekdayMacroSplit,
  });

  const getWeekendTargetFieldsProps = () => ({
    prefix: "weekend" as const,
    form,
    macroMode: weekendMacroInputMode,
    setMacroMode: setWeekendMacroInputMode,
    split: weekendMacroSplit,
    setSplit: setWeekendMacroSplit,
  });

  return (
    <div className="space-y-6">
      {/* Calculator / Manual Input Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Nutrition Targets
          </CardTitle>
          <CardDescription>
            Calculate or manually set your daily calorie and macro targets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={inputTab} onValueChange={(v) => setInputTab(v as "calculator" | "manual")}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="calculator" className="gap-2">
                <Calculator className="h-4 w-4" />
                Calculator
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-2">
                <Edit3 className="h-4 w-4" />
                Manual
              </TabsTrigger>
            </TabsList>

            {/* Calculator Tab */}
            <TabsContent value="calculator" className="space-y-6">
              <Form {...calcForm}>
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Left: Inputs */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Your Stats</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={calcForm.control}
                        name="age"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Age</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="30" {...field} />
                            </FormControl>
                            <FormDescription>years</FormDescription>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={calcForm.control}
                        name="sex"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sex</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "male"}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={calcForm.control}
                        name="height_cm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Height</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="175" {...field} />
                            </FormControl>
                            <FormDescription>cm</FormDescription>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={calcForm.control}
                        name="weight_kg"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Weight</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" placeholder="75" {...field} />
                            </FormControl>
                            <FormDescription>kg</FormDescription>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={calcForm.control}
                      name="body_fat_percent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Body Fat % (optional)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.5" 
                              placeholder="15"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormDescription>Required for Katch-McArdle formula</FormDescription>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={calcForm.control}
                      name="activity_level"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            Activity Level
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "moderately_active"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select activity level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(ACTIVITY_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={calcForm.control}
                        name="formula"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Formula</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "mifflin_st_jeor"}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="mifflin_st_jeor">Mifflin-St Jeor</SelectItem>
                                <SelectItem value="harris_benedict">Harris-Benedict</SelectItem>
                                <SelectItem value="katch_mcardle" disabled={!calcValues.body_fat_percent}>
                                  Katch-McArdle
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={calcForm.control}
                        name="goal_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Goal</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "maintain"}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.entries(GOAL_LABELS).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Advanced macro rules */}
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary w-full py-2">
                        <Settings2 className="h-4 w-4" />
                        Macro Rules
                        <ChevronDown className="h-4 w-4 ml-auto transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={calcForm.control}
                            name="protein_per_kg"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Protein</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.1" {...field} />
                                </FormControl>
                                <FormDescription>g per kg bodyweight</FormDescription>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={calcForm.control}
                            name="fat_per_kg"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Fat</FormLabel>
                                <FormControl>
                                  <Input type="number" step="0.1" {...field} />
                                </FormControl>
                                <FormDescription>g per kg bodyweight</FormDescription>
                              </FormItem>
                            )}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  {/* Right: Results */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Results</h4>
                    
                    {calculatorResult ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 rounded-lg bg-muted/50 text-center">
                            <div className="text-2xl font-bold">{calculatorResult.bmr.toLocaleString()}</div>
                            <div className="text-sm text-muted-foreground">BMR kcal</div>
                          </div>
                          <div className="p-4 rounded-lg bg-muted/50 text-center">
                            <div className="text-2xl font-bold">{calculatorResult.tdee.toLocaleString()}</div>
                            <div className="text-sm text-muted-foreground">TDEE kcal</div>
                          </div>
                        </div>

                        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
                          <div className="text-3xl font-bold text-primary">{calculatorResult.targetCalories.toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">Target kcal/day</div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3 rounded-lg bg-muted/50 text-center">
                            <div className="text-xl font-semibold">{calculatorResult.proteinGrams}g</div>
                            <div className="text-xs text-muted-foreground">Protein</div>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50 text-center">
                            <div className="text-xl font-semibold">{calculatorResult.carbsGrams}g</div>
                            <div className="text-xs text-muted-foreground">Carbs</div>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50 text-center">
                            <div className="text-xl font-semibold">{calculatorResult.fatGrams}g</div>
                            <div className="text-xs text-muted-foreground">Fat</div>
                          </div>
                        </div>

                        <Button 
                          type="button" 
                          className="w-full gap-2" 
                          onClick={applyCalculatorResults}
                          disabled={upsertSettings.isPending}
                        >
                          <Zap className="h-4 w-4" />
                          Use These Targets
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm">
                        <Calculator className="h-8 w-8 mb-2 opacity-50" />
                        Fill in your stats to see results
                      </div>
                    )}
                  </div>
                </div>
              </Form>
            </TabsContent>

            {/* Manual Tab */}
            <TabsContent value="manual">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-4 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="font-medium">Daily Targets</h4>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={copyToWeekend}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Mon-Fri → Sat-Sun
                      </Button>
                    </div>
                    
                    <Tabs value={dayTab} onValueChange={(v) => setDayTab(v as "weekday" | "weekend")}>
                      <TabsList className="w-full grid grid-cols-2">
                        <TabsTrigger value="weekday">Mon-Fri</TabsTrigger>
                        <TabsTrigger value="weekend" className="relative">
                          Sat-Sun
                          {!weekendEnabled && (
                            <span className="ml-2 text-xs text-muted-foreground">(inherits)</span>
                          )}
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="weekday" className="mt-4">
                        <TargetFields {...getWeekdayTargetFieldsProps()} />
                      </TabsContent>
                      <TabsContent value="weekend" className="mt-4 space-y-4">
                        <div className="flex items-center gap-2 p-3 bg-background rounded-lg border">
                          <FormField
                            control={form.control}
                            name="weekend_targets_enabled"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-3 space-y-0">
                                <FormControl>
                                  <input
                                    type="checkbox"
                                    checked={field.value}
                                    onChange={field.onChange}
                                    className="h-4 w-4 rounded border-input"
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  Use different targets for weekends
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                        {weekendEnabled ? (
                          <TargetFields {...getWeekendTargetFieldsProps()} />
                        ) : (
                          <p className="text-sm text-muted-foreground p-4 text-center border rounded-lg border-dashed">
                            Weekend targets will match Mon-Fri targets. Enable above to set different values.
                          </p>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>

                  <Button type="submit" disabled={upsertSettings.isPending}>
                    Save Targets
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Planning Mode & Portioning Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Planning Mode
          </CardTitle>
          <CardDescription>
            Choose how you want to plan your meals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                      >
                        <label
                          htmlFor="target_based"
                          className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                            field.value === "target_based" 
                              ? "border-primary bg-primary/5" 
                              : "hover:bg-accent"
                          }`}
                        >
                          <RadioGroupItem value="target_based" id="target_based" />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 font-medium">
                              <Target className="h-4 w-4 text-primary" />
                              System Automated
                            </div>
                            <p className="text-sm text-muted-foreground">
                              System auto-calculates portions to meet your daily targets. Protein prioritised.
                            </p>
                          </div>
                        </label>
                        <label
                          htmlFor="manual"
                          className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                            field.value === "manual" 
                              ? "border-primary bg-primary/5" 
                              : "hover:bg-accent"
                          }`}
                        >
                          <RadioGroupItem value="manual" id="manual" />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 font-medium">
                              <Scale className="h-4 w-4 text-primary" />
                              Manual
                            </div>
                            <p className="text-sm text-muted-foreground">
                              You set portions manually. System calculates totals only.
                            </p>
                          </div>
                        </label>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />

              {mode === "target_based" && (
                <Collapsible className="p-4 rounded-lg bg-muted/50">
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary w-full">
                    <Settings2 className="h-4 w-4" />
                    Advanced Portioning Settings
                    <ChevronDown className="h-4 w-4 ml-auto transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="min_grams_per_item"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Min portion size</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="5" 
                                min="1"
                                max="100"
                                placeholder="10"
                                {...field} 
                                value={field.value ?? ""} 
                              />
                            </FormControl>
                            <FormDescription>Smallest portion (grams)</FormDescription>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="max_grams_per_item"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max portion size</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="50" 
                                min="50"
                                max="2000"
                                placeholder="500"
                                {...field} 
                                value={field.value ?? ""} 
                              />
                            </FormControl>
                            <FormDescription>Largest portion (grams)</FormDescription>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="portion_rounding"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Round to nearest</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="1" 
                                min="1"
                                max="50"
                                placeholder="5"
                                {...field} 
                                value={field.value ?? ""} 
                              />
                            </FormControl>
                            <FormDescription>Portion rounding (grams)</FormDescription>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="target_tolerance_percent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target tolerance</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.5" 
                                min="0"
                                max="10"
                                placeholder="2"
                                {...field} 
                                value={field.value ?? ""} 
                              />
                            </FormControl>
                            <FormDescription>Acceptable % variance</FormDescription>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              <Button type="submit" disabled={upsertSettings.isPending}>
                Save Settings
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
