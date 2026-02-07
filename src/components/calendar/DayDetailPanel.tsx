import { CalendarBill } from "@/hooks/useCalendarData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Receipt, Check, AlertCircle, Clock, SkipForward, RotateCcw, Link2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

interface DayDetailPanelProps {
  date: Date;
  bills: CalendarBill[];
  onMarkPaid?: (billId: string, dueDate: Date) => void;
  onSkip?: (billId: string, dueDate: Date) => void;
  onReset?: (billId: string, dueDate: Date) => void;
}

export function DayDetailPanel({ date, bills, onMarkPaid, onSkip, onReset }: DayDetailPanelProps) {
  const totalAmount = bills.reduce((sum, b) => sum + b.amount, 0);
  const paidCount = bills.filter((b) => b.isPaid).length;
  const skippedCount = bills.filter((b) => b.status === "skipped").length;

  const getStatusIcon = (bill: CalendarBill) => {
    if (bill.isPaid) {
      return <Check className="h-4 w-4 text-success" />;
    }
    if (bill.status === "skipped") {
      return <SkipForward className="h-4 w-4 text-muted-foreground" />;
    }
    if (bill.status === "overdue") {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    return <Clock className="h-4 w-4 text-warning" />;
  };

  const getStatusText = (bill: CalendarBill) => {
    if (bill.isPaid) return "Paid";
    if (bill.status === "skipped") return "Skipped";
    if (bill.status === "overdue") return "Overdue";
    return "Due";
  };

  const getStatusClass = (bill: CalendarBill) => {
    if (bill.isPaid) return "text-success";
    if (bill.status === "skipped") return "text-muted-foreground";
    if (bill.status === "overdue") return "text-destructive";
    return "text-warning";
  };

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
                  {skippedCount > 0 && ` • ${skippedCount} skipped`}
                </p>
              </div>
            </div>

            {/* Bills list */}
            <div className="space-y-2">
              {bills.map((bill) => (
                <div
                  key={`${bill.id}-${format(bill.dueDate, "yyyy-MM-dd")}`}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        bill.isPaid 
                          ? "bg-success/10" 
                          : bill.status === "skipped"
                          ? "bg-muted"
                          : bill.status === "overdue"
                          ? "bg-destructive/10"
                          : "bg-warning/10"
                      }`}
                    >
                      {getStatusIcon(bill)}
                    </div>
                    <div>
                      <p className={`font-medium text-sm ${bill.status === "skipped" ? "line-through text-muted-foreground" : ""}`}>
                        {bill.name}
                      </p>
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
                        {bill.matchConfidence && (
                          <Badge variant="secondary" className="text-xs py-0 gap-1">
                            <Link2 className="h-2.5 w-2.5" />
                            {bill.matchConfidence}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="font-semibold">£{bill.amount.toFixed(2)}</p>
                      <p className={`text-xs ${getStatusClass(bill)}`}>
                        {getStatusText(bill)}
                      </p>
                    </div>
                    {(onMarkPaid || onSkip || onReset) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!bill.isPaid && bill.status !== "skipped" && onMarkPaid && (
                            <DropdownMenuItem onClick={() => onMarkPaid(bill.id, bill.dueDate)}>
                              <Check className="h-4 w-4 mr-2" />
                              Mark as Paid
                            </DropdownMenuItem>
                          )}
                          {!bill.isPaid && bill.status !== "skipped" && onSkip && (
                            <DropdownMenuItem onClick={() => onSkip(bill.id, bill.dueDate)}>
                              <SkipForward className="h-4 w-4 mr-2" />
                              Skip This Month
                            </DropdownMenuItem>
                          )}
                          {(bill.isPaid || bill.status === "skipped") && onReset && (
                            <DropdownMenuItem onClick={() => onReset(bill.id, bill.dueDate)}>
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Reset to Due
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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
