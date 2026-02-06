import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownLeft, ArrowUpRight, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export function MonthSummaryCard() {
  const currentMonth = format(new Date(), "MMMM yyyy");
  
  // Placeholder data - will be connected to actual data later
  const income = 2500;
  const outgoings = 1850;
  const net = income - outgoings;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-primary/5 border-b">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          {currentMonth} Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Income */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
                <ArrowDownLeft className="h-4 w-4 text-success" />
              </div>
              <span className="text-sm text-muted-foreground">Income</span>
            </div>
            <span className="font-semibold text-success">
              £{income.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Outgoings */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4 text-destructive" />
              </div>
              <span className="text-sm text-muted-foreground">Outgoings</span>
            </div>
            <span className="font-semibold text-destructive">
              -£{outgoings.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Net position */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Net position</span>
              <span className={`text-lg font-bold ${net >= 0 ? "text-success" : "text-destructive"}`}>
                {net >= 0 ? "+" : "-"}£{Math.abs(net).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
