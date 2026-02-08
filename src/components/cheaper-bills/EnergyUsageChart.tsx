import { useMemo } from "react";
import { format, subDays } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { EnergyReading } from "@/hooks/useEnergyReadings";

interface EnergyUsageChartProps {
  readings: EnergyReading[];
  days?: number;
}

function getSourceBreakdown(readings: EnergyReading[]) {
  const smartMeter = readings.filter((r) => r.source === "bright").length;
  const manual = readings.filter((r) => r.source === "manual" || !r.source).length;
  return { smartMeter, manual };
}

export function EnergyUsageChart({ readings, days = 30 }: EnergyUsageChartProps) {
  const chartData = useMemo(() => {
    // Sort readings by date ascending to calculate consumption differences
    const sortedReadings = [...readings].sort(
      (a, b) => new Date(a.reading_date).getTime() - new Date(b.reading_date).getTime()
    );

    // Check if readings look like cumulative meter readings (values > 1000)
    const isCumulative = sortedReadings.some((r) => Number(r.consumption_kwh) > 1000);

    // Create a map of daily consumption by date
    const consumptionByDate = new Map<string, { electricity: number; gas: number }>();

    if (isCumulative && sortedReadings.length > 1) {
      // Calculate consumption as difference between consecutive readings
      for (let i = 1; i < sortedReadings.length; i++) {
        const prev = sortedReadings[i - 1];
        const curr = sortedReadings[i];
        
        if (prev.fuel_type === curr.fuel_type) {
          const consumption = Number(curr.consumption_kwh) - Number(prev.consumption_kwh);
          if (consumption >= 0) {
            const existing = consumptionByDate.get(curr.reading_date) || { electricity: 0, gas: 0 };
            if (curr.fuel_type === "electricity") {
              existing.electricity = consumption;
            } else if (curr.fuel_type === "gas") {
              existing.gas = consumption;
            }
            consumptionByDate.set(curr.reading_date, existing);
          }
        }
      }
    } else {
      // Use values as-is (already consumption values)
      readings.forEach((r) => {
        const existing = consumptionByDate.get(r.reading_date) || { electricity: 0, gas: 0 };
        if (r.fuel_type === "electricity") {
          existing.electricity = Number(r.consumption_kwh);
        } else if (r.fuel_type === "gas") {
          existing.gas = Number(r.consumption_kwh);
        }
        consumptionByDate.set(r.reading_date, existing);
      });
    }

    // Fill in the date range
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = format(subDays(new Date(), i), "yyyy-MM-dd");
      const consumption = consumptionByDate.get(date) || { electricity: 0, gas: 0 };
      data.push({
        date,
        electricity: consumption.electricity,
        gas: consumption.gas,
      });
    }

    return data;
  }, [readings, days]);

  const chartConfig = {
    electricity: {
      label: "Electricity",
      color: "hsl(var(--chart-1))",
    },
    gas: {
      label: "Gas",
      color: "hsl(var(--chart-2))",
    },
  };

  // Calculate totals and source breakdown
  const totalElectricity = chartData.reduce((sum, d) => sum + d.electricity, 0);
  const totalGas = chartData.reduce((sum, d) => sum + d.gas, 0);
  const sourceBreakdown = getSourceBreakdown(readings);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Usage (Last {days} Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[150px] sm:h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => format(new Date(date), "d")}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                className="text-muted-foreground"
              />
              <YAxis
                tickFormatter={(value) => `${value}`}
                tick={{ fontSize: 10 }}
                width={40}
                className="text-muted-foreground"
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(date) => format(new Date(date), "d MMM yyyy")}
                    formatter={(value, name) => [`${value} kWh`, name]}
                  />
                }
              />
              <Legend />
              <Bar dataKey="electricity" fill="var(--color-electricity)" name="Electricity" />
              <Bar dataKey="gas" fill="var(--color-gas)" name="Gas" />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        <div className="flex flex-col sm:flex-row justify-between gap-2 mt-4 pt-4 border-t text-xs sm:text-sm">
          <div>
            <span className="text-muted-foreground">Electricity:</span>{" "}
            <span className="font-medium">{totalElectricity.toFixed(1)} kWh</span>
          </div>
          <div>
            <span className="text-muted-foreground">Gas:</span>{" "}
            <span className="font-medium">{totalGas.toFixed(1)} kWh</span>
          </div>
        </div>

        {(sourceBreakdown.smartMeter > 0 || sourceBreakdown.manual > 0) && (
          <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
            {sourceBreakdown.smartMeter > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {sourceBreakdown.smartMeter} smart meter
              </span>
            )}
            {sourceBreakdown.manual > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary-foreground/50" />
                {sourceBreakdown.manual} manual
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
