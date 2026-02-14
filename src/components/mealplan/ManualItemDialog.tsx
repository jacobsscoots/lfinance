import { useState, useEffect } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, PenLine } from "lucide-react";
import { MealType } from "@/hooks/useMealPlanItems";

export interface ManualItemData {
  custom_name: string;
  quantity_grams: number;
  custom_calories: number;
  custom_protein: number;
  custom_carbs: number;
  custom_fat: number;
  meal_type: MealType;
}

interface ManualItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealType: MealType;
  onConfirm: (data: ManualItemData) => void;
}

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

export function ManualItemDialog({ open, onOpenChange, mealType, onConfirm }: ManualItemDialogProps) {
  const [name, setName] = useState("");
  const [grams, setGrams] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setGrams("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
    }
  }, [open]);

  const parsedCals = parseFloat(calories) || 0;
  const parsedP = parseFloat(protein) || 0;
  const parsedC = parseFloat(carbs) || 0;
  const parsedF = parseFloat(fat) || 0;

  // Macro-implied calories
  const impliedCals = Math.round(parsedP * 4 + parsedC * 4 + parsedF * 9);
  const calDiff = parsedCals > 0 ? Math.abs(parsedCals - impliedCals) : 0;
  const showCalWarning = parsedCals > 0 && calDiff > 50;

  const isValid = name.trim().length > 0 && parsedCals > 0;

  const handleConfirm = () => {
    onConfirm({
      custom_name: name.trim(),
      quantity_grams: parseFloat(grams) || 0,
      custom_calories: parsedCals,
      custom_protein: parsedP,
      custom_carbs: parsedC,
      custom_fat: parsedF,
      meal_type: mealType,
    });
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader className="pr-8">
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <PenLine className="h-4 w-4" />
            Manual Entry — {MEAL_LABELS[mealType]}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Food / Meal Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nando's Chicken Burger"
            />
          </div>

          <div className="space-y-2">
            <Label>Weight (g) <span className="text-muted-foreground font-normal">— optional</span></Label>
            <Input
              type="number"
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              placeholder="e.g. 350"
              min="0"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Calories (kcal) *</Label>
              <Input
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                placeholder="e.g. 650"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Protein (g)</Label>
              <Input
                type="number"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                placeholder="e.g. 42"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Carbs (g)</Label>
              <Input
                type="number"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                placeholder="e.g. 55"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Fat (g)</Label>
              <Input
                type="number"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                placeholder="e.g. 28"
                min="0"
              />
            </div>
          </div>

          {showCalWarning && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Macro-implied calories: {impliedCals} kcal vs entered {Math.round(parsedCals)} kcal (diff: {calDiff} kcal).
                This may indicate fibre or alcohol content.
              </AlertDescription>
            </Alert>
          )}

          {parsedCals > 0 && (
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <div className="text-sm font-medium">Summary</div>
              <div className="grid grid-cols-4 gap-2 text-sm text-center">
                <div>
                  <div className="font-semibold">{Math.round(parsedCals)}</div>
                  <div className="text-xs text-muted-foreground">kcal</div>
                </div>
                <div>
                  <div className="font-semibold">{Math.round(parsedP)}g</div>
                  <div className="text-xs text-muted-foreground">Protein</div>
                </div>
                <div>
                  <div className="font-semibold">{Math.round(parsedC)}g</div>
                  <div className="text-xs text-muted-foreground">Carbs</div>
                </div>
                <div>
                  <div className="font-semibold">{Math.round(parsedF)}g</div>
                  <div className="text-xs text-muted-foreground">Fat</div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={!isValid}>Add Entry</Button>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
