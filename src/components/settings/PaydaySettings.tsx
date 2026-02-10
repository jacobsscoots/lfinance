import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePaydaySettings, AdjustmentRule } from "@/hooks/usePaydaySettings";
import { Loader2, CalendarDays, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const ADJUSTMENT_RULES: { value: AdjustmentRule; label: string; description: string }[] = [
  {
    value: "previous_working_day",
    label: "Previous working day",
    description: "Pay moves to the Friday before (recommended for Monzo/early-pay banks)",
  },
  {
    value: "next_working_day",
    label: "Next working day",
    description: "Pay moves to the Monday after",
  },
  {
    value: "closest_working_day",
    label: "Closest working day",
    description: "Pay moves to whichever working day is nearest",
  },
  {
    value: "no_adjustment",
    label: "No adjustment",
    description: "Always pay on the exact date regardless of weekends/holidays",
  },
];

export function PaydaySettings() {
  const { effectiveSettings, isLoading, saveSettings, isSaving } = usePaydaySettings();
  
  const [paydayDate, setPaydayDate] = useState<number>(20);
  const [adjustmentRule, setAdjustmentRule] = useState<AdjustmentRule>("previous_working_day");
  const [dailyBudget, setDailyBudget] = useState<number>(15);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (effectiveSettings) {
      setPaydayDate(effectiveSettings.payday_date);
      setAdjustmentRule(effectiveSettings.adjustment_rule);
      setDailyBudget(effectiveSettings.daily_budget);
    }
  }, [effectiveSettings]);

  useEffect(() => {
    if (effectiveSettings) {
      const changed =
        paydayDate !== effectiveSettings.payday_date ||
        adjustmentRule !== effectiveSettings.adjustment_rule ||
        dailyBudget !== effectiveSettings.daily_budget;
      setHasChanges(changed);
    }
  }, [paydayDate, adjustmentRule, dailyBudget, effectiveSettings]);

  const handleSave = () => {
    saveSettings({ payday_date: paydayDate, adjustment_rule: adjustmentRule, daily_budget: dailyBudget });
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Payday Settings
        </CardTitle>
        <CardDescription>
          Configure when you get paid each month. This affects pay cycle calculations across the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="payday-date">Pay Date</Label>
          <div className="flex items-center gap-2">
            <Select
              value={paydayDate.toString()}
              onValueChange={(value) => setPaydayDate(parseInt(value))}
            >
              <SelectTrigger id="payday-date" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={day.toString()}>
                    {day}{getOrdinalSuffix(day)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">of each month</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="daily-budget">Daily Spending Budget (£)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="daily-budget"
              type="number"
              min="1"
              step="1"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-muted-foreground">per day</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Your target discretionary spend per day. Tracked on the Bills page.
          </p>
        </div>


        <div className="space-y-3">
          <Label>Adjustment Rule</Label>
          <p className="text-sm text-muted-foreground">
            When your payday falls on a weekend or UK bank holiday:
          </p>
          <RadioGroup
            value={adjustmentRule}
            onValueChange={(value) => setAdjustmentRule(value as AdjustmentRule)}
            className="space-y-3"
          >
            {ADJUSTMENT_RULES.map((rule) => (
              <div key={rule.value} className="flex items-start space-x-3">
                <RadioGroupItem value={rule.value} id={rule.value} className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor={rule.value} className="font-medium cursor-pointer">
                    {rule.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">{rule.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <Info className="h-4 w-4 flex-shrink-0" />
          <p>
            UK bank holidays are automatically considered when calculating adjusted paydays.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="w-full sm:w-auto"
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
