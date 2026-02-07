import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface LastScanCardProps {
  lastScanDate: string | null;
  recommendation: string | null;
  recommendationReason: string | null;
}

export function LastScanCard({ lastScanDate, recommendation, recommendationReason }: LastScanCardProps) {
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
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Search className="h-4 w-4" />
          Last Scan Result
        </CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
