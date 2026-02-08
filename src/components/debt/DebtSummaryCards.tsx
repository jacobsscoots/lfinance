import { Card, CardContent } from "@/components/ui/card";
import { Debt } from "@/hooks/useDebts";
import { DebtPayment } from "@/hooks/useDebtPayments";
import { calculateDebtSummary } from "@/lib/debtCalculations";
import { format, differenceInDays } from "date-fns";
import { Wallet, CalendarClock, TrendingDown, Target, Banknote } from "lucide-react";

interface DebtSummaryCardsProps {
  debts: Debt[];
  payments: DebtPayment[];
  monthlyBudget: number | null;
}

export function DebtSummaryCards({ debts, payments, monthlyBudget }: DebtSummaryCardsProps) {
  const summary = calculateDebtSummary(debts, payments, monthlyBudget);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyDecimal = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  const getDaysUntilDue = () => {
    if (!summary.nextDueDate) return null;
    return differenceInDays(summary.nextDueDate, new Date());
  };

  const daysUntilDue = getDaysUntilDue();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {/* Total Balance */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Balance</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(summary.totalBalance)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.overallProgress.toFixed(1)}% paid off
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Min Payments */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Min Payments</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(summary.totalMinPayments)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                per month
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Banknote className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Due */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Next Due</p>
              <p className="text-2xl font-bold text-foreground">
                {daysUntilDue !== null ? (
                  daysUntilDue === 0 ? 'Today' :
                  daysUntilDue === 1 ? '1 day' :
                  `${daysUntilDue} days`
                ) : 'N/A'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.nextDueDebt?.creditor_name || 'No upcoming payments'}
              </p>
            </div>
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              daysUntilDue !== null && daysUntilDue <= 3 
                ? 'bg-amber-500/10' 
                : 'bg-green-500/10'
            }`}>
              <CalendarClock className={`h-5 w-5 ${
                daysUntilDue !== null && daysUntilDue <= 3 
                  ? 'text-amber-500' 
                  : 'text-green-500'
              }`} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Interest */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Est. Interest</p>
              <p className="text-2xl font-bold text-foreground">
                ~{formatCurrencyDecimal(summary.estimatedMonthlyInterest)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                this month
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-red-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debt-Free Date */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Debt-Free</p>
              <p className="text-2xl font-bold text-foreground">
                {summary.estimatedDebtFreeDate 
                  ? format(summary.estimatedDebtFreeDate, 'MMM yyyy')
                  : 'N/A'
                }
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {monthlyBudget ? `at £${monthlyBudget}/mo` : 'based on avg payments'}
              </p>
            </div>
            <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-purple-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
