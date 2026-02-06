import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Target, Scale } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useNutritionSettings, NutritionMode } from "@/hooks/useNutritionSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";

const settingsSchema = z.object({
  mode: z.enum(["target_based", "manual"]),
  daily_calorie_target: z.coerce.number().min(0).nullable().optional(),
  protein_target_grams: z.coerce.number().min(0).nullable().optional(),
  carbs_target_grams: z.coerce.number().min(0).nullable().optional(),
  fat_target_grams: z.coerce.number().min(0).nullable().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export function NutritionTargetSettings() {
  const { settings, isLoading, upsertSettings } = useNutritionSettings();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      mode: "manual",
      daily_calorie_target: 2000,
      protein_target_grams: 150,
      carbs_target_grams: 200,
      fat_target_grams: 65,
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
      });
    }
  }, [settings, form]);

  const mode = form.watch("mode");

  async function onSubmit(values: SettingsFormValues) {
    await upsertSettings.mutateAsync({
      mode: values.mode as NutritionMode,
      daily_calorie_target: values.daily_calorie_target,
      protein_target_grams: values.protein_target_grams,
      carbs_target_grams: values.carbs_target_grams,
      fat_target_grams: values.fat_target_grams,
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
                            Target-based
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
                <h4 className="font-medium">Daily Targets</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="daily_calorie_target"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Calories</FormLabel>
                        <FormControl>
                          <Input type="number" step="50" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormDescription>kcal/day</FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="protein_target_grams"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Protein</FormLabel>
                        <FormControl>
                          <Input type="number" step="5" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormDescription>grams/day</FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="carbs_target_grams"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carbs</FormLabel>
                        <FormControl>
                          <Input type="number" step="5" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormDescription>grams/day</FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fat_target_grams"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fat</FormLabel>
                        <FormControl>
                          <Input type="number" step="5" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormDescription>grams/day</FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
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
