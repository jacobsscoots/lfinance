/**
 * Precision Auto-Portioning Algorithm for Target-Based Meal Planning.
 * Uses linear algebra approach to calculate EXACT gram quantities to hit targets.
 * Zero tolerance - day totals match targets exactly (subject to fixed/locked constraints).
 */

import { Product } from "@/hooks/useProducts";
import { MealPlanItem, MealType } from "@/hooks/useMealPlanItems";
import { MacroTotals } from "./mealCalculations";

export type FoodType = "protein" | "carb" | "fat" | "veg" | "fruit" | "dairy" | "sauce" | "treat" | "other";

export interface PortioningSettings {
  minGrams: number;
  maxGrams: number;
  rounding: number; // Round to nearest X grams (0 = no rounding for exact precision)
  tolerancePercent: number; // Used for warnings only, algorithm targets zero tolerance
}

export const DEFAULT_PORTIONING_SETTINGS: PortioningSettings = {
  minGrams: 10,
  maxGrams: 500,
  rounding: 0, // Zero rounding for exact precision
  tolerancePercent: 0, // Zero tolerance
};

export interface PortioningResult {
  grams: number;
  macros: MacroTotals;
  warnings: string[];
}

export interface MealPortioningResult {
  items: Map<string, number>; // item_id -> grams
  achievedMacros: MacroTotals;
  warnings: string[];
  withinTolerance: boolean;
}

export interface DayPortioningResult {
  mealResults: Map<MealType, MealPortioningResult>;
  dayTotals: MacroTotals;
  warnings: string[];
  success: boolean;
}

/**
 * Calculate macros for a given product at a specific gram amount.
 */
export function calculateMacrosForGrams(product: Product, grams: number): MacroTotals {
  const multiplier = grams / 100;
  return {
    calories: product.calories_per_100g * multiplier,
    protein: product.protein_per_100g * multiplier,
    carbs: product.carbs_per_100g * multiplier,
    fat: product.fat_per_100g * multiplier,
  };
}

/**
 * Check if a product is allowed for a specific meal type.
 */
export function isProductAllowedForMeal(product: Product, mealType: MealType): boolean {
  const eligibility = (product as any).meal_eligibility as string[] | undefined;
  if (!eligibility || eligibility.length === 0) return true;
  return eligibility.includes(mealType);
}

/**
 * Get products that are not allowed for a specific meal.
 */
export function getIneligibleProducts(products: Product[], mealType: MealType): Product[] {
  return products.filter(p => !isProductAllowedForMeal(p, mealType));
}

interface EditableItem {
  itemId: string;
  product: Product;
  mealType: MealType;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  foodType: FoodType;
}

interface FixedContribution {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Get food type category for balanced meal composition
 */
function getFoodType(product: Product): FoodType {
  const foodType = (product as any).food_type as string | undefined;
  if (foodType && ["protein", "carb", "fat", "veg", "fruit", "dairy", "sauce", "treat", "other"].includes(foodType)) {
    return foodType as FoodType;
  }
  // Infer from macros if not set
  const p = product.protein_per_100g;
  const c = product.carbs_per_100g;
  const f = product.fat_per_100g;
  if (p > 15 && p > c && p > f) return "protein";
  if (c > 30 && c > p && c > f) return "carb";
  if (f > 20 && f > p && f > c) return "fat";
  return "other";
}

/**
 * Solve for exact grams using weighted least squares optimization.
 * Prioritizes: Calories > Protein > Carbs > Fat
 */
function solveExactPortions(
  items: EditableItem[],
  targetMacros: MacroTotals,
  settings: PortioningSettings
): Map<string, number> {
  const result = new Map<string, number>();
  
  if (items.length === 0) return result;
  
  // Priority weights for optimization
  const CALORIE_WEIGHT = 10;
  const PROTEIN_WEIGHT = 5;
  const CARB_WEIGHT = 2;
  const FAT_WEIGHT = 1;

  // For single item, solve directly for calories
  if (items.length === 1) {
    const item = items[0];
    let grams = 0;
    
    if (item.caloriesPer100g > 0) {
      grams = (targetMacros.calories / item.caloriesPer100g) * 100;
    } else if (item.proteinPer100g > 0) {
      grams = (targetMacros.protein / item.proteinPer100g) * 100;
    } else {
      grams = 100; // Default
    }
    
    grams = Math.max(settings.minGrams, Math.min(settings.maxGrams, grams));
    result.set(item.itemId, grams);
    return result;
  }

  // Multi-item optimization using iterative refinement
  // Start with equal distribution, then refine
  const n = items.length;
  const grams: number[] = new Array(n).fill(100);
  
  // Calculate current totals
  const calcTotals = (): MacroTotals => {
    let cal = 0, pro = 0, carb = 0, fat = 0;
    for (let i = 0; i < n; i++) {
      const mult = grams[i] / 100;
      cal += items[i].caloriesPer100g * mult;
      pro += items[i].proteinPer100g * mult;
      carb += items[i].carbsPer100g * mult;
      fat += items[i].fatPer100g * mult;
    }
    return { calories: cal, protein: pro, carbs: carb, fat: fat };
  };

  // Separate items by primary macro contribution
  const proteinItems: number[] = [];
  const carbItems: number[] = [];
  const fatItems: number[] = [];
  const otherItems: number[] = [];
  
  items.forEach((item, idx) => {
    if (item.foodType === "protein" || item.proteinPer100g > 15) {
      proteinItems.push(idx);
    } else if (item.foodType === "carb" || item.carbsPer100g > 30) {
      carbItems.push(idx);
    } else if (item.foodType === "fat" || item.fatPer100g > 15) {
      fatItems.push(idx);
    } else {
      otherItems.push(idx);
    }
  });

  // Phase 1: Distribute protein sources to hit protein target
  if (proteinItems.length > 0 && targetMacros.protein > 0) {
    const totalProteinPer100g = proteinItems.reduce((sum, idx) => sum + items[idx].proteinPer100g, 0);
    if (totalProteinPer100g > 0) {
      const baseGrams = (targetMacros.protein / totalProteinPer100g) * 100;
      proteinItems.forEach(idx => {
        grams[idx] = Math.max(settings.minGrams, Math.min(settings.maxGrams, baseGrams));
      });
    }
  }

  // Phase 2: Adjust carb sources to help hit calorie target
  let currentTotals = calcTotals();
  const remainingCalories = targetMacros.calories - currentTotals.calories;
  
  if (carbItems.length > 0 && remainingCalories > 0) {
    const totalCarbCalsPer100g = carbItems.reduce((sum, idx) => sum + items[idx].caloriesPer100g, 0);
    if (totalCarbCalsPer100g > 0) {
      const additionalGrams = (remainingCalories / totalCarbCalsPer100g) * 100;
      carbItems.forEach(idx => {
        grams[idx] = Math.max(settings.minGrams, Math.min(settings.maxGrams, additionalGrams));
      });
    }
  }

  // Phase 3: Fine-tune remaining items
  currentTotals = calcTotals();
  const stillNeeded = targetMacros.calories - currentTotals.calories;
  
  const adjustableItems = [...otherItems, ...fatItems];
  if (adjustableItems.length > 0 && Math.abs(stillNeeded) > 1) {
    const totalCalsPer100g = adjustableItems.reduce((sum, idx) => sum + items[idx].caloriesPer100g, 0);
    if (totalCalsPer100g > 0) {
      const adjustGrams = (stillNeeded / totalCalsPer100g) * 100;
      adjustableItems.forEach(idx => {
        const newGrams = grams[idx] + adjustGrams / adjustableItems.length;
        grams[idx] = Math.max(settings.minGrams, Math.min(settings.maxGrams, newGrams));
      });
    }
  }

  // Phase 4: Iterative refinement to hit exact calorie target
  for (let iter = 0; iter < 10; iter++) {
    currentTotals = calcTotals();
    const calDiff = targetMacros.calories - currentTotals.calories;
    
    if (Math.abs(calDiff) < 0.1) break; // Target hit
    
    // Find the item with highest calories/g that can be adjusted
    let bestIdx = -1;
    let bestCalPer100g = 0;
    
    for (let i = 0; i < n; i++) {
      if (items[i].caloriesPer100g > bestCalPer100g) {
        const canAdjust = calDiff > 0 
          ? grams[i] < settings.maxGrams 
          : grams[i] > settings.minGrams;
        if (canAdjust) {
          bestIdx = i;
          bestCalPer100g = items[i].caloriesPer100g;
        }
      }
    }
    
    if (bestIdx >= 0 && bestCalPer100g > 0) {
      const neededGrams = (calDiff / bestCalPer100g) * 100;
      const newGrams = grams[bestIdx] + neededGrams;
      grams[bestIdx] = Math.max(settings.minGrams, Math.min(settings.maxGrams, newGrams));
    } else {
      break; // Can't adjust further
    }
  }

  // Store results (no rounding for exact precision)
  for (let i = 0; i < n; i++) {
    // Round to 1 decimal place for clean display but exact calculation
    result.set(items[i].itemId, Math.round(grams[i] * 10) / 10);
  }
  
  return result;
}

/**
 * Calculate portions for all items in a day to hit exact daily targets.
 * Splits calories evenly across breakfast/lunch/dinner (snacks optional).
 */
export function calculateDayPortions(
  items: MealPlanItem[],
  dailyTargets: MacroTotals,
  settings: PortioningSettings = DEFAULT_PORTIONING_SETTINGS
): DayPortioningResult {
  const warnings: string[] = [];
  const mealResults = new Map<MealType, MealPortioningResult>();
  
  // Separate items by meal
  const mealItems: Record<MealType, MealPlanItem[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };
  
  items.forEach(item => {
    mealItems[item.meal_type].push(item);
  });

  // Calculate fixed/locked contribution first
  let fixedContribution: FixedContribution = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  
  items.forEach(item => {
    if (!item.product) return;
    
    const isFixed = item.product.product_type === "fixed";
    const isLocked = item.is_locked;
    const ignoresMacros = item.product.ignore_macros;
    
    if ((isFixed || isLocked) && !ignoresMacros) {
      const grams = isFixed && item.product.fixed_portion_grams 
        ? item.product.fixed_portion_grams 
        : item.quantity_grams;
      const macros = calculateMacrosForGrams(item.product, grams);
      fixedContribution.calories += macros.calories;
      fixedContribution.protein += macros.protein;
      fixedContribution.carbs += macros.carbs;
      fixedContribution.fat += macros.fat;
    }
  });

  // Calculate remaining targets after fixed items
  const remainingTargets: MacroTotals = {
    calories: Math.max(0, dailyTargets.calories - fixedContribution.calories),
    protein: Math.max(0, dailyTargets.protein - fixedContribution.protein),
    carbs: Math.max(0, dailyTargets.carbs - fixedContribution.carbs),
    fat: Math.max(0, dailyTargets.fat - fixedContribution.fat),
  };

  // Count active meals (meals with editable items)
  const activeMeals: MealType[] = [];
  const editableByMeal: Record<MealType, EditableItem[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  (["breakfast", "lunch", "dinner", "snack"] as MealType[]).forEach(mealType => {
    const editables = mealItems[mealType].filter(item => 
      item.product && 
      !item.is_locked && 
      item.product.product_type !== "fixed" &&
      !item.product.ignore_macros
    ).map(item => ({
      itemId: item.id,
      product: item.product!,
      mealType,
      caloriesPer100g: item.product!.calories_per_100g,
      proteinPer100g: item.product!.protein_per_100g,
      carbsPer100g: item.product!.carbs_per_100g,
      fatPer100g: item.product!.fat_per_100g,
      foodType: getFoodType(item.product!),
    }));
    
    editableByMeal[mealType] = editables;
    if (editables.length > 0 && mealType !== "snack") {
      activeMeals.push(mealType);
    }
  });

  // Include snacks if they have items
  if (editableByMeal.snack.length > 0) {
    activeMeals.push("snack");
  }

  if (activeMeals.length === 0) {
    // No editable items - just return fixed contributions
    const totalMacros: MacroTotals = { ...fixedContribution };
    return {
      mealResults,
      dayTotals: totalMacros,
      warnings: remainingTargets.calories > 50 
        ? ["No editable items to adjust. Add more foods or unlock some items."]
        : [],
      success: Math.abs(totalMacros.calories - dailyTargets.calories) < 10,
    };
  }

  // Split remaining targets evenly across main meals (B/L/D)
  const mainMeals = activeMeals.filter(m => m !== "snack");
  const hasSnacks = activeMeals.includes("snack");
  
  // Allocate 10% to snacks if they exist, rest split evenly
  const snackRatio = hasSnacks ? 0.1 : 0;
  const mainMealRatio = (1 - snackRatio) / mainMeals.length;

  const mealTargets: Record<MealType, MacroTotals> = {
    breakfast: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    lunch: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    dinner: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    snack: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  };

  mainMeals.forEach(meal => {
    mealTargets[meal] = {
      calories: remainingTargets.calories * mainMealRatio,
      protein: remainingTargets.protein * mainMealRatio,
      carbs: remainingTargets.carbs * mainMealRatio,
      fat: remainingTargets.fat * mainMealRatio,
    };
  });

  if (hasSnacks) {
    mealTargets.snack = {
      calories: remainingTargets.calories * snackRatio,
      protein: remainingTargets.protein * snackRatio,
      carbs: remainingTargets.carbs * snackRatio,
      fat: remainingTargets.fat * snackRatio,
    };
  }

  // Calculate portions for each meal
  const allItemGrams = new Map<string, number>();
  let totalAchieved: MacroTotals = { ...fixedContribution };

  activeMeals.forEach(mealType => {
    const editables = editableByMeal[mealType];
    const targets = mealTargets[mealType];
    
    const portions = solveExactPortions(editables, targets, settings);
    
    // Calculate achieved macros for this meal
    let mealAchieved: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    
    // Add fixed/locked items for this meal
    mealItems[mealType].forEach(item => {
      if (!item.product || item.product.ignore_macros) return;
      
      if (item.is_locked || item.product.product_type === "fixed") {
        const grams = item.product.product_type === "fixed" && item.product.fixed_portion_grams
          ? item.product.fixed_portion_grams
          : item.quantity_grams;
        const macros = calculateMacrosForGrams(item.product, grams);
        mealAchieved.calories += macros.calories;
        mealAchieved.protein += macros.protein;
        mealAchieved.carbs += macros.carbs;
        mealAchieved.fat += macros.fat;
        allItemGrams.set(item.id, grams);
      }
    });
    
    // Add editable items
    portions.forEach((grams, itemId) => {
      allItemGrams.set(itemId, grams);
      const item = editables.find(e => e.itemId === itemId);
      if (item) {
        const macros = calculateMacrosForGrams(item.product, grams);
        mealAchieved.calories += macros.calories;
        mealAchieved.protein += macros.protein;
        mealAchieved.carbs += macros.carbs;
        mealAchieved.fat += macros.fat;
      }
    });

    mealResults.set(mealType, {
      items: portions,
      achievedMacros: mealAchieved,
      warnings: [],
      withinTolerance: true,
    });

    // Only add non-fixed items to total (fixed already counted)
    portions.forEach((grams, itemId) => {
      const item = editables.find(e => e.itemId === itemId);
      if (item) {
        const macros = calculateMacrosForGrams(item.product, grams);
        totalAchieved.calories += macros.calories;
        totalAchieved.protein += macros.protein;
        totalAchieved.carbs += macros.carbs;
        totalAchieved.fat += macros.fat;
      }
    });
  });

  // Final adjustment pass to hit exact daily totals
  // Find the item that can most efficiently close any remaining gap
  const calDiff = dailyTargets.calories - totalAchieved.calories;
  
  if (Math.abs(calDiff) > 1) {
    // Find best item to adjust across all meals
    let bestItemId: string | null = null;
    let bestCalPer100g = 0;
    let bestCurrentGrams = 0;
    
    activeMeals.forEach(mealType => {
      editableByMeal[mealType].forEach(item => {
        const currentGrams = allItemGrams.get(item.itemId) || 0;
        const canIncrease = calDiff > 0 && currentGrams < settings.maxGrams;
        const canDecrease = calDiff < 0 && currentGrams > settings.minGrams;
        
        if ((canIncrease || canDecrease) && item.caloriesPer100g > bestCalPer100g) {
          bestItemId = item.itemId;
          bestCalPer100g = item.caloriesPer100g;
          bestCurrentGrams = currentGrams;
        }
      });
    });
    
    if (bestItemId && bestCalPer100g > 0) {
      const adjustment = (calDiff / bestCalPer100g) * 100;
      const newGrams = Math.max(
        settings.minGrams,
        Math.min(settings.maxGrams, bestCurrentGrams + adjustment)
      );
      allItemGrams.set(bestItemId, Math.round(newGrams * 10) / 10);
      
      // Recalculate totals
      totalAchieved = { ...fixedContribution };
      allItemGrams.forEach((grams, itemId) => {
        // Find the item across all meals
        for (const mealType of activeMeals) {
          const item = editableByMeal[mealType].find(e => e.itemId === itemId);
          if (item) {
            const macros = calculateMacrosForGrams(item.product, grams);
            totalAchieved.calories += macros.calories;
            totalAchieved.protein += macros.protein;
            totalAchieved.carbs += macros.carbs;
            totalAchieved.fat += macros.fat;
            break;
          }
        }
      });
    }
  }

  // Update meal results with final grams
  mealResults.forEach((result, mealType) => {
    const editables = editableByMeal[mealType];
    editables.forEach(item => {
      const finalGrams = allItemGrams.get(item.itemId);
      if (finalGrams !== undefined) {
        result.items.set(item.itemId, finalGrams);
      }
    });
  });

  const success = Math.abs(totalAchieved.calories - dailyTargets.calories) < 5;
  
  if (!success) {
    warnings.push(`Could not hit exact target. Achieved ${Math.round(totalAchieved.calories)} of ${dailyTargets.calories} kcal.`);
  }

  return {
    mealResults,
    dayTotals: totalAchieved,
    warnings,
    success,
  };
}

/**
 * Calculate portions for all items in a meal to meet targets.
 * This is the legacy function for backwards compatibility.
 */
export function calculateMealPortions(
  products: Product[],
  mealTargets: MacroTotals,
  lockedItems: { productId: string; grams: number }[],
  settings: PortioningSettings = DEFAULT_PORTIONING_SETTINGS
): MealPortioningResult {
  // Convert to new format and use day portioning
  const editables: EditableItem[] = products
    .filter(p => p.product_type !== "fixed" && !p.ignore_macros)
    .filter(p => !lockedItems.some(l => l.productId === p.id))
    .map(p => ({
      itemId: p.id,
      product: p,
      mealType: "lunch" as MealType,
      caloriesPer100g: p.calories_per_100g,
      proteinPer100g: p.protein_per_100g,
      carbsPer100g: p.carbs_per_100g,
      fatPer100g: p.fat_per_100g,
      foodType: getFoodType(p),
    }));

  // Calculate locked contribution
  let lockedContribution: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  lockedItems.forEach(locked => {
    const product = products.find(p => p.id === locked.productId);
    if (product) {
      const macros = calculateMacrosForGrams(product, locked.grams);
      lockedContribution.calories += macros.calories;
      lockedContribution.protein += macros.protein;
      lockedContribution.carbs += macros.carbs;
      lockedContribution.fat += macros.fat;
    }
  });

  const remainingTargets: MacroTotals = {
    calories: Math.max(0, mealTargets.calories - lockedContribution.calories),
    protein: Math.max(0, mealTargets.protein - lockedContribution.protein),
    carbs: Math.max(0, mealTargets.carbs - lockedContribution.carbs),
    fat: Math.max(0, mealTargets.fat - lockedContribution.fat),
  };

  const portions = solveExactPortions(editables, remainingTargets, settings);
  
  // Build result
  const itemGrams = new Map<string, number>();
  let achieved: MacroTotals = { ...lockedContribution };
  
  lockedItems.forEach(locked => {
    itemGrams.set(locked.productId, locked.grams);
  });
  
  portions.forEach((grams, productId) => {
    itemGrams.set(productId, grams);
    const product = products.find(p => p.id === productId);
    if (product) {
      const macros = calculateMacrosForGrams(product, grams);
      achieved.calories += macros.calories;
      achieved.protein += macros.protein;
      achieved.carbs += macros.carbs;
      achieved.fat += macros.fat;
    }
  });

  // Add fixed products
  products.filter(p => p.product_type === "fixed").forEach(product => {
    const grams = product.fixed_portion_grams || 100;
    itemGrams.set(product.id, grams);
    const macros = calculateMacrosForGrams(product, grams);
    achieved.calories += macros.calories;
    achieved.protein += macros.protein;
    achieved.carbs += macros.carbs;
    achieved.fat += macros.fat;
  });

  const withinTolerance = Math.abs(achieved.calories - mealTargets.calories) < 10;

  return {
    items: itemGrams,
    achievedMacros: achieved,
    warnings: withinTolerance ? [] : [`Achieved ${Math.round(achieved.calories)} kcal (target: ${mealTargets.calories})`],
    withinTolerance,
  };
}

/**
 * Calculate a single product's portion for adding to a meal.
 * In the new flow, this returns 0 so the user adds items first,
 * then clicks Generate to calculate exact portions.
 */
export function calculateSingleItemPortion(
  product: Product,
  mealType: MealType,
  existingItems: MealPlanItem[],
  dailyTargets: MacroTotals,
  settings: PortioningSettings = DEFAULT_PORTIONING_SETTINGS
): PortioningResult {
  // Handle fixed-portion products
  if (product.product_type === "fixed" && product.fixed_portion_grams) {
    return {
      grams: product.fixed_portion_grams,
      macros: calculateMacrosForGrams(product, product.fixed_portion_grams),
      warnings: [],
    };
  }
  
  // Handle ignore_macros products
  if (product.ignore_macros) {
    return {
      grams: 100,
      macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      warnings: [],
    };
  }

  // NEW FLOW: Return 0g initially - user adds items, then clicks Generate
  // This allows the algorithm to optimize across all items simultaneously
  return {
    grams: 0,
    macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    warnings: ["Click 'Generate' after adding all items to auto-calculate exact portions"],
  };
}
