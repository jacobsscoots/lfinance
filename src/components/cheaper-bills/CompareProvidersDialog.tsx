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
import { ExternalLink, TrendingDown, Trophy, ArrowUpDown } from "lucide-react";
import { ComparisonResult } from "@/hooks/useComparisonResults";
import { useState, useMemo } from "react";

interface CompareProvidersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: ComparisonResult[];
  currentMonthlyCost: number;
  serviceType?: string;
}

type SortKey = "savings" | "monthly" | "provider";

export function CompareProvidersDialog({
  open,
  onOpenChange,
  results,
  currentMonthlyCost,
  serviceType,
}: CompareProvidersDialogProps) {
  const [sortBy, setSortBy] = useState<SortKey>("savings");

  const currentAnnualCost = currentMonthlyCost * 12;

  const sortedResults = useMemo(() => {
    const withSavings = results.map((r) => ({
      ...r,
      savings: currentAnnualCost - (r.annual_cost || r.monthly_cost * 12),
    }));

    switch (sortBy) {
      case "savings":
        return withSavings.sort((a, b) => b.savings - a.savings);
      case "monthly":
        return withSavings.sort((a, b) => a.monthly_cost - b.monthly_cost);
      case "provider":
        return withSavings.sort((a, b) => a.provider.localeCompare(b.provider));
      default:
        return withSavings;
    }
  }, [results, sortBy, currentAnnualCost]);

  const bestSavings = sortedResults.length > 0 ? Math.max(...sortedResults.map((r) => r.savings)) : 0;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[700px] max-h-[85vh]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            Compare {serviceType ? `${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)} ` : ""}Providers
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {sortedResults.length} deal{sortedResults.length !== 1 ? "s" : ""} found
            {currentMonthlyCost > 0 && (
              <> · You currently pay <strong>£{currentMonthlyCost.toFixed(2)}/mo</strong></>
            )}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-2 overflow-y-auto max-h-[55vh] pr-1">
          {/* Sort controls */}
          <div className="flex gap-1 pb-2 border-b">
            <span className="text-xs text-muted-foreground self-center mr-1">Sort:</span>
            {(["savings", "monthly", "provider"] as SortKey[]).map((key) => (
              <Button
                key={key}
                variant={sortBy === key ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSortBy(key)}
              >
                <ArrowUpDown className="h-3 w-3 mr-1" />
                {key === "savings" ? "Savings" : key === "monthly" ? "Price" : "Name"}
              </Button>
            ))}
          </div>

          {sortedResults.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No deals found yet. Run a scan to compare providers.
            </p>
          ) : (
            sortedResults.map((result, idx) => {
              const isBest = result.savings === bestSavings && result.savings > 0;
              return (
                <div
                  key={result.id}
                  className={`flex flex-col gap-2 p-3 rounded-lg border ${
                    isBest ? "border-primary bg-primary/5" : "bg-muted/30"
                  }`}
                >
                  {/* Provider header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isBest && (
                          <Trophy className="h-4 w-4 text-primary shrink-0" />
                        )}
                        <span className="font-semibold text-sm">{result.provider}</span>
                        {result.is_best_offer && (
                          <Badge variant="default" className="text-[10px] h-5">
                            Best Deal
                          </Badge>
                        )}
                      </div>
                      {result.plan_name && (
                        <p className="text-xs text-muted-foreground mt-0.5">{result.plan_name}</p>
                      )}
                    </div>
                    {result.website_url && (
                      <Button asChild size="sm" variant="outline" className="shrink-0 h-7 text-xs">
                        <a href={result.website_url} target="_blank" rel="noopener noreferrer">
                          Visit
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Monthly</p>
                      <p className="font-bold">£{result.monthly_cost.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Annual</p>
                      <p className="font-medium">
                        £{(result.annual_cost || result.monthly_cost * 12).toFixed(0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Saving</p>
                      <p className={`font-bold flex items-center gap-1 ${result.savings > 0 ? "text-success" : "text-destructive"}`}>
                        {result.savings > 0 && <TrendingDown className="h-3 w-3" />}
                        £{Math.abs(Math.round(result.savings))}/yr
                      </p>
                    </div>
                  </div>

                  {/* Features row */}
                  {result.features && Object.keys(result.features).length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {result.features.speed !== undefined && (
                        <Badge variant="secondary" className="text-[10px]">
                          {result.features.speed}Mbps
                        </Badge>
                      )}
                      {result.features.data !== undefined && (
                        <Badge variant="secondary" className="text-[10px]">
                          {result.features.data === -1 ? "Unlimited" : `${result.features.data}GB`}
                        </Badge>
                      )}
                      {result.features.contract !== undefined && (
                        <Badge variant="secondary" className="text-[10px]">
                          {result.features.contract === 0 ? "No contract" : `${result.features.contract}mo`}
                        </Badge>
                      )}
                      {result.features.isFixed !== undefined && (
                        <Badge variant="secondary" className="text-[10px]">
                          {result.features.isFixed ? "Fixed" : "Variable"}
                        </Badge>
                      )}
                      {result.features.unitRate !== undefined && (
                        <Badge variant="secondary" className="text-[10px]">
                          {result.features.unitRate}p/kWh
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <ResponsiveDialogFooter>
          <p className="text-[10px] text-muted-foreground flex-1">
            Prices are estimates based on market data. Always verify on the provider's website.
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
