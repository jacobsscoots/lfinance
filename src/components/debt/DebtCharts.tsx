import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Debt } from "@/hooks/useDebts";
import { DebtPayment } from "@/hooks/useDebtPayments";
import { DebtBalanceSnapshot } from "@/hooks/useDebtSnapshots";
import { getPaymentsByMonth } from "@/lib/debtCalculations";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { format, subMonths, parseISO, isAfter } from "date-fns";

interface DebtChartsProps {
  debts: Debt[];
  payments: DebtPayment[];
  snapshots: DebtBalanceSnapshot[];
}

type DateRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

export function DebtCharts({ debts, payments, snapshots }: DebtChartsProps) {
  const [dateRange, setDateRange] = useState<DateRange>('6M');

  const getStartDate = () => {
    const today = new Date();
    switch (dateRange) {
      case '1M': return subMonths(today, 1);
      case '3M': return subMonths(today, 3);
      case '6M': return subMonths(today, 6);
      case '1Y': return subMonths(today, 12);
      case 'ALL': return null;
    }
  };

  const startDate = getStartDate();

  // Filter payments by date range
  const filteredPayments = payments.filter(p => {
    if (!startDate) return true;
    return isAfter(parseISO(p.payment_date), startDate);
  });

  // Get payments by month for bar chart
  const paymentsByMonth = getPaymentsByMonth(filteredPayments);
  const paymentsChartData = Array.from(paymentsByMonth.entries())
    .map(([month, amount]) => ({
      month: format(parseISO(month + '-01'), 'MMM'),
      amount: Math.round(amount),
    }))
    .slice(-12);

  // Calculate total balance over time (simplified)
  const balanceChartData: { month: string; balance: number }[] = [];
  const openDebts = debts.filter(d => d.status === 'open');
  
  // Use current balance as endpoint and work backwards with payments
  let runningBalance = openDebts.reduce((sum, d) => sum + Number(d.current_balance), 0);
  const months = Array.from(paymentsByMonth.keys()).sort().reverse();
  
  // Start with current month
  const currentMonth = format(new Date(), 'yyyy-MM');
  balanceChartData.unshift({
    month: format(new Date(), 'MMM'),
    balance: Math.round(runningBalance),
  });
  
  // Add previous months by adding back payments
  for (const month of months) {
    if (month >= currentMonth) continue;
    runningBalance += paymentsByMonth.get(month) || 0;
    balanceChartData.unshift({
      month: format(parseISO(month + '-01'), 'MMM'),
      balance: Math.round(runningBalance),
    });
  }

  // Interest vs Principal chart data (if split data exists)
  const interestPrincipalData = Array.from(paymentsByMonth.keys())
    .sort()
    .slice(-12)
    .map(month => {
      const monthPayments = filteredPayments.filter(p => 
        p.payment_date.startsWith(month) && p.category !== 'fee'
      );
      
      const principal = monthPayments.reduce((sum, p) => 
        sum + (Number(p.principal_amount) || 0), 0
      );
      const interest = monthPayments.reduce((sum, p) => 
        sum + (Number(p.interest_amount) || 0), 0
      );
      const total = monthPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      
      // If no split data, estimate based on APR (rough)
      const hasData = principal > 0 || interest > 0;
      
      return {
        month: format(parseISO(month + '-01'), 'MMM'),
        principal: Math.round(hasData ? principal : total * 0.7),
        interest: Math.round(hasData ? interest : total * 0.3),
        hasSplitData: hasData,
      };
    });

  const formatCurrency = (value: number) => `£${value.toLocaleString()}`;

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="flex gap-1 flex-wrap">
        {(['1M', '3M', '6M', '1Y', 'ALL'] as DateRange[]).map(range => (
          <Button
            key={range}
            variant={dateRange === range ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange(range)}
          >
            {range}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Total Balance Over Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Balance Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={balanceChartData}>
                  <defs>
                    <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={formatCurrency}
                    tickLine={false}
                    axisLine={false}
                    width={70}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Balance']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="hsl(var(--primary))" 
                    fill="url(#balanceGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payments Per Month */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Payments Per Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentsChartData}>
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={formatCurrency}
                    tickLine={false}
                    axisLine={false}
                    width={70}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Paid']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar 
                    dataKey="amount" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Interest vs Principal */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Interest vs Principal
              {interestPrincipalData.some(d => !d.hasSplitData) && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  (estimated where split data unavailable)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={interestPrincipalData}>
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={formatCurrency}
                    tickLine={false}
                    axisLine={false}
                    width={70}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      formatCurrency(value), 
                      name === 'principal' ? 'Principal' : 'Interest'
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="principal" 
                    stackId="a" 
                    fill="hsl(var(--primary))" 
                    name="Principal"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar 
                    dataKey="interest" 
                    stackId="a" 
                    fill="hsl(var(--destructive))" 
                    name="Interest"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
