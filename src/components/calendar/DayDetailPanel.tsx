import { CalendarBill } from "@/hooks/useCalendarData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Receipt, Check, AlertCircle } from "lucide-react";

interface DayDetailPanelProps {
  date: Date;
  bills: CalendarBill[];
}

export function DayDetailPanel({ date, bills }: DayDetailPanelProps) {
  const totalAmount = bills.reduce((sum, b) => sum + b.amount, 0);
  const paidCount = bills.filter((b) => b.isPaid).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">
          {format(date, "EEEE, d MMMM yyyy")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {bills.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No bills due on this day</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Total Due</p>
                <p className="text-xl font-bold">£{totalAmount.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-sm font-medium">
                  {paidCount}/{bills.length} paid
                </p>
              </div>
            </div>

            {/* Bills list */}
            <div className="space-y-2">
              {bills.map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        bill.isPaid ? "bg-success/10" : "bg-destructive/10"
                      }`}
                    >
                      {bill.isPaid ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{bill.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground capitalize">
                          {bill.frequency}
                        </span>
                        {bill.categoryName && (
                          <Badge
                            variant="outline"
                            className="text-xs py-0"
                            style={{ borderColor: bill.categoryColor || undefined }}
                          >
                            {bill.categoryName}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">£{bill.amount.toFixed(2)}</p>
                    <p
                      className={`text-xs ${
                        bill.isPaid ? "text-success" : "text-destructive"
                      }`}
                    >
                      {bill.isPaid ? "Paid" : "Pending"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
