import { useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type MacroInputMode = "grams" | "percent";
type MacroSplit = { proteinPct: number; carbsPct: number };

interface TargetFieldsProps {
  prefix: "weekday" | "weekend";
  form: UseFormReturn<any>;
  macroMode: MacroInputMode;
  setMacroMode: (mode: MacroInputMode) => void;
  split: MacroSplit;
  setSplit: React.Dispatch<React.SetStateAction<MacroSplit>>;
}

export function TargetFields({
  prefix,
  form,
  macroMode,
  setMacroMode,
  split,
  setSplit,
}: TargetFieldsProps) {
  const isWeekend = prefix === "weekend";

  const clampPct = (n: number) => Math.max(0, Math.min(100, n));

  const caloriesName = isWeekend ? "weekend_calorie_target" : "daily_calorie_target";
  const proteinName = isWeekend ? "weekend_protein_target_grams" : "protein_target_grams";
  const carbsName = isWeekend ? "weekend_carbs_target_grams" : "carbs_target_grams";
  const fatName = isWeekend ? "weekend_fat_target_grams" : "fat_target_grams";

  const caloriesValue = form.watch(caloriesName);

  const fatPct = Math.max(0, 100 - split.proteinPct - split.carbsPct);
  const pctInvalid = split.proteinPct + split.carbsPct > 100;

  // Keep grams in sync when using percentage split.
  useEffect(() => {
    if (macroMode !== "percent") return;

    const calories = Number(caloriesValue ?? 0);
    if (!Number.isFinite(calories) || calories <= 0) return;
    if (pctInvalid) return;

    const proteinGrams = Math.max(0, Math.round(((calories * split.proteinPct) / 100) / 4));
    const carbsGrams = Math.max(0, Math.round(((calories * split.carbsPct) / 100) / 4));
    // Fat is DERIVED to keep calorie/macro math consistent with the rest of the app.
    const fatGrams = Math.max(0, Math.round((calories - proteinGrams * 4 - carbsGrams * 4) / 9));

    const currentProtein = Number(form.getValues(proteinName) ?? 0);
    const currentCarbs = Number(form.getValues(carbsName) ?? 0);
    const currentFat = Number(form.getValues(fatName) ?? 0);

    if (currentProtein !== proteinGrams) form.setValue(proteinName, proteinGrams, { shouldDirty: true });
    if (currentCarbs !== carbsGrams) form.setValue(carbsName, carbsGrams, { shouldDirty: true });
    if (currentFat !== fatGrams) form.setValue(fatName, fatGrams, { shouldDirty: true });
  }, [macroMode, caloriesValue, split.proteinPct, split.carbsPct, pctInvalid, form, proteinName, carbsName, fatName]);

  const deriveSplitFromCurrentGrams = () => {
    const calories = Number(form.getValues(caloriesName) ?? 0);
    const proteinGrams = Number(form.getValues(proteinName) ?? 0);
    const carbsGrams = Number(form.getValues(carbsName) ?? 0);

    if (!Number.isFinite(calories) || calories <= 0) return;

    const proteinPct = clampPct(Math.round(((proteinGrams * 4) / calories) * 100));
    const carbsPct = clampPct(Math.round(((carbsGrams * 4) / calories) * 100));
    setSplit({ proteinPct, carbsPct });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-medium">Macro input</div>
        <RadioGroup
          value={macroMode}
          onValueChange={(v) => {
            const nextMode = v as MacroInputMode;
            setMacroMode(nextMode);
            if (nextMode === "percent") deriveSplitFromCurrentGrams();
          }}
          className="flex gap-4"
        >
          <label className="flex items-center gap-2 cursor-pointer">
            <RadioGroupItem value="grams" id={`${prefix}-macro-grams`} />
            <span className="text-sm">Grams</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <RadioGroupItem value="percent" id={`${prefix}-macro-percent`} />
            <span className="text-sm">Percent split</span>
          </label>
        </RadioGroup>
      </div>

      {macroMode === "percent" && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="text-sm font-medium">Protein %</div>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={split.proteinPct}
                onChange={(e) =>
                  setSplit((prev) => ({
                    ...prev,
                    proteinPct: clampPct(Number(e.target.value || 0)),
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Carbs %</div>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={split.carbsPct}
                onChange={(e) =>
                  setSplit((prev) => ({
                    ...prev,
                    carbsPct: clampPct(Number(e.target.value || 0)),
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Fat %</div>
              <Input type="number" value={fatPct} disabled />
            </div>
          </div>
          {pctInvalid ? (
            <div className="text-xs text-destructive">
              Protein% + Carbs% must be ≤ 100 (fat is derived from the remainder).
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Protein/Carbs grams auto-update when calories change. Fat is derived from remaining calories.
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FormField
          control={form.control}
          name={caloriesName}
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
          name={proteinName}
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
                  disabled={macroMode === "percent"}
                />
              </FormControl>
              <FormDescription>grams/day</FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={carbsName}
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
                  disabled={macroMode === "percent"}
                />
              </FormControl>
              <FormDescription>grams/day</FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={fatName}
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
                  disabled={macroMode === "percent"}
                />
              </FormControl>
              <FormDescription>grams/day</FormDescription>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
