import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export default function Bills() {
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bills & Subscriptions</h1>
          <p className="text-muted-foreground">
            Track your recurring payments and subscriptions
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No bills added yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Add your recurring bills and subscriptions to keep track of your monthly commitments.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
