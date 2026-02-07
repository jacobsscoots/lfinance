import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TrendingUp, Calculator, Target } from "lucide-react";
import { 
  calculateProjectionScenarios, 
  RISK_PRESETS 
} from "@/lib/investmentCalculations";

interface ProjectionCardProps {
  currentValue: number;
  monthlyContribution: number;
  expectedAnnualReturn: number;
  onReturnChange: (value: number) => void;
}

export function ProjectionCard({
  currentValue,
  monthlyContribution,
  expectedAnnualReturn,
  onReturnChange,
}: ProjectionCardProps) {
  const projections = useMemo(() => {
    return {
      "3m": calculateProjectionScenarios(currentValue, monthlyContribution, expectedAnnualReturn, 3),
      "6m": calculateProjectionScenarios(currentValue, monthlyContribution, expectedAnnualReturn, 6),
      "12m": calculateProjectionScenarios(currentValue, monthlyContribution, expectedAnnualReturn, 12),
    };
  }, [currentValue, monthlyContribution, expectedAnnualReturn]);

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
          <div className="flex gap-2">
            {(["conservative", "medium", "aggressive"] as const).map((preset) => (
              <Button
                key={preset}
                variant={expectedAnnualReturn === RISK_PRESETS[preset] ? "default" : "outline"}
                size="sm"
                onClick={() => onReturnChange(RISK_PRESETS[preset])}
                className="flex-1 text-xs capitalize"
              >
                {preset.slice(0, 4)} ({RISK_PRESETS[preset]}%)
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
        <div className="grid grid-cols-3 gap-3">
          {(["3m", "6m", "12m"] as const).map((period) => {
            const data = projections[period];
            const contributionGrowth = monthlyContribution * parseInt(period);
            const growthOnly = data.expected - currentValue - contributionGrowth;
            
            return (
              <div key={period} className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground uppercase mb-1">
                  {period === "3m" ? "3 Months" : period === "6m" ? "6 Months" : "1 Year"}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(data.expected)}
                </p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-success" />
                  <span className="text-xs text-success">
                    +{formatCurrency(growthOnly)} growth
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Low</span>
                    <span>{formatCurrency(data.conservative)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>High</span>
                    <span>{formatCurrency(data.aggressive)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between text-sm p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span>Monthly contribution</span>
          </div>
          <span className="font-medium">
            {formatCurrency(monthlyContribution)}/month
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
