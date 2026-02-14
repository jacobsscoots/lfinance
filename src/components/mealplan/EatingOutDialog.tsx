import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Utensils } from "lucide-react";

export interface EatingOutData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  label: string;
}

interface EatingOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: EatingOutData) => void;
}

export function EatingOutDialog({ open, onOpenChange, onConfirm }: EatingOutDialogProps) {
  const [label, setLabel] = useState("");
  const [calories, setCalories] = useState("500");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [excludeFromTargets, setExcludeFromTargets] = useState(false);

  const handleConfirm = () => {
    if (excludeFromTargets) {
      onConfirm({ calories: 0, protein: 0, carbs: 0, fat: 0, label: label.trim() });
    } else {
      onConfirm({
        calories: parseFloat(calories) || 0,
        protein: parseFloat(protein) || 0,
        carbs: parseFloat(carbs) || 0,
        fat: parseFloat(fat) || 0,
        label: label.trim(),
      });
    }
    // Reset for next time
    setLabel("");
    setCalories("500");
    setProtein("");
    setCarbs("");
    setFat("");
    setExcludeFromTargets(false);
  };

  const calNum = parseFloat(calories) || 0;
  const pNum = parseFloat(protein) || 0;
  const cNum = parseFloat(carbs) || 0;
  const fNum = parseFloat(fat) || 0;

  // Calculate macro-derived calories for comparison
  const macroCals = (pNum * 4) + (cNum * 4) + (fNum * 9);
  const hasMacros = pNum > 0 || cNum > 0 || fNum > 0;
  const calDiff = hasMacros ? Math.abs(calNum - macroCals) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-primary" />
            Restaurant / Eating Out
          </DialogTitle>
          <DialogDescription>
            Enter the nutritional info from the restaurant menu. You can usually find this on their website or app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Restaurant / Meal Label */}
          <div className="space-y-2">
            <Label>Restaurant / Meal Name</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Nando's Half Chicken"
              maxLength={100}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label>Exclude from targets</Label>
              <p className="text-sm text-muted-foreground">
                Don't count this meal toward daily totals
              </p>
            </div>
            <Switch 
              checked={excludeFromTargets} 
              onCheckedChange={setExcludeFromTargets} 
            />
          </div>

          {!excludeFromTargets && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Calories (kcal)</Label>
                <Input
                  type="number"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  min="0"
                  step="10"
                  placeholder="e.g. 800"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Protein (g)</Label>
                  <Input
                    type="number"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    min="0"
                    step="1"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Carbs (g)</Label>
                  <Input
                    type="number"
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value)}
                    min="0"
                    step="1"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fat (g)</Label>
                  <Input
                    type="number"
                    value={fat}
                    onChange={(e) => setFat(e.target.value)}
                    min="0"
                    step="1"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Macro validation hint */}
              {hasMacros && calDiff > 50 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Macro-derived calories: {Math.round(macroCals)} kcal (P×4 + C×4 + F×9). 
                  {calNum < macroCals ? " Your calorie entry is lower — the menu might not include all items." : " Your calorie entry is higher — the menu may include fibre/alcohol."}
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Tip: Check the restaurant's website or app for nutritional info. Macros are optional but help the solver plan your other meals more accurately.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>
              Confirm
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
