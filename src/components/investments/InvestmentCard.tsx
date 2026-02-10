import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  MoreVertical, 
  Pencil, 
  Trash2,
  Building,
  Calendar,
  Percent,
  Activity
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InvestmentAccount } from "@/hooks/useInvestments";
import { InvestmentTransaction } from "@/hooks/useInvestmentTransactions";
import { InvestmentValuation } from "@/hooks/useInvestmentValuations";
import { 
  calculateContributionTotal, 
  calculateReturn, 
  calculateDailyChange,
  calculateDailyValues
} from "@/lib/investmentCalculations";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface InvestmentCardProps {
  investment: InvestmentAccount;
  transactions: InvestmentTransaction[];
  livePrice?: { price: number; dailyChange?: { amount: number; percentage: number } | null } | null;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function InvestmentCard({
  investment,
  transactions,
  livePrice,
  onClick,
  onEdit,
  onDelete,
}: InvestmentCardProps) {
  const metrics = useMemo(() => {
    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      transaction_date: tx.transaction_date,
      type: tx.type as 'deposit' | 'withdrawal' | 'fee' | 'dividend',
      amount: tx.amount,
    }));

    const totalContributions = calculateContributionTotal(formattedTransactions);

    // If we have a live price AND transactions have units, use units * price
    if (livePrice && investment.ticker_symbol) {
      const totalUnits = transactions.reduce((sum, tx) => {
        const units = Number(tx.units) || 0;
        if (tx.type === 'deposit' || tx.type === 'dividend') return sum + units;
        if (tx.type === 'withdrawal') return sum - units;
        return sum;
      }, 0);

      const currentValue = totalUnits * livePrice.price;
      const totalReturn = currentValue - totalContributions;
      const returnPercentage = calculateReturn(currentValue, totalContributions);
      const dailyChange = livePrice.dailyChange 
        ? { amount: totalUnits * livePrice.dailyChange.amount, percentage: livePrice.dailyChange.percentage }
        : calculateDailyChange(currentValue, investment.expected_annual_return);

      return {
        currentValue,
        totalContributions,
        returnPercentage,
        totalReturn,
        dailyChange,
        totalUnits,
        unitPrice: livePrice.price,
        isLive: true,
      };
    }

    // Fallback to estimated compound growth
    const today = new Date();
    const startDate = new Date(investment.start_date);
    const dailyValues = calculateDailyValues(
      formattedTransactions,
      [],
      startDate,
      today,
      investment.expected_annual_return
    );

    const currentValue = dailyValues.length > 0 
      ? dailyValues[dailyValues.length - 1].value 
      : 0;
    
    const returnPercentage = calculateReturn(currentValue, totalContributions);
    const totalReturn = currentValue - totalContributions;
    const dailyChange = calculateDailyChange(currentValue, investment.expected_annual_return);

    return {
      currentValue,
      totalContributions,
      returnPercentage,
      totalReturn,
      dailyChange,
      totalUnits: 0,
      unitPrice: 0,
      isLive: false,
    };
  }, [investment, transactions, livePrice]);

  const isPositive = metrics.totalReturn >= 0;
  const isDailyPositive = metrics.dailyChange.amount >= 0;

  return (
    <Card 
      className="group cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between pb-2 gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base sm:text-lg truncate">{investment.name}</CardTitle>
            {metrics.isLive && (
              <Badge variant="outline" className="gap-1 text-[10px] border-success/50 text-success">
                <Activity className="h-3 w-3" />
                Live
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mt-1">
            {investment.provider && (
              <div className="flex items-center gap-1">
                <Building className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{investment.provider}</span>
              </div>
            )}
            {investment.ticker_symbol && (
              <Badge variant="secondary" className="text-xs py-0">{investment.ticker_symbol}</Badge>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>{format(new Date(investment.start_date), "MMM yyyy")}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Badge variant={investment.status === 'active' ? 'default' : 'secondary'}>
            {investment.status}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
          {/* Current Value */}
          <div>
            <p className="text-xs text-muted-foreground">Current Value</p>
            <p className="text-base sm:text-xl font-bold">
              £{metrics.currentValue.toLocaleString("en-GB", { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })}
            </p>
            {metrics.isLive && metrics.totalUnits > 0 && (
              <p className="text-xs text-muted-foreground">
                {metrics.totalUnits.toFixed(4)} units @ £{metrics.unitPrice.toFixed(2)}
              </p>
            )}
          </div>

          {/* Total Invested */}
          <div>
            <p className="text-xs text-muted-foreground">Total Invested</p>
            <p className="text-base sm:text-xl font-bold">
              £{metrics.totalContributions.toLocaleString("en-GB", { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })}
            </p>
          </div>

          {/* Total Return */}
          <div>
            <p className="text-xs text-muted-foreground">Total Return</p>
            <div className="flex items-center gap-1">
              {isPositive ? (
                <TrendingUp className="h-4 w-4 text-success flex-shrink-0" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive flex-shrink-0" />
              )}
              <p className={cn(
                "text-base sm:text-xl font-bold",
                isPositive ? "text-success" : "text-destructive"
              )}>
                {isPositive ? "+" : "-"}£{Math.abs(metrics.totalReturn).toLocaleString("en-GB", { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </p>
            </div>
            <p className={cn(
              "text-xs",
              isPositive ? "text-success" : "text-destructive"
            )}>
              {isPositive ? "+" : ""}{metrics.returnPercentage.toFixed(2)}%
            </p>
          </div>

          {/* Daily Change */}
          <div>
            <p className="text-xs text-muted-foreground">Daily Change</p>
            <div className="flex items-center gap-1">
              {isDailyPositive ? (
                <TrendingUp className="h-4 w-4 text-success flex-shrink-0" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive flex-shrink-0" />
              )}
              <p className={cn(
                "text-base sm:text-xl font-bold",
                isDailyPositive ? "text-success" : "text-destructive"
              )}>
                {isDailyPositive ? "+" : "-"}£{Math.abs(metrics.dailyChange.amount).toLocaleString("en-GB", { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </p>
            </div>
            <p className={cn("text-xs", isDailyPositive ? "text-success" : "text-destructive")}>
              {isDailyPositive ? "+" : ""}{metrics.dailyChange.percentage.toFixed(3)}%
            </p>
          </div>
        </div>

        {/* Expected Return Badge */}
        <div className="mt-4 pt-3 border-t flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Expected annual return</span>
          <Badge variant="outline" className="gap-1">
            <Percent className="h-3 w-3" />
            {investment.expected_annual_return}%
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
