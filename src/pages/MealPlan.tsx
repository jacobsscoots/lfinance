import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { UtensilsCrossed } from "lucide-react";

export default function MealPlan() {
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Weekly Meal Plan</h1>
          <p className="text-muted-foreground">
            Plan your meals for the week ahead
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UtensilsCrossed className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No meal plans yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Create a weekly meal plan to help with your grocery shopping.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
