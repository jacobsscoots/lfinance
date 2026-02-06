import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

export default function Groceries() {
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Grocery Budget</h1>
          <p className="text-muted-foreground">
            Track your weekly grocery spending
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No grocery cycles yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Set your weekly budget and start tracking your grocery spending.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
