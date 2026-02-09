import { useState } from "react";
import { format, parse } from "date-fns";
import { AlertTriangle, CalendarDays, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MealPlan } from "@/hooks/useMealPlanItems";

interface CopyToDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourcePlan: MealPlan;
  weekDates: string[];
  mealPlans: MealPlan[];
  onConfirm: (targetDate: string) => void;
  isPending: boolean;
}

export function CopyToDateDialog({
  open,
  onOpenChange,
  sourcePlan,
  weekDates,
  mealPlans,
  onConfirm,
  isPending,
}: CopyToDateDialogProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  const sourceDate = parse(sourcePlan.meal_date, "yyyy-MM-dd", new Date());
  const sourceItemCount = sourcePlan.items?.length || 0;
  
  // Get available dates (excluding source date)
  const availableDates = weekDates.filter(d => d !== sourcePlan.meal_date);
  
  // Get item counts for each date
  const getItemCount = (date: string) => {
    const plan = mealPlans.find(p => p.meal_date === date);
    return plan?.items?.length || 0;
  };

  const handleConfirm = () => {
    if (selectedDate) {
      onConfirm(selectedDate);
    }
  };

  // Reset selection when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedDate(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Copy Meals
          </DialogTitle>
          <DialogDescription>
            Copy {sourceItemCount} item{sourceItemCount !== 1 ? "s" : ""} from{" "}
            <span className="font-medium text-foreground">
              {format(sourceDate, "EEEE d MMM")}
            </span>{" "}
            to another day.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label className="text-sm font-medium mb-3 block">
            Select destination:
          </Label>
          <RadioGroup
            value={selectedDate || ""}
            onValueChange={setSelectedDate}
            className="space-y-2"
          >
            {availableDates.map((date) => {
              const parsedDate = parse(date, "yyyy-MM-dd", new Date());
              const itemCount = getItemCount(date);
              const hasItems = itemCount > 0;
              
              return (
                <div
                  key={date}
                  className={cn(
                    "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                    selectedDate === date
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                  onClick={() => setSelectedDate(date)}
                >
                  <RadioGroupItem value={date} id={date} />
                  <Label
                    htmlFor={date}
                    className="flex-1 flex items-center justify-between cursor-pointer"
                  >
                    <span className="font-medium">
                      {format(parsedDate, "EEE d MMM")}
                    </span>
                    {hasItems && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        Has {itemCount} item{itemCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
          
          <p className="text-xs text-muted-foreground mt-3">
            Items will be added to the target day. Use "Reset Day" first if you want to replace instead.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedDate || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Copying...
              </>
            ) : (
              "Copy Meals"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
