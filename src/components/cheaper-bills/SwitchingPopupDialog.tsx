import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, TrendingDown, AlertCircle } from "lucide-react";
import { ComparisonResult } from "@/hooks/useComparisonResults";

interface SwitchingPopupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ComparisonResult | null;
  currentMonthlyCost: number;
}

export function SwitchingPopupDialog({
  open,
  onOpenChange,
  result,
  currentMonthlyCost,
}: SwitchingPopupDialogProps) {
  if (!result) return null;

  const currentAnnualCost = currentMonthlyCost * 12;
  const newAnnualCost = result.annual_cost || result.monthly_cost * 12;
  const annualSavings = currentAnnualCost - newAnnualCost;
  const monthlySavings = annualSavings / 12;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[450px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Switch to Save</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Details for switching to {result.provider}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="py-4 space-y-6">
          {/* Provider and Plan */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold">{result.provider}</h3>
              {result.is_best_offer && (
                <Badge variant="default">Best Deal</Badge>
              )}
            </div>
            {result.plan_name && (
              <p className="text-muted-foreground">{result.plan_name}</p>
            )}
          </div>

          {/* Savings Summary */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
            <div>
              <p className="text-xs text-muted-foreground">New Monthly Cost</p>
              <p className="text-2xl font-bold">
                £{result.monthly_cost.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                was £{currentMonthlyCost.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Annual Savings</p>
              <p className="text-2xl font-bold text-success flex items-center gap-1">
                <TrendingDown className="h-5 w-5" />
                £{Math.round(annualSavings)}
              </p>
              <p className="text-xs text-muted-foreground">
                £{monthlySavings.toFixed(2)}/month
              </p>
            </div>
          </div>

          {/* Features if available */}
          {result.features && Object.keys(result.features).length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Plan Features</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {Object.entries(result.features).map(([key, value]) => (
                  <li key={key} className="flex items-center gap-2">
                    <span className="text-success">✓</span>
                    <span>
                      {key}: {String(value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* No link warning */}
          {!result.website_url && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertCircle className="h-5 w-5 text-warning shrink-0" />
              <p className="text-sm text-warning">
                No switching link available for this deal. Search for "{result.provider} {result.plan_name || result.service_type}" to find the offer.
              </p>
            </div>
          )}

          {/* Source info */}
          <p className="text-xs text-muted-foreground text-center">
            Scanned {result.scanned_at ? new Date(result.scanned_at).toLocaleDateString() : "recently"} 
            {result.source && ` via ${result.source}`}
          </p>
        </div>

        <ResponsiveDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {result.website_url && (
            <Button asChild>
              <a
                href={result.website_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Deal
                <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </Button>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
