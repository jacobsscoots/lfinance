import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus, MoreVertical, Lock, Unlock, ExternalLink, XCircle, Utensils } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MealPlan, MealType, MealStatus, useMealPlanItems } from "@/hooks/useMealPlanItems";
import { Product } from "@/hooks/useProducts";
import { NutritionSettings } from "@/hooks/useNutritionSettings";
import { DayMacros, MealMacros } from "@/lib/mealCalculations";
import { MealItemDialog } from "./MealItemDialog";
import { EatingOutDialog } from "./EatingOutDialog";
import { cn } from "@/lib/utils";

interface MealDayCardProps {
  plan: MealPlan;
  dayMacros: DayMacros;
  products: Product[];
  settings: NutritionSettings | null | undefined;
  weekStart: Date;
}

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

const STATUS_ICONS: Record<MealStatus, React.ReactNode> = {
  planned: null,
  skipped: <XCircle className="h-3 w-3 text-muted-foreground" />,
  eating_out: <ExternalLink className="h-3 w-3 text-primary" />,
};

export function MealDayCard({ plan, dayMacros, products, settings, weekStart }: MealDayCardProps) {
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [eatingOutOpen, setEatingOutOpen] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>("breakfast");
  
  const { updateMealStatus, removeItem, updateItem } = useMealPlanItems(weekStart);
  
  const date = parseISO(plan.meal_date);
  const isToday = format(new Date(), "yyyy-MM-dd") === plan.meal_date;
  const items = plan.items || [];

  const getMealStatus = (mealType: MealType): MealStatus => {
    switch (mealType) {
      case "breakfast": return plan.breakfast_status as MealStatus;
      case "lunch": return plan.lunch_status as MealStatus;
      case "dinner": return plan.dinner_status as MealStatus;
      case "snack": return plan.snack_status as MealStatus;
    }
  };

  const getMealMacros = (mealType: MealType): MealMacros | undefined => {
    return dayMacros.meals.find(m => m.mealType === mealType);
  };

  const handleAddItem = (mealType: MealType) => {
    setSelectedMealType(mealType);
    setAddItemOpen(true);
  };

  const handleSetStatus = (mealType: MealType, status: MealStatus) => {
    if (status === "eating_out") {
      setSelectedMealType(mealType);
      setEatingOutOpen(true);
    } else {
      updateMealStatus.mutate({ planId: plan.id, mealType, status });
    }
  };

  const handleEatingOutConfirm = (calories: number) => {
    updateMealStatus.mutate({
      planId: plan.id,
      mealType: selectedMealType,
      status: "eating_out",
      eatingOutCalories: calories,
    });
    setEatingOutOpen(false);
  };

  const toggleLock = (itemId: string, currentlyLocked: boolean) => {
    updateItem.mutate({ id: itemId, is_locked: !currentlyLocked });
  };

  return (
    <>
      <Card className={cn(
        "flex flex-col",
        isToday && "ring-2 ring-primary"
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <div>
              <div className="font-semibold">{format(date, "EEEE")}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {format(date, "d MMM")}
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>{Math.round(dayMacros.totals.calories)} kcal</div>
              <div>P: {Math.round(dayMacros.totals.protein)}g</div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 pt-0">
          {(["breakfast", "lunch", "dinner", "snack"] as MealType[]).map(mealType => {
            const status = getMealStatus(mealType);
            const mealMacros = getMealMacros(mealType);
            const mealItems = items.filter(i => i.meal_type === mealType);
            
            return (
              <div key={mealType} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {STATUS_ICONS[status]}
                    {MEAL_LABELS[mealType]}
                    {mealMacros && status !== "skipped" && (
                      <span className="text-foreground">
                        ({Math.round(mealMacros.calories)} kcal)
                      </span>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleAddItem(mealType)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleSetStatus(mealType, "planned")}
                        disabled={status === "planned"}
                      >
                        <Utensils className="h-4 w-4 mr-2" />
                        Mark as Planned
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleSetStatus(mealType, "skipped")}
                        disabled={status === "skipped"}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Skip Meal
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleSetStatus(mealType, "eating_out")}
                        disabled={status === "eating_out"}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Eating Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {status === "skipped" ? (
                  <div className="text-xs text-muted-foreground italic py-1">Skipped</div>
                ) : status === "eating_out" ? (
                  <div className="text-xs text-primary py-1">
                    Eating out ({Math.round(mealMacros?.calories || 0)} kcal est.)
                  </div>
                ) : mealItems.length === 0 ? (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full h-7 text-xs text-muted-foreground"
                    onClick={() => handleAddItem(mealType)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add food
                  </Button>
                ) : (
                  <div className="space-y-1">
                    {mealItems.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1"
                      >
                        <div className="flex items-center gap-1 truncate">
                          {item.is_locked && <Lock className="h-3 w-3 text-primary" />}
                          {item.product?.product_type === "fixed" && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">Fixed</Badge>
                          )}
                          <span className="truncate">{item.product?.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">{item.quantity_grams}g</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-5 w-5">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => toggleLock(item.id, item.is_locked)}>
                                {item.is_locked ? (
                                  <>
                                    <Unlock className="h-4 w-4 mr-2" />
                                    Unlock
                                  </>
                                ) : (
                                  <>
                                    <Lock className="h-4 w-4 mr-2" />
                                    Lock Quantity
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => removeItem.mutate(item.id)}
                              >
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <MealItemDialog
        open={addItemOpen}
        onOpenChange={setAddItemOpen}
        planId={plan.id}
        mealType={selectedMealType}
        products={products}
        weekStart={weekStart}
      />

      <EatingOutDialog
        open={eatingOutOpen}
        onOpenChange={setEatingOutOpen}
        onConfirm={handleEatingOutConfirm}
      />
    </>
  );
}
