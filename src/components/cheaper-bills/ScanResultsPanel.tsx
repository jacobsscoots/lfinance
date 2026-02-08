import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, TrendingDown } from "lucide-react";
import { ComparisonResult } from "@/hooks/useComparisonResults";

interface ScanResultsPanelProps {
  results: ComparisonResult[];
  currentMonthlyCost: number;
}

export function ScanResultsPanel({ results, currentMonthlyCost }: ScanResultsPanelProps) {
  const currentAnnualCost = currentMonthlyCost * 12;

  // Sort by savings (highest first)
  const sortedResults = [...results]
    .map(r => ({
      ...r,
      savings: currentAnnualCost - (r.annual_cost || r.monthly_cost * 12),
    }))
    .filter(r => r.savings > 0)
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 5);

  if (sortedResults.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No cheaper alternatives found - you're on a great deal!
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sortedResults.map((result) => (
        <div
          key={result.id}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-muted/50"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{result.provider}</span>
              {result.is_best_offer && (
                <Badge variant="default" className="text-xs">
                  Best Deal
                </Badge>
              )}
            </div>
            {result.plan_name && (
              <p className="text-xs text-muted-foreground truncate">{result.plan_name}</p>
            )}
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm">
                £{result.monthly_cost.toFixed(2)}/mo
              </span>
              <span className="text-sm text-success font-medium flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                Save £{Math.round(result.savings)}/yr
              </span>
            </div>
          </div>
          {result.website_url && (
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <a href={result.website_url} target="_blank" rel="noopener noreferrer">
                View Deal
                <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
