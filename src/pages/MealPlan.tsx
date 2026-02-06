import { AppLayout } from "@/components/layout/AppLayout";
import { WeeklyMealPlanner } from "@/components/mealplan/WeeklyMealPlanner";

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

        <WeeklyMealPlanner />
      </div>
    </AppLayout>
  );
}
