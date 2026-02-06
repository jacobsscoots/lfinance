import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface EatingOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (calories: number) => void;
}

export function EatingOutDialog({ open, onOpenChange, onConfirm }: EatingOutDialogProps) {
  const [estimatedCalories, setEstimatedCalories] = useState<string>("500");
  const [excludeFromTargets, setExcludeFromTargets] = useState(false);

  const handleConfirm = () => {
    const calories = excludeFromTargets ? 0 : parseFloat(estimatedCalories) || 0;
    onConfirm(calories);
    // Reset for next time
    setEstimatedCalories("500");
    setExcludeFromTargets(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eating Out</DialogTitle>
          <DialogDescription>
            Estimate the calories for this meal or exclude it from your daily targets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
            <div className="space-y-2">
              <Label>Estimated Calories</Label>
              <Input
                type="number"
                value={estimatedCalories}
                onChange={(e) => setEstimatedCalories(e.target.value)}
                min="0"
                step="50"
                placeholder="e.g. 800"
              />
              <p className="text-sm text-muted-foreground">
                Quick estimates: Light meal ~400-600, Regular ~600-900, Large ~900+
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
