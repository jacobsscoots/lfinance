import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Target, Scale, Copy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNutritionSettings, NutritionMode } from "@/hooks/useNutritionSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export function NutritionTargetSettings() {
  const { settings, isLoading, upsertSettings } = useNutritionSettings();
  const [activeTab, setActiveTab] = useState<"weekday" | "weekend">("weekday");

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
    },
  });

  // Update form when settings load
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
      });
    }
  }, [settings, form]);

  const mode = form.watch("mode");
  const weekendEnabled = form.watch("weekend_targets_enabled");

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

  const TargetFields = ({ prefix }: { prefix: "weekday" | "weekend" }) => {
    const isWeekend = prefix === "weekend";
    
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FormField
          control={form.control}
          name={isWeekend ? "weekend_calorie_target" : "daily_calorie_target"}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Calories</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="50" 
                  placeholder={isWeekend ? "Same as weekday" : "2000"}
                  {...field} 
                  value={field.value ?? ""} 
                />
              </FormControl>
              <FormDescription>kcal/day</FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={isWeekend ? "weekend_protein_target_grams" : "protein_target_grams"}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Protein</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="5" 
                  placeholder={isWeekend ? "Same as weekday" : "150"}
                  {...field} 
                  value={field.value ?? ""} 
                />
              </FormControl>
              <FormDescription>grams/day</FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={isWeekend ? "weekend_carbs_target_grams" : "carbs_target_grams"}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Carbs</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="5" 
                  placeholder={isWeekend ? "Same as weekday" : "200"}
                  {...field} 
                  value={field.value ?? ""} 
                />
              </FormControl>
              <FormDescription>grams/day</FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={isWeekend ? "weekend_fat_target_grams" : "fat_target_grams"}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fat</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  step="5" 
                  placeholder={isWeekend ? "Same as weekday" : "65"}
                  {...field} 
                  value={field.value ?? ""} 
                />
              </FormControl>
              <FormDescription>grams/day</FormDescription>
            </FormItem>
          )}
        />
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Nutrition Targets
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
                  <FormLabel>Planning Mode</FormLabel>
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
                
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "weekday" | "weekend")}>
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
                    <TargetFields prefix="weekday" />
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
                      <TargetFields prefix="weekend" />
                    ) : (
                      <p className="text-sm text-muted-foreground p-4 text-center border rounded-lg border-dashed">
                        Weekend targets will match Mon-Fri targets. Enable above to set different values.
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}

            <Button type="submit" disabled={upsertSettings.isPending}>
              Save Settings
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
