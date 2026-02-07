import { useMemo, useState } from "react";
import { format, subDays, subMonths, subWeeks, subYears } from "date-fns";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { calculateDailyValues, generateProjectionData } from "@/lib/investmentCalculations";
import { InvestmentTransaction } from "@/hooks/useInvestmentTransactions";
import { InvestmentValuation } from "@/hooks/useInvestmentValuations";

type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";

interface InvestmentPerformanceChartProps {
  transactions: InvestmentTransaction[];
  valuations: InvestmentValuation[];
  startDate: string;
  expectedAnnualReturn: number;
  showProjections?: boolean;
}

export function InvestmentPerformanceChart({
  transactions,
  valuations,
  startDate,
  expectedAnnualReturn,
  showProjections = true,
}: InvestmentPerformanceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("3M");

  const chartData = useMemo(() => {
    const today = new Date();
    const start = new Date(startDate);
    
    // Determine date range based on selection
    let rangeStart: Date;
    switch (timeRange) {
      case "1W":
        rangeStart = subWeeks(today, 1);
        break;
      case "1M":
        rangeStart = subMonths(today, 1);
        break;
      case "3M":
        rangeStart = subMonths(today, 3);
        break;
      case "6M":
        rangeStart = subMonths(today, 6);
        break;
      case "1Y":
        rangeStart = subYears(today, 1);
        break;
      case "ALL":
      default:
        rangeStart = start;
    }

    // Ensure we don't go before the start date
    if (rangeStart < start) {
      rangeStart = start;
    }

    // Calculate historical values
    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      transaction_date: tx.transaction_date,
      type: tx.type as 'deposit' | 'withdrawal' | 'fee' | 'dividend',
      amount: tx.amount,
    }));

    const formattedValuations = valuations.map(v => ({
      valuation_date: v.valuation_date,
      value: v.value,
      source: v.source as 'manual' | 'estimated' | 'live',
    }));

    const historicalValues = calculateDailyValues(
      formattedTransactions,
      formattedValuations,
      rangeStart,
      today,
      expectedAnnualReturn
    );

    // Generate future projections if enabled
    let projectionData: { date: string; projected: number }[] = [];
    if (showProjections && historicalValues.length > 0) {
      const lastValue = historicalValues[historicalValues.length - 1];
      
      // Calculate average monthly contribution
      const totalMonths = Math.max(1, Math.floor(
        (today.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
      ));
      const monthlyContribution = lastValue.contributions / totalMonths;
      
      // Generate 6 months of projections
      const projections = generateProjectionData(
        lastValue.value,
        monthlyContribution,
        expectedAnnualReturn,
        6
      );
      
      projectionData = projections.slice(1).map(p => ({
        date: p.date,
        projected: p.value,
      }));
    }

    // Combine historical and projection data
    const combined = historicalValues.map(hv => ({
      date: hv.date,
      value: hv.value,
      contributions: hv.contributions,
      isManual: hv.source === 'manual',
    }));

    // Add projections
    projectionData.forEach(pd => {
      combined.push({
        date: pd.date,
        value: undefined as any,
        contributions: undefined as any,
        isManual: false,
        projected: pd.projected,
      } as any);
    });

    return combined;
  }, [transactions, valuations, startDate, expectedAnnualReturn, timeRange, showProjections]);

  // Only show every nth label to avoid clutter
  const tickInterval = useMemo(() => {
    if (chartData.length < 10) return 0;
    if (chartData.length < 30) return 2;
    if (chartData.length < 90) return 6;
    return 14;
  }, [chartData.length]);

  const chartConfig = {
    value: {
      label: "Value",
      color: "hsl(var(--chart-1))",
    },
    contributions: {
      label: "Contributions",
      color: "hsl(var(--chart-2))",
    },
    projected: {
      label: "Projected",
      color: "hsl(var(--chart-3))",
    },
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">Performance</CardTitle>
        <div className="flex gap-1">
          {(["1W", "1M", "3M", "6M", "1Y", "ALL"] as TimeRange[]).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "default" : "ghost"}
              size="sm"
              onClick={() => setTimeRange(range)}
              className="h-7 px-2 text-xs"
            >
              {range}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => format(new Date(date), "d MMM")}
                interval={tickInterval}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis
                tickFormatter={(value) => `£${(value / 1000).toFixed(1)}k`}
                tick={{ fontSize: 12 }}
                width={60}
                className="text-muted-foreground"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(date) => format(new Date(date), "d MMM yyyy")}
                    formatter={(value, name) => {
                      if (typeof value !== 'number') return null;
                      return [
                        `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                        name === "value" ? "Value" : name === "contributions" ? "Contributed" : "Projected"
                      ];
                    }}
                  />
                }
              />
              <Legend />
              
              {/* Contributions line */}
              <Line
                type="monotone"
                dataKey="contributions"
                stroke="var(--color-contributions)"
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 5"
                name="Contributed"
              />
              
              {/* Actual value line */}
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-value)"
                strokeWidth={2}
                dot={false}
                name="Value"
              />
              
              {/* Projected line */}
              {showProjections && (
                <Line
                  type="monotone"
                  dataKey="projected"
                  stroke="var(--color-projected)"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={false}
                  name="Projected"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>

        <div className="flex justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-[var(--color-value)]" />
            <span className="text-muted-foreground">Actual Value</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-[var(--color-contributions)] border-dashed border-b-2 border-[var(--color-contributions)]" style={{ borderStyle: 'dashed' }} />
            <span className="text-muted-foreground">Contributions</span>
          </div>
          {showProjections && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 border-dashed border-b-2 border-[var(--color-projected)]" style={{ borderStyle: 'dashed' }} />
              <span className="text-muted-foreground">Projected</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
