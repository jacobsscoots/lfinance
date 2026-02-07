import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import { formatCurrency, type DailySpending } from "@/lib/dashboardCalculations";
import { cn } from "@/lib/utils";

interface SpendPaceChartProps {
  data: DailySpending[];
  isOverPace: boolean;
  isLoading?: boolean;
}

export function SpendPaceChart({ data, isOverPace, isLoading }: SpendPaceChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  // Only show data up to today (where cumulative > 0 or is first point)
  const chartData = data.map((d, i) => ({
    ...d,
    day: i + 1,
    displayDate: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  }));
  
  // Find today's position
  const todayIndex = chartData.findIndex(d => d.cumulative > 0 && chartData[chartData.length - 1].cumulative === d.cumulative) || chartData.length - 1;
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {isOverPace ? (
            <TrendingUp className="h-4 w-4 text-red-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-emerald-500" />
          )}
          Spend Pace
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                tickFormatter={(v) => `£${v}`}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name === "cumulative" ? "Actual Spend" : "Expected Pace"
                ]}
                labelFormatter={(label) => `Day ${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              {/* Expected pace line */}
              <Line
                type="monotone"
                dataKey="expectedCumulative"
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="5 5"
                strokeWidth={2}
                dot={false}
                name="expected"
              />
              {/* Actual spend line */}
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke={isOverPace ? "hsl(var(--destructive))" : "hsl(142 76% 36%)"}
                strokeWidth={2}
                dot={false}
                name="cumulative"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className={cn(
              "w-3 h-0.5",
              isOverPace ? "bg-destructive" : "bg-emerald-500"
            )} />
            <span>Actual</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 border-t-2 border-dashed border-muted-foreground" />
            <span>Expected</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
