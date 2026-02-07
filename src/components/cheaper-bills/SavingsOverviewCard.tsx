import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown } from "lucide-react";

interface SavingsOverviewCardProps {
  totalSavings: number;
  servicesCount: number;
}

export function SavingsOverviewCard({ totalSavings, servicesCount }: SavingsOverviewCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <TrendingDown className="h-4 w-4" />
          Estimated Savings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-success">
          £{totalSavings.toLocaleString("en-GB", { minimumFractionDigits: 0 })}/year
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {servicesCount > 0
            ? `across ${servicesCount} tracked service${servicesCount > 1 ? "s" : ""}`
            : "Add services to see potential savings"}
        </p>
      </CardContent>
    </Card>
  );
}
