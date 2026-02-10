import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TrendingUp, Calculator, Target } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  calculateProjectionScenarios, 
  RISK_PRESETS 
} from "@/lib/investmentCalculations";

const PERIOD_OPTIONS = [
  { value: "1", label: "1 Month" },
  { value: "3", label: "3 Months" },
  { value: "6", label: "6 Months" },
  { value: "12", label: "1 Year" },
  { value: "24", label: "2 Years" },
  { value: "36", label: "3 Years" },
  { value: "60", label: "5 Years" },
  { value: "120", label: "10 Years" },
];

interface ProjectionCardProps {
  currentValue: number;
  monthlyContribution: number;
  expectedAnnualReturn: number;
  onReturnChange: (value: number) => void;
  onContributionChange: (value: number) => void;
}

export function ProjectionCard({
  currentValue,
  monthlyContribution,
  expectedAnnualReturn,
  onReturnChange,
  onContributionChange,
}: ProjectionCardProps) {
  const [periods, setPeriods] = useState<[string, string, string]>(["3", "6", "12"]);

  const projections = useMemo(() => {
    return periods.map((p) => ({
      months: parseInt(p),
      data: calculateProjectionScenarios(currentValue, monthlyContribution, expectedAnnualReturn, parseInt(p)),
    }));
  }, [currentValue, monthlyContribution, expectedAnnualReturn, periods]);

  const updatePeriod = (index: number, value: string) => {
    setPeriods((prev) => {
      const next = [...prev] as [string, string, string];
      next[index] = value;
      return next;
    });
  };

  const formatCurrency = (value: number) => {
    return `£${value.toLocaleString("en-GB", { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    })}`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Projections
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {expectedAnnualReturn}% annual
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Return Rate Adjustment */}
        <div className="space-y-2">
          <Label className="text-sm">Expected Annual Return</Label>
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {(["conservative", "medium", "aggressive"] as const).map((preset) => (
              <Button
                key={preset}
                variant={expectedAnnualReturn === RISK_PRESETS[preset] ? "default" : "outline"}
                size="sm"
                onClick={() => onReturnChange(RISK_PRESETS[preset])}
                className="text-xs px-1 sm:px-3"
              >
                <span className="hidden sm:inline">{preset.slice(0, 4)}</span>
                <span className="sm:hidden">{preset.slice(0, 1).toUpperCase()}</span>
                <span className="ml-1">({RISK_PRESETS[preset]}%)</span>
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.5"
              min="0"
              max="50"
              value={expectedAnnualReturn}
              onChange={(e) => onReturnChange(parseFloat(e.target.value) || 0)}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">% per year</span>
          </div>
        </div>

        {/* Projection Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {projections.map(({ months, data }, index) => {
            const contributionGrowth = monthlyContribution * months;
            const growthOnly = data.expected - currentValue - contributionGrowth;
            
            return (
              <div key={index} className="text-center p-2 sm:p-3 rounded-lg bg-muted/50">
                <Select value={periods[index]} onValueChange={(v) => updatePeriod(index, v)}>
                  <SelectTrigger className="h-7 text-xs border-dashed mx-auto mb-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {PERIOD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm sm:text-lg font-bold text-foreground">
                  {formatCurrency(data.expected)}
                </p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-success flex-shrink-0" />
                  <span className="text-xs text-success truncate">
                    +{formatCurrency(growthOnly)}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                  <div className="flex justify-between gap-1">
                    <span>Low</span>
                    <span className="truncate">{formatCurrency(data.conservative)}</span>
                  </div>
                  <div className="flex justify-between gap-1">
                    <span>High</span>
                    <span className="truncate">{formatCurrency(data.aggressive)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Editable Monthly Contribution */}
        <div className="flex items-center justify-between text-sm p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span>Monthly contribution</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">£</span>
            <Input
              type="number"
              step="1"
              min="0"
              value={monthlyContribution}
              onChange={(e) => onContributionChange(parseFloat(e.target.value) || 0)}
              className="w-20 h-8 text-right font-medium"
            />
            <span className="text-muted-foreground">/month</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
