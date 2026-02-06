import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, AlertCircle } from "lucide-react";
import { format, addDays } from "date-fns";

// Placeholder data - will be connected to actual bills data later
const upcomingBills = [
  { id: 1, name: "Netflix", amount: 15.99, dueDate: addDays(new Date(), 2), category: "Entertainment" },
  { id: 2, name: "Spotify", amount: 10.99, dueDate: addDays(new Date(), 3), category: "Entertainment" },
  { id: 3, name: "Phone Bill", amount: 35.00, dueDate: addDays(new Date(), 5), category: "Utilities" },
  { id: 4, name: "Internet", amount: 45.00, dueDate: addDays(new Date(), 7), category: "Utilities" },
];

export function UpcomingBillsCard() {
  const totalUpcoming = upcomingBills.reduce((sum, bill) => sum + bill.amount, 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-primary/5 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-primary" />
            Upcoming Bills
          </CardTitle>
          <span className="text-sm text-muted-foreground">Next 7 days</span>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {upcomingBills.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No bills due in the next 7 days</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingBills.map((bill) => (
              <div 
                key={bill.id} 
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div>
                  <p className="font-medium text-sm">{bill.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(bill.dueDate, "EEE, d MMM")} • {bill.category}
                  </p>
                </div>
                <span className="font-semibold">
                  £{bill.amount.toFixed(2)}
                </span>
              </div>
            ))}

            {/* Total */}
            <div className="pt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium">Total due</span>
              </div>
              <span className="text-lg font-bold">
                £{totalUpcoming.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
