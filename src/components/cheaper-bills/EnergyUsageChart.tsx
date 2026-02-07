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

export function EnergyUsageChart({ readings, days = 30 }: EnergyUsageChartProps) {
  const chartData = useMemo(() => {
    // Create a map of readings by date
    const readingsByDate = new Map<string, { electricity: number; gas: number }>();

    readings.forEach((r) => {
      const existing = readingsByDate.get(r.reading_date) || { electricity: 0, gas: 0 };
      if (r.fuel_type === "electricity") {
        existing.electricity = Number(r.consumption_kwh);
      } else if (r.fuel_type === "gas") {
        existing.gas = Number(r.consumption_kwh);
      }
      readingsByDate.set(r.reading_date, existing);
    });

    // Fill in missing dates
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = format(subDays(new Date(), i), "yyyy-MM-dd");
      const reading = readingsByDate.get(date) || { electricity: 0, gas: 0 };
      data.push({
        date,
        electricity: reading.electricity,
        gas: reading.gas,
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

  // Calculate totals
  const totalElectricity = chartData.reduce((sum, d) => sum + d.electricity, 0);
  const totalGas = chartData.reduce((sum, d) => sum + d.gas, 0);

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
      </CardContent>
    </Card>
  );
}
