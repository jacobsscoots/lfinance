import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PiggyBank, Receipt, CreditCard, Wallet } from "lucide-react";
import { formatCurrency, getValueColorClass, type PayCycleMetrics } from "@/lib/dashboardCalculations";
import { cn } from "@/lib/utils";

interface BudgetHealthCardProps {
  metrics: PayCycleMetrics;
  isLoading?: boolean;
}

interface StatItemProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClass?: string;
  sublabel?: string;
}

function StatItem({ label, value, icon, colorClass, sublabel }: StatItemProps) {
  return (
    <div className="text-center space-y-1">
      <div className="flex justify-center text-muted-foreground mb-1">
        {icon}
      </div>
      <p className={cn("text-lg font-bold", colorClass)}>
        {formatCurrency(value)}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {sublabel && (
        <p className="text-xs text-muted-foreground/70">{sublabel}</p>
      )}
    </div>
  );
}

export function BudgetHealthCard({ metrics, isLoading }: BudgetHealthCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="text-center space-y-2">
                <Skeleton className="h-8 w-8 mx-auto rounded-full" />
                <Skeleton className="h-6 w-16 mx-auto" />
                <Skeleton className="h-4 w-12 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!metrics.hasData) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Budget Health</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Connect an account to see budget health
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Budget Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatItem
            label="Income"
            value={metrics.totalIncome}
            sublabel="Received"
            icon={<Wallet className="h-5 w-5" />}
            colorClass="text-emerald-600 dark:text-emerald-400"
          />
          <StatItem
            label="Committed"
            value={metrics.committedRemaining}
            sublabel="Bills left"
            icon={<Receipt className="h-5 w-5" />}
            colorClass="text-foreground"
          />
          <StatItem
            label="Discretionary"
            value={metrics.discretionaryRemaining}
            sublabel="Left to spend"
            icon={<CreditCard className="h-5 w-5" />}
            colorClass={getValueColorClass(metrics.discretionaryRemaining)}
          />
          <StatItem
            label="Buffer"
            value={metrics.bufferAmount}
            sublabel="Leftover"
            icon={<PiggyBank className="h-5 w-5" />}
            colorClass={getValueColorClass(metrics.bufferAmount)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
