import { AppLayout } from "@/components/layout/AppLayout";
import { WeeklyMealPlanner } from "@/components/mealplan/WeeklyMealPlanner";

const BUILD_SHA = "mp-20260212a";

export default function MealPlan() {
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Weekly Meal Plan</h1>
            <p className="text-muted-foreground">
              Plan your meals for the week ahead
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground/50 font-mono">Build: {BUILD_SHA}</span>
        </div>

        <WeeklyMealPlanner />
      </div>
    </AppLayout>
  );
}
