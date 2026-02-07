import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/dashboardCalculations";

interface CycleData {
  cycleStart: Date;
  cycleEnd: Date;
  label: string;
  income: number;
  expenses: number;
  net: number;
  hasData: boolean;
}

interface NetTrendChartProps {
  data: CycleData[] | undefined;
  isLoading?: boolean;
}

export function NetTrendChart({ data, isLoading }: NetTrendChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  const hasEnoughData = data && data.filter(d => d.hasData).length >= 2;
  
  if (!hasEnoughData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Net Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-center">
            <div>
              <p className="text-sm text-muted-foreground">Building history...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Need {2 - (data?.filter(d => d.hasData).length || 0)} more pay cycle{(data?.filter(d => d.hasData).length || 0) < 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const chartData = data.filter(d => d.hasData).map(d => ({
    ...d,
    displayNet: d.net,
  }));
  
  // Calculate trend (simple linear)
  const isImproving = chartData.length >= 2 && 
    chartData[chartData.length - 1].net > chartData[0].net;
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className={`h-4 w-4 ${isImproving ? "text-emerald-500" : "text-red-500"}`} />
          Net Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="label" 
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
                formatter={(value: number) => [formatCurrency(value), "Net"]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="net"
                stroke={isImproving ? "hsl(142 76% 36%)" : "hsl(var(--destructive))"}
                strokeWidth={2}
                dot={{ r: 4, fill: isImproving ? "hsl(142 76% 36%)" : "hsl(var(--destructive))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
