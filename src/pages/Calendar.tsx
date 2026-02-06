import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

export default function Calendar() {
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Monthly Calendar</h1>
          <p className="text-muted-foreground">
            View your bills and expenses in calendar format
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Calendar view coming soon</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              The monthly calendar view will show your bills and predicted outgoings.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
