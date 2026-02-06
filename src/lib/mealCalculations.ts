import { Product } from "@/hooks/useProducts";
import { MealPlan, MealPlanItem, MealType, MealStatus } from "@/hooks/useMealPlanItems";
import { NutritionSettings } from "@/hooks/useNutritionSettings";

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealMacros extends MacroTotals {
  mealType: MealType;
  status: MealStatus;
}

export interface DayMacros {
  date: string;
  meals: MealMacros[];
  totals: MacroTotals;
  targetDiff?: MacroTotals;
}

export interface GroceryItem {
  product: Product;
  requiredGrams: number;
  purchaseQuantity: number;
  purchaseUnits: string;
  totalCost: number;
}

export interface BalanceWarning {
  type: "low_calories" | "macro_skewed" | "target_unachievable" | "over_restriction";
  message: string;
  mealType?: MealType;
  date?: string;
}

// Calculate macros for a single item
export function calculateItemMacros(item: MealPlanItem): MacroTotals {
  const product = item.product;
  if (!product || product.ignore_macros) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  const multiplier = item.quantity_grams / 100;
  return {
    calories: product.calories_per_100g * multiplier,
    protein: product.protein_per_100g * multiplier,
    carbs: product.carbs_per_100g * multiplier,
    fat: product.fat_per_100g * multiplier,
  };
}

// Calculate macros for a meal
export function calculateMealMacros(
  items: MealPlanItem[],
  mealType: MealType,
  status: MealStatus,
  eatingOutCalories: number = 0
): MealMacros {
  if (status === "skipped") {
    return { mealType, status, calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  if (status === "eating_out") {
    return {
      mealType,
      status,
      calories: eatingOutCalories,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
  }

  const mealItems = items.filter(i => i.meal_type === mealType);
  const totals = mealItems.reduce(
    (acc, item) => {
      const itemMacros = calculateItemMacros(item);
      return {
        calories: acc.calories + itemMacros.calories,
        protein: acc.protein + itemMacros.protein,
        carbs: acc.carbs + itemMacros.carbs,
        fat: acc.fat + itemMacros.fat,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return { mealType, status, ...totals };
}

// Calculate macros for a day
export function calculateDayMacros(
  plan: MealPlan,
  settings?: NutritionSettings | null
): DayMacros {
  const items = plan.items || [];
  
  const meals: MealMacros[] = [
    calculateMealMacros(items, "breakfast", plan.breakfast_status, plan.eating_out_breakfast_calories),
    calculateMealMacros(items, "lunch", plan.lunch_status, plan.eating_out_lunch_calories),
    calculateMealMacros(items, "dinner", plan.dinner_status, plan.eating_out_dinner_calories),
    calculateMealMacros(items, "snack", plan.snack_status, plan.eating_out_snack_calories),
  ];

  const totals = meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.protein,
      carbs: acc.carbs + meal.carbs,
      fat: acc.fat + meal.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  let targetDiff: MacroTotals | undefined;
  if (settings && settings.mode === "target_based") {
    targetDiff = {
      calories: totals.calories - (settings.daily_calorie_target || 0),
      protein: totals.protein - (settings.protein_target_grams || 0),
      carbs: totals.carbs - (settings.carbs_target_grams || 0),
      fat: totals.fat - (settings.fat_target_grams || 0),
    };
  }

  return { date: plan.meal_date, meals, totals, targetDiff };
}

// Calculate weekly averages
export function calculateWeeklyAverages(dayMacros: DayMacros[]): MacroTotals {
  const plannedDays = dayMacros.filter(d => 
    d.meals.some(m => m.status === "planned" || m.status === "eating_out")
  );
  
  if (plannedDays.length === 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  const totals = plannedDays.reduce(
    (acc, day) => ({
      calories: acc.calories + day.totals.calories,
      protein: acc.protein + day.totals.protein,
      carbs: acc.carbs + day.totals.carbs,
      fat: acc.fat + day.totals.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return {
    calories: totals.calories / plannedDays.length,
    protein: totals.protein / plannedDays.length,
    carbs: totals.carbs / plannedDays.length,
    fat: totals.fat / plannedDays.length,
  };
}

// Generate grocery list from meal plans
export function generateGroceryList(plans: MealPlan[]): GroceryItem[] {
  const productMap = new Map<string, { product: Product; totalGrams: number }>();

  for (const plan of plans) {
    const items = plan.items || [];
    
    for (const item of items) {
      // Skip items from skipped meals
      const status = getMealStatus(plan, item.meal_type);
      if (status === "skipped") continue;
      
      if (!item.product) continue;

      const existing = productMap.get(item.product_id);
      if (existing) {
        existing.totalGrams += item.quantity_grams;
      } else {
        productMap.set(item.product_id, {
          product: item.product,
          totalGrams: item.quantity_grams,
        });
      }
    }
  }

  return Array.from(productMap.values()).map(({ product, totalGrams }) => {
    const packSize = product.pack_size_grams;
    let purchaseQuantity: number;
    let purchaseUnits: string;
    let totalCost: number;

    if (packSize && packSize > 0) {
      // Round up to nearest pack
      purchaseQuantity = Math.ceil(totalGrams / packSize);
      purchaseUnits = `× ${packSize}g`;
      totalCost = purchaseQuantity * product.price;
    } else {
      // Sold by weight - price is per 100g
      purchaseQuantity = Math.ceil(totalGrams);
      purchaseUnits = "g";
      totalCost = (totalGrams / 100) * product.price;
    }

    return {
      product,
      requiredGrams: totalGrams,
      purchaseQuantity,
      purchaseUnits,
      totalCost,
    };
  }).sort((a, b) => a.product.name.localeCompare(b.product.name));
}

function getMealStatus(plan: MealPlan, mealType: MealType): MealStatus {
  switch (mealType) {
    case "breakfast": return plan.breakfast_status;
    case "lunch": return plan.lunch_status;
    case "dinner": return plan.dinner_status;
    case "snack": return plan.snack_status;
  }
}

// Check for balance warnings
export function getBalanceWarnings(
  dayMacros: DayMacros,
  settings?: NutritionSettings | null
): BalanceWarning[] {
  const warnings: BalanceWarning[] = [];

  // Check for extremely low calorie meals
  for (const meal of dayMacros.meals) {
    if (meal.status !== "planned") continue;
    
    if (meal.calories < 100 && meal.calories > 0) {
      warnings.push({
        type: "low_calories",
        message: `${meal.mealType} has very low calories (${Math.round(meal.calories)} kcal)`,
        mealType: meal.mealType,
        date: dayMacros.date,
      });
    }
  }

  // Check for severely macro-skewed day
  if (dayMacros.totals.calories > 0) {
    const proteinCals = dayMacros.totals.protein * 4;
    const carbsCals = dayMacros.totals.carbs * 4;
    const fatCals = dayMacros.totals.fat * 9;
    const totalCals = proteinCals + carbsCals + fatCals;

    if (totalCals > 0) {
      const proteinPct = (proteinCals / totalCals) * 100;
      const fatPct = (fatCals / totalCals) * 100;

      if (proteinPct < 10) {
        warnings.push({
          type: "macro_skewed",
          message: `Very low protein ratio (${Math.round(proteinPct)}%)`,
          date: dayMacros.date,
        });
      }

      if (fatPct > 50) {
        warnings.push({
          type: "macro_skewed",
          message: `High fat ratio (${Math.round(fatPct)}%)`,
          date: dayMacros.date,
        });
      }
    }
  }

  // Check for target unachievable (in target mode)
  if (settings?.mode === "target_based" && dayMacros.targetDiff) {
    const { calories, protein } = dayMacros.targetDiff;
    
    if (Math.abs(calories) > 200) {
      warnings.push({
        type: "target_unachievable",
        message: `${Math.abs(Math.round(calories))} kcal ${calories > 0 ? "over" : "under"} target`,
        date: dayMacros.date,
      });
    }

    if (Math.abs(protein) > 20) {
      warnings.push({
        type: "target_unachievable",
        message: `${Math.abs(Math.round(protein))}g protein ${protein > 0 ? "over" : "under"} target`,
        date: dayMacros.date,
      });
    }
  }

  return warnings;
}

// Auto-distribute macros across editable items (for target-based mode)
export interface DistributionResult {
  adjustedItems: Map<string, number>; // item id -> new quantity
  warnings: BalanceWarning[];
  achievedMacros: MacroTotals;
}

export function distributeToTargets(
  items: MealPlanItem[],
  targets: MacroTotals,
  fixedContribution: MacroTotals
): DistributionResult {
  const adjustedItems = new Map<string, number>();
  const warnings: BalanceWarning[] = [];

  // Calculate remaining targets after fixed items
  const remaining = {
    calories: targets.calories - fixedContribution.calories,
    protein: targets.protein - fixedContribution.protein,
    carbs: targets.carbs - fixedContribution.carbs,
    fat: targets.fat - fixedContribution.fat,
  };

  // Get editable, unlocked items
  const editableItems = items.filter(i => 
    i.product && 
    i.product.product_type === "editable" && 
    !i.is_locked &&
    !i.product.ignore_macros
  );

  if (editableItems.length === 0) {
    if (remaining.protein > 10 || remaining.calories > 100) {
      warnings.push({
        type: "target_unachievable",
        message: "No editable items to adjust. Add more ingredients or unlock some items.",
      });
    }
    return { adjustedItems, warnings, achievedMacros: fixedContribution };
  }

  // Simple proportional distribution prioritizing protein
  // This is a simplified algorithm - production would use linear programming
  
  let achieved = { ...fixedContribution };

  for (const item of editableItems) {
    const product = item.product!;
    
    // Calculate how much we need from this item
    // Priority: protein > calories > carbs/fat
    const proteinPer100g = product.protein_per_100g;
    const calsPer100g = product.calories_per_100g;
    
    if (proteinPer100g > 15) {
      // High protein food - size by protein need
      const neededProtein = Math.max(0, remaining.protein - (achieved.protein - fixedContribution.protein));
      const gramsForProtein = (neededProtein / proteinPer100g) * 100;
      const newGrams = Math.max(20, Math.min(500, gramsForProtein)); // Reasonable bounds
      
      adjustedItems.set(item.id, Math.round(newGrams));
      
      const multiplier = newGrams / 100;
      achieved.calories += calsPer100g * multiplier;
      achieved.protein += proteinPer100g * multiplier;
      achieved.carbs += product.carbs_per_100g * multiplier;
      achieved.fat += product.fat_per_100g * multiplier;
    } else if (calsPer100g > 0) {
      // Size by calorie need
      const neededCals = Math.max(0, remaining.calories - (achieved.calories - fixedContribution.calories));
      const gramsForCals = (neededCals / calsPer100g) * 100;
      const newGrams = Math.max(20, Math.min(500, gramsForCals));
      
      adjustedItems.set(item.id, Math.round(newGrams));
      
      const multiplier = newGrams / 100;
      achieved.calories += calsPer100g * multiplier;
      achieved.protein += proteinPer100g * multiplier;
      achieved.carbs += product.carbs_per_100g * multiplier;
      achieved.fat += product.fat_per_100g * multiplier;
    } else {
      // Keep original quantity
      adjustedItems.set(item.id, item.quantity_grams);
    }
  }

  // Check if we hit targets
  if (Math.abs(achieved.protein - targets.protein) > 20) {
    warnings.push({
      type: "target_unachievable",
      message: `Could only achieve ${Math.round(achieved.protein)}g protein (target: ${targets.protein}g). Consider adding high-protein foods.`,
    });
  }

  if (Math.abs(achieved.calories - targets.calories) > 200) {
    warnings.push({
      type: "target_unachievable", 
      message: `Achieved ${Math.round(achieved.calories)} kcal (target: ${targets.calories} kcal).`,
    });
  }

  return { adjustedItems, warnings, achievedMacros: achieved };
}
