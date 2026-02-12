import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ComparisonResult } from "@/hooks/useComparisonResults";

interface LastScanCardProps {
  lastScanDate: string | null;
  recommendation: string | null;
  recommendationReason: string | null;
  bestOffer?: ComparisonResult | null;
  onScan?: () => void;
  isScanning?: boolean;
  scanProgress?: string | null;
  onViewBestDeal?: (offer: ComparisonResult) => void;
}

export function LastScanCard({ 
  lastScanDate, 
  recommendation, 
  recommendationReason,
  bestOffer,
  onScan,
  isScanning,
  scanProgress,
  onViewBestDeal,
}: LastScanCardProps) {
  const getRecommendationDisplay = () => {
    if (!recommendation) {
      return { icon: Clock, label: "Not scanned", color: "text-muted-foreground", bg: "bg-muted" };
    }
    switch (recommendation) {
      case "switch":
        return { icon: CheckCircle2, label: "Switch", color: "text-success", bg: "bg-success/10" };
      case "dont_switch":
        return { icon: XCircle, label: "Don't Switch", color: "text-muted-foreground", bg: "bg-muted" };
      case "review":
        return { icon: Search, label: "Review", color: "text-amber-500", bg: "bg-amber-500/10" };
      default:
        return { icon: Clock, label: "Pending", color: "text-muted-foreground", bg: "bg-muted" };
    }
  };

  const display = getRecommendationDisplay();
  const Icon = display.icon;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Last Scan Result
          </span>
          {onScan && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onScan}
              disabled={isScanning}
              className="h-7 text-xs"
            >
              {isScanning ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="h-3 w-3 mr-1" />
                  Scan Now
                </>
              )}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isScanning && scanProgress ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">{scanProgress}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full ${display.bg} flex items-center justify-center`}>
                <Icon className={`h-4 w-4 ${display.color}`} />
              </div>
              <span className={`text-lg font-bold ${display.color}`}>{display.label}</span>
            </div>
            {lastScanDate && (
              <p className="text-xs text-muted-foreground mt-2">
                Scanned {formatDistanceToNow(new Date(lastScanDate), { addSuffix: true })}
              </p>
            )}
            {recommendationReason && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {recommendationReason}
              </p>
            )}
            {/* Compare deals link */}
            {recommendation === 'switch' && onViewBestDeal && (
              <Button 
                size="sm" 
                className="mt-3 w-full sm:w-auto"
                onClick={() => onViewBestDeal?.(bestOffer!)}
              >
                Compare Deals
                <Search className="h-3 w-3 ml-1" />
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
