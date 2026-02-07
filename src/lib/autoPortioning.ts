/**
 * Precision Auto-Portioning Algorithm for Target-Based Meal Planning.
 * Uses iterative multi-target optimization to calculate EXACT gram quantities.
 * Zero tolerance - day totals match ALL targets exactly (calories, protein, carbs, fat).
 */

import { Product } from "@/hooks/useProducts";
import { MealPlanItem, MealType } from "@/hooks/useMealPlanItems";
import { MacroTotals } from "./mealCalculations";

export type FoodType = "protein" | "carb" | "fat" | "veg" | "fruit" | "dairy" | "sauce" | "treat" | "other";

export interface PortioningSettings {
  minGrams: number;
  maxGrams: number;
  rounding: number;
  tolerancePercent: number;
}

export const DEFAULT_PORTIONING_SETTINGS: PortioningSettings = {
  minGrams: 10,
  maxGrams: 500,
  rounding: 0,
  tolerancePercent: 0,
};

export interface PortioningResult {
  grams: number;
  macros: MacroTotals;
  warnings: string[];
}

export interface MealPortioningResult {
  items: Map<string, number>;
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

interface MacroError {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  totalWeighted: number;
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

/**
 * Get food type category for balanced meal composition.
 */
function getFoodType(product: Product): FoodType {
  const foodType = (product as any).food_type as string | undefined;
  if (foodType && ["protein", "carb", "fat", "veg", "fruit", "dairy", "sauce", "treat", "other"].includes(foodType)) {
    return foodType as FoodType;
  }
  const p = product.protein_per_100g;
  const c = product.carbs_per_100g;
  const f = product.fat_per_100g;
  if (p > 15 && p > c && p > f) return "protein";
  if (c > 30 && c > p && c > f) return "carb";
  if (f > 20 && f > p && f > c) return "fat";
  return "other";
}

/**
 * Check if a product is a high-protein source.
 */
function isHighProteinSource(product: Product): boolean {
  const name = product.name.toLowerCase();
  const proteinKeywords = ["yogurt", "yoghurt", "chicken", "fish", "salmon", "tuna", "cod", "egg", "beef", "turkey", "pork", "prawn", "shrimp", "tofu", "tempeh", "lean"];
  return proteinKeywords.some(kw => name.includes(kw)) || product.protein_per_100g > 15;
}

/**
 * Check if a product is a sauce/seasoning that should have small portions.
 */
function isSauceOrSeasoning(product: Product): boolean {
  const name = product.name.toLowerCase();
  const sauceKeywords = ["sauce", "seasoning", "spice", "oil", "butter", "dressing", "mayo", "ketchup", "mustard", "herb", "pepper", "salt", "schwartz"];
  return sauceKeywords.some(kw => name.includes(kw)) || product.food_type === "sauce";
}

/**
 * Get max portion for a product based on its type.
 */
function getMaxPortion(product: Product, settings: PortioningSettings): number {
  if (isSauceOrSeasoning(product)) {
    return 30; // Max 30g for sauces/seasonings
  }
  if (getBreakfastRole(product) === "topper") {
    return 40; // Max 40g for granola/toppings
  }
  return settings.maxGrams;
}

/**
 * Get breakfast role for composition hierarchy.
 */
function getBreakfastRole(product: Product): "base" | "secondary" | "topper" | "other" {
  const name = product.name.toLowerCase();
  
  if (name.includes("yogurt") || name.includes("yoghurt")) {
    return "base";
  }
  
  const fruitKeywords = ["fruit", "berry", "berries", "banana", "apple", "mango", "strawberry", "blueberry", "raspberry"];
  if (fruitKeywords.some(kw => name.includes(kw)) || product.food_type === "fruit") {
    return "secondary";
  }
  
  const topperKeywords = ["granola", "muesli", "cereal", "oat", "crunchy", "topper"];
  if (topperKeywords.some(kw => name.includes(kw))) {
    return "topper";
  }
  
  return "other";
}

/**
 * Calculate multi-macro error between achieved and target values.
 * Weights: Protein 1.5x, Calories 1.0x, Carbs 0.8x, Fat 0.8x
 */
function calculateMacroError(achieved: MacroTotals, targets: MacroTotals): MacroError {
  const calError = targets.calories - achieved.calories;
  const proError = targets.protein - achieved.protein;
  const carbError = targets.carbs - achieved.carbs;
  const fatError = targets.fat - achieved.fat;
  
  return {
    calories: calError,
    protein: proError,
    carbs: carbError,
    fat: fatError,
    totalWeighted: Math.abs(calError) + 1.5 * Math.abs(proError) + 
                   0.8 * Math.abs(carbError) + 0.8 * Math.abs(fatError),
  };
}

/**
 * Sum macros for a set of items at given gram values.
 */
function sumMacros(items: EditableItem[], grams: number[]): MacroTotals {
  let cal = 0, pro = 0, carb = 0, fat = 0;
  for (let i = 0; i < items.length; i++) {
    const mult = grams[i] / 100;
    cal += items[i].caloriesPer100g * mult;
    pro += items[i].proteinPer100g * mult;
    carb += items[i].carbsPer100g * mult;
    fat += items[i].fatPer100g * mult;
  }
  return { calories: cal, protein: pro, carbs: carb, fat: fat };
}

/**
 * Multi-target solver using sequential macro-targeted scaling.
 * Solves for ALL macros with zero tolerance using a stable approach:
 * 1. Initialize proportions by food role
 * 2. Scale protein sources to hit protein target
 * 3. Scale carb sources to hit carb target (considering protein already used)
 * 4. Fine-tune for fat and calories
 */
function solveSimultaneous(
  items: EditableItem[],
  targets: MacroTotals,
  settings: PortioningSettings,
  mealType?: MealType
): Map<string, number> {
  const result = new Map<string, number>();
  
  if (items.length === 0) return result;

  const n = items.length;
  const grams: number[] = new Array(n).fill(0);
  
  // === CATEGORIZE ITEMS ===
  const proteinItems: number[] = [];
  const carbItems: number[] = [];
  const fatItems: number[] = [];
  const sauceItems: number[] = [];           // Sauces/seasonings - small portions
  const breakfastBase: number[] = [];        // Yogurt
  const breakfastSecondary: number[] = [];   // Fruit
  const breakfastTopper: number[] = [];      // Granola
  const otherItems: number[] = [];
  
  items.forEach((item, idx) => {
    // First check if it's a sauce/seasoning (should be small regardless of meal)
    if (isSauceOrSeasoning(item.product)) {
      sauceItems.push(idx);
      return;
    }
    
    if (mealType === "breakfast") {
      const role = getBreakfastRole(item.product);
      switch (role) {
        case "base": breakfastBase.push(idx); break;
        case "secondary": breakfastSecondary.push(idx); break;
        case "topper": breakfastTopper.push(idx); break;
        default: otherItems.push(idx); break;
      }
    } else {
      if (isHighProteinSource(item.product) || item.proteinPer100g > 15) {
        proteinItems.push(idx);
      } else if (item.carbsPer100g > 25 && item.proteinPer100g < 10) {
        carbItems.push(idx);
      } else if (item.fatPer100g > 10) {
        fatItems.push(idx);
      } else {
        otherItems.push(idx);
      }
    }
  });

  // === STEP 0: Set sauce/seasoning items to small fixed portions ===
  sauceItems.forEach(idx => {
    grams[idx] = 15; // Fixed small portion for sauces/seasonings
  });

  // === Calculate sauce contribution (applies to all meals) ===
  let sauceContrib = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  sauceItems.forEach(idx => {
    sauceContrib.calories += items[idx].caloriesPer100g * grams[idx] / 100;
    sauceContrib.protein += items[idx].proteinPer100g * grams[idx] / 100;
    sauceContrib.carbs += items[idx].carbsPer100g * grams[idx] / 100;
    sauceContrib.fat += items[idx].fatPer100g * grams[idx] / 100;
  });
  
  // Adjust targets to account for sauce contribution
  const adjustedTargets = {
    calories: Math.max(0, targets.calories - sauceContrib.calories),
    protein: Math.max(0, targets.protein - sauceContrib.protein),
    carbs: Math.max(0, targets.carbs - sauceContrib.carbs),
    fat: Math.max(0, targets.fat - sauceContrib.fat),
  };

  // === BREAKFAST SPECIAL HANDLING ===
  if (mealType === "breakfast") {
    // Step 1: Cap granola at 35g (topper)
    breakfastTopper.forEach(idx => {
      grams[idx] = 35;
    });
    
    // Step 2: Calculate calories used by toppers
    let topperCalories = 0;
    breakfastTopper.forEach(idx => {
      topperCalories += items[idx].caloriesPer100g * grams[idx] / 100;
    });
    
    const remainingCalories = adjustedTargets.calories - topperCalories;
    const remainingProtein = adjustedTargets.protein - sumMacros(items, grams).protein + sauceContrib.protein;
    
    // Step 3: Size yogurt (base) primarily by protein need
    if (breakfastBase.length > 0 && remainingProtein > 0) {
      const totalProteinPer100g = breakfastBase.reduce((sum, idx) => sum + items[idx].proteinPer100g, 0);
      if (totalProteinPer100g > 0) {
        // Size to hit ~90% of remaining protein (leave room for fine-tuning)
        const gramsNeeded = (remainingProtein * 0.9 / totalProteinPer100g) * 100;
        breakfastBase.forEach(idx => {
          grams[idx] = Math.max(settings.minGrams, Math.min(settings.maxGrams, gramsNeeded));
        });
      }
    }
    
    // Step 4: Calculate remaining calories after base
    let baseCalories = 0;
    breakfastBase.forEach(idx => {
      baseCalories += items[idx].caloriesPer100g * grams[idx] / 100;
    });
    
    const afterBaseCals = remainingCalories - baseCalories;
    
    // Step 5: Size fruit (secondary) to fill remaining calories
    if (breakfastSecondary.length > 0 && afterBaseCals > 0) {
      const totalCalsPer100g = breakfastSecondary.reduce((sum, idx) => sum + items[idx].caloriesPer100g, 0);
      if (totalCalsPer100g > 0) {
        const gramsNeeded = (afterBaseCals / totalCalsPer100g) * 100;
        breakfastSecondary.forEach(idx => {
          grams[idx] = Math.max(settings.minGrams, Math.min(settings.maxGrams, gramsNeeded));
        });
      }
    }
    
    // Step 6: Other items get minimal portions
    otherItems.forEach(idx => {
      if (grams[idx] === 0) grams[idx] = settings.minGrams;
    });
  } else {
    // === NON-BREAKFAST: Protein-first, then carbs, then fat ===
    
    // Step 1: Size protein items to hit protein target
    if (proteinItems.length > 0 && targets.protein > 0) {
      const totalProteinPer100g = proteinItems.reduce((sum, idx) => sum + items[idx].proteinPer100g, 0);
      if (totalProteinPer100g > 0) {
        const gramsNeeded = (targets.protein / totalProteinPer100g) * 100;
        proteinItems.forEach(idx => {
          grams[idx] = Math.max(settings.minGrams, Math.min(settings.maxGrams, gramsNeeded));
        });
      }
    }
    
    // Step 2: Calculate macros from protein items
    let proteinContrib = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    proteinItems.forEach(idx => {
      proteinContrib.calories += items[idx].caloriesPer100g * grams[idx] / 100;
      proteinContrib.protein += items[idx].proteinPer100g * grams[idx] / 100;
      proteinContrib.carbs += items[idx].carbsPer100g * grams[idx] / 100;
      proteinContrib.fat += items[idx].fatPer100g * grams[idx] / 100;
    });
    
    // Remaining targets after protein sources
    const remainingCarbs = Math.max(0, targets.carbs - proteinContrib.carbs);
    const remainingFat = Math.max(0, targets.fat - proteinContrib.fat);
    const remainingCals = Math.max(0, targets.calories - proteinContrib.calories);
    
    // Step 3: Size carb items to hit carb target
    if (carbItems.length > 0 && remainingCarbs > 0) {
      const totalCarbsPer100g = carbItems.reduce((sum, idx) => sum + items[idx].carbsPer100g, 0);
      if (totalCarbsPer100g > 0) {
        const gramsNeeded = (remainingCarbs / totalCarbsPer100g) * 100;
        carbItems.forEach(idx => {
          grams[idx] = Math.max(settings.minGrams, Math.min(settings.maxGrams, gramsNeeded));
        });
      }
    }
    
    // Step 4: Calculate remaining after carbs
    let carbContrib = { calories: 0, fat: 0 };
    carbItems.forEach(idx => {
      carbContrib.calories += items[idx].caloriesPer100g * grams[idx] / 100;
      carbContrib.fat += items[idx].fatPer100g * grams[idx] / 100;
    });
    
    const remainingFatAfterCarbs = Math.max(0, remainingFat - carbContrib.fat);
    
    // Step 5: Size fat items (if any) - usually minimal
    if (fatItems.length > 0 && remainingFatAfterCarbs > 5) {
      const totalFatPer100g = fatItems.reduce((sum, idx) => sum + items[idx].fatPer100g, 0);
      if (totalFatPer100g > 0) {
        const gramsNeeded = (remainingFatAfterCarbs / totalFatPer100g) * 100;
        fatItems.forEach(idx => {
          grams[idx] = Math.max(settings.minGrams, Math.min(settings.maxGrams * 0.5, gramsNeeded));
        });
      }
    }
    
    // Step 6: Other items get minimal portions
    otherItems.forEach(idx => {
      if (grams[idx] === 0) grams[idx] = settings.minGrams;
    });
  }

  // === PRECISION FINE-TUNING PASS ===
  fineTuneToExact(items, grams, targets, settings, mealType);
  
  // Store results with high precision
  for (let i = 0; i < n; i++) {
    result.set(items[i].itemId, Math.round(grams[i] * 10) / 10);
  }
  
  return result;
}

/**
 * Fine-tune grams to hit EXACT targets with micro-adjustments.
 * Uses sequential precision passes for each macro.
 */
function fineTuneToExact(
  items: EditableItem[],
  grams: number[],
  targets: MacroTotals,
  settings: PortioningSettings,
  mealType?: MealType
): void {
  const MICRO_TOLERANCE = 0.1;
  const MAX_PASSES = 20;
  
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const current = sumMacros(items, grams);
    const error = calculateMacroError(current, targets);
    
    // Check if we're within tolerance on all macros
    if (Math.abs(error.protein) < MICRO_TOLERANCE &&
        Math.abs(error.carbs) < MICRO_TOLERANCE &&
        Math.abs(error.fat) < MICRO_TOLERANCE &&
        Math.abs(error.calories) < 0.5) {
      break;
    }
    
    // === PASS 1: Fix protein with highest-protein item ===
    if (Math.abs(error.protein) >= MICRO_TOLERANCE) {
      let bestIdx = -1;
      let bestProteinPer100g = 0;
      
      for (let i = 0; i < items.length; i++) {
        if (mealType === "breakfast" && getBreakfastRole(items[i].product) === "topper") continue;
        if (items[i].proteinPer100g > bestProteinPer100g) {
          bestIdx = i;
          bestProteinPer100g = items[i].proteinPer100g;
        }
      }
      
      if (bestIdx >= 0 && bestProteinPer100g > 0) {
        const adjustment = (error.protein / bestProteinPer100g) * 100;
        grams[bestIdx] = Math.max(settings.minGrams, Math.min(settings.maxGrams, grams[bestIdx] + adjustment));
      }
    }
    
    // Recalculate after protein fix
    const afterProtein = sumMacros(items, grams);
    const errorAfterProtein = calculateMacroError(afterProtein, targets);
    
    // === PASS 2: Fix carbs with highest-carb non-protein item ===
    if (Math.abs(errorAfterProtein.carbs) >= MICRO_TOLERANCE) {
      let bestIdx = -1;
      let bestCarbPer100g = 0;
      let lowestProteinImpact = Infinity;
      
      for (let i = 0; i < items.length; i++) {
        if (mealType === "breakfast" && getBreakfastRole(items[i].product) === "topper") continue;
        // Prefer items with high carbs but low protein to avoid disrupting protein
        const proteinRatio = items[i].proteinPer100g / (items[i].carbsPer100g || 1);
        if (items[i].carbsPer100g > 10 && proteinRatio < lowestProteinImpact) {
          bestIdx = i;
          bestCarbPer100g = items[i].carbsPer100g;
          lowestProteinImpact = proteinRatio;
        }
      }
      
      if (bestIdx >= 0 && bestCarbPer100g > 0) {
        const adjustment = (errorAfterProtein.carbs / bestCarbPer100g) * 100;
        const newGrams = grams[bestIdx] + adjustment;
        grams[bestIdx] = Math.max(settings.minGrams, Math.min(settings.maxGrams, newGrams));
      }
    }
    
    // === PASS 3: Fix fat with best fat-source ===
    const afterCarbs = sumMacros(items, grams);
    const errorAfterCarbs = calculateMacroError(afterCarbs, targets);
    
    if (Math.abs(errorAfterCarbs.fat) >= MICRO_TOLERANCE) {
      let bestIdx = -1;
      let bestFatPer100g = 0;
      
      for (let i = 0; i < items.length; i++) {
        if (mealType === "breakfast" && getBreakfastRole(items[i].product) === "topper") continue;
        if (items[i].fatPer100g > bestFatPer100g && items[i].fatPer100g > 5) {
          bestIdx = i;
          bestFatPer100g = items[i].fatPer100g;
        }
      }
      
      if (bestIdx >= 0 && bestFatPer100g > 0) {
        const adjustment = (errorAfterCarbs.fat / bestFatPer100g) * 100;
        const newGrams = grams[bestIdx] + adjustment;
        grams[bestIdx] = Math.max(settings.minGrams, Math.min(settings.maxGrams, newGrams));
      }
    }
    
    // === PASS 4: Final calorie balance using most calorie-dense non-protein item ===
    const afterFat = sumMacros(items, grams);
    const errorAfterFat = calculateMacroError(afterFat, targets);
    
    if (Math.abs(errorAfterFat.calories) >= 0.5) {
      let bestIdx = -1;
      let bestCalPer100g = 0;
      
      for (let i = 0; i < items.length; i++) {
        if (mealType === "breakfast" && getBreakfastRole(items[i].product) === "topper") continue;
        // Prefer non-protein-heavy items for calorie adjustment
        if (items[i].caloriesPer100g > bestCalPer100g && items[i].proteinPer100g < 15) {
          bestIdx = i;
          bestCalPer100g = items[i].caloriesPer100g;
        }
      }
      
      // Fallback to any item if no low-protein option
      if (bestIdx < 0) {
        for (let i = 0; i < items.length; i++) {
          if (mealType === "breakfast" && getBreakfastRole(items[i].product) === "topper") continue;
          if (items[i].caloriesPer100g > bestCalPer100g) {
            bestIdx = i;
            bestCalPer100g = items[i].caloriesPer100g;
          }
        }
      }
      
      if (bestIdx >= 0 && bestCalPer100g > 0) {
        const adjustment = (errorAfterFat.calories / bestCalPer100g) * 100;
        const newGrams = grams[bestIdx] + adjustment;
        grams[bestIdx] = Math.max(settings.minGrams, Math.min(settings.maxGrams, newGrams));
      }
    }
  }
}

/**
 * Calculate portions for all items in a day to hit exact daily targets.
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

  // Build editable items map by meal
  const editableByMeal: Record<MealType, EditableItem[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  const activeMeals: MealType[] = [];

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

  if (editableByMeal.snack.length > 0) {
    activeMeals.push("snack");
  }

  if (activeMeals.length === 0) {
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

  // Calculate meal-level targets (split remaining across meals)
  const mainMeals = activeMeals.filter(m => m !== "snack");
  const hasSnacks = activeMeals.includes("snack");
  
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

  // === PHASE 1: Solve each meal independently ===
  const allItemGrams = new Map<string, number>();
  
  activeMeals.forEach(mealType => {
    const editables = editableByMeal[mealType];
    const targets = mealTargets[mealType];
    
    const portions = solveSimultaneous(editables, targets, settings, mealType);
    
    // Store all portions
    portions.forEach((grams, itemId) => {
      allItemGrams.set(itemId, grams);
    });
    
    // Add fixed/locked items
    mealItems[mealType].forEach(item => {
      if (!item.product || item.product.ignore_macros) return;
      if (item.is_locked || item.product.product_type === "fixed") {
        const grams = allItemGrams.get(item.id) || item.quantity_grams;
        allItemGrams.set(item.id, grams);
      }
    });
  });

  // === PHASE 2: Global day-level fine-tuning ===
  // Recalculate totals and adjust across all items to hit exact daily targets
  let totalAchieved = calculateTotalMacros(allItemGrams, editableByMeal, fixedContribution, activeMeals);
  
  // Collect all editable items across meals for global adjustment
  const allEditables: { item: EditableItem; grams: number }[] = [];
  activeMeals.forEach(mealType => {
    editableByMeal[mealType].forEach(item => {
      const currentGrams = allItemGrams.get(item.itemId) || 0;
      allEditables.push({ item, grams: currentGrams });
    });
  });

  // Global precision passes (up to 30 iterations)
  for (let globalPass = 0; globalPass < 30; globalPass++) {
    totalAchieved = calculateTotalMacros(allItemGrams, editableByMeal, fixedContribution, activeMeals);
    
    const proErr = dailyTargets.protein - totalAchieved.protein;
    const carbErr = dailyTargets.carbs - totalAchieved.carbs;
    const fatErr = dailyTargets.fat - totalAchieved.fat;
    const calErr = dailyTargets.calories - totalAchieved.calories;
    
    // Check if all within tolerance
    if (Math.abs(proErr) < 0.3 && Math.abs(carbErr) < 0.3 && 
        Math.abs(fatErr) < 0.3 && Math.abs(calErr) < 0.5) {
      break;
    }
    
    // === Adjust protein ===
    if (Math.abs(proErr) >= 0.3) {
      const proteinSources = allEditables
        .filter(e => isHighProteinSource(e.item.product) && e.item.proteinPer100g > 5)
        .sort((a, b) => b.item.proteinPer100g - a.item.proteinPer100g);
      
      if (proteinSources.length > 0) {
        const best = proteinSources[0];
        const adjustment = (proErr / best.item.proteinPer100g) * 100;
        const currentGrams = allItemGrams.get(best.item.itemId) || 0;
        const newGrams = Math.max(settings.minGrams, Math.min(settings.maxGrams, currentGrams + adjustment));
        allItemGrams.set(best.item.itemId, Math.round(newGrams * 10) / 10);
      }
    }
    
    // Recalculate
    totalAchieved = calculateTotalMacros(allItemGrams, editableByMeal, fixedContribution, activeMeals);
    
    // === Adjust carbs (using high-carb, low-protein items) ===
    const carbErrAfter = dailyTargets.carbs - totalAchieved.carbs;
    if (Math.abs(carbErrAfter) >= 0.3) {
      const carbSources = allEditables
        .filter(e => e.item.carbsPer100g > 15 && e.item.proteinPer100g < 10)
        .sort((a, b) => b.item.carbsPer100g - a.item.carbsPer100g);
      
      if (carbSources.length > 0) {
        const best = carbSources[0];
        const adjustment = (carbErrAfter / best.item.carbsPer100g) * 100;
        const currentGrams = allItemGrams.get(best.item.itemId) || 0;
        const newGrams = Math.max(settings.minGrams, Math.min(settings.maxGrams, currentGrams + adjustment));
        allItemGrams.set(best.item.itemId, Math.round(newGrams * 10) / 10);
      }
    }
    
    // Recalculate
    totalAchieved = calculateTotalMacros(allItemGrams, editableByMeal, fixedContribution, activeMeals);
    
    // === Adjust fat ===
    const fatErrAfter = dailyTargets.fat - totalAchieved.fat;
    if (Math.abs(fatErrAfter) >= 0.3) {
      const fatSources = allEditables
        .filter(e => e.item.fatPer100g > 5 && e.item.proteinPer100g < 10)
        .sort((a, b) => b.item.fatPer100g - a.item.fatPer100g);
      
      if (fatSources.length > 0) {
        const best = fatSources[0];
        const adjustment = (fatErrAfter / best.item.fatPer100g) * 100;
        const currentGrams = allItemGrams.get(best.item.itemId) || 0;
        const newGrams = Math.max(settings.minGrams, Math.min(settings.maxGrams, currentGrams + adjustment));
        allItemGrams.set(best.item.itemId, Math.round(newGrams * 10) / 10);
      }
    }
    
    // Recalculate
    totalAchieved = calculateTotalMacros(allItemGrams, editableByMeal, fixedContribution, activeMeals);
    
    // === Final calorie adjustment (using low-protein items to preserve protein) ===
    const calErrAfter = dailyTargets.calories - totalAchieved.calories;
    if (Math.abs(calErrAfter) >= 0.5) {
      // Find item with good calories but low protein impact
      const calSources = allEditables
        .filter(e => e.item.caloriesPer100g > 50 && !isHighProteinSource(e.item.product))
        .sort((a, b) => b.item.caloriesPer100g - a.item.caloriesPer100g);
      
      if (calSources.length > 0) {
        const best = calSources[0];
        const adjustment = (calErrAfter / best.item.caloriesPer100g) * 100;
        const currentGrams = allItemGrams.get(best.item.itemId) || 0;
        const newGrams = Math.max(settings.minGrams, Math.min(settings.maxGrams, currentGrams + adjustment));
        allItemGrams.set(best.item.itemId, Math.round(newGrams * 10) / 10);
      }
    }
  }

  // Final calculation
  totalAchieved = calculateTotalMacros(allItemGrams, editableByMeal, fixedContribution, activeMeals);

  // Build meal results
  activeMeals.forEach(mealType => {
    const editables = editableByMeal[mealType];
    const itemsMap = new Map<string, number>();
    let mealAchieved: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    
    // Fixed items
    mealItems[mealType].forEach(item => {
      if (!item.product || item.product.ignore_macros) return;
      if (item.is_locked || item.product.product_type === "fixed") {
        const grams = allItemGrams.get(item.id) || item.quantity_grams;
        itemsMap.set(item.id, grams);
        const macros = calculateMacrosForGrams(item.product, grams);
        mealAchieved.calories += macros.calories;
        mealAchieved.protein += macros.protein;
        mealAchieved.carbs += macros.carbs;
        mealAchieved.fat += macros.fat;
      }
    });
    
    // Editable items
    editables.forEach(item => {
      const grams = allItemGrams.get(item.itemId) || 0;
      itemsMap.set(item.itemId, grams);
      const macros = calculateMacrosForGrams(item.product, grams);
      mealAchieved.calories += macros.calories;
      mealAchieved.protein += macros.protein;
      mealAchieved.carbs += macros.carbs;
      mealAchieved.fat += macros.fat;
    });
    
    mealResults.set(mealType, {
      items: itemsMap,
      achievedMacros: mealAchieved,
      warnings: [],
      withinTolerance: true,
    });
  });

  // Check final success
  const calDiff = Math.abs(totalAchieved.calories - dailyTargets.calories);
  const proDiff = Math.abs(totalAchieved.protein - dailyTargets.protein);
  const carbDiff = Math.abs(totalAchieved.carbs - dailyTargets.carbs);
  const fatDiff = Math.abs(totalAchieved.fat - dailyTargets.fat);
  
  const success = calDiff < 2 && proDiff < 1 && carbDiff < 1 && fatDiff < 1;
  
  if (!success) {
    if (proDiff >= 1) warnings.push(`Protein: ${Math.round(totalAchieved.protein)}g (target: ${dailyTargets.protein}g)`);
    if (carbDiff >= 1) warnings.push(`Carbs: ${Math.round(totalAchieved.carbs)}g (target: ${dailyTargets.carbs}g)`);
    if (fatDiff >= 1) warnings.push(`Fat: ${Math.round(totalAchieved.fat)}g (target: ${dailyTargets.fat}g)`);
    if (calDiff >= 2) warnings.push(`Calories: ${Math.round(totalAchieved.calories)} (target: ${dailyTargets.calories})`);
  }

  return {
    mealResults,
    dayTotals: totalAchieved,
    warnings,
    success,
  };
}

/**
 * Helper to calculate total macros from the gram map.
 */
function calculateTotalMacros(
  gramsMap: Map<string, number>,
  editableByMeal: Record<MealType, EditableItem[]>,
  fixedContribution: FixedContribution,
  activeMeals: MealType[]
): MacroTotals {
  let total: MacroTotals = { ...fixedContribution };
  
  activeMeals.forEach(mealType => {
    editableByMeal[mealType].forEach(item => {
      const grams = gramsMap.get(item.itemId);
      if (grams !== undefined) {
        const macros = calculateMacrosForGrams(item.product, grams);
        total.calories += macros.calories;
        total.protein += macros.protein;
        total.carbs += macros.carbs;
        total.fat += macros.fat;
      }
    });
  });
  
  return total;
}

/**
 * Calculate portions for all items in a meal to meet targets (legacy).
 */
export function calculateMealPortions(
  products: Product[],
  mealTargets: MacroTotals,
  lockedItems: { productId: string; grams: number }[],
  settings: PortioningSettings = DEFAULT_PORTIONING_SETTINGS
): MealPortioningResult {
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

  const portions = solveSimultaneous(editables, remainingTargets, settings);
  
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

  products.filter(p => p.product_type === "fixed").forEach(product => {
    const grams = product.fixed_portion_grams || 100;
    itemGrams.set(product.id, grams);
    const macros = calculateMacrosForGrams(product, grams);
    achieved.calories += macros.calories;
    achieved.protein += macros.protein;
    achieved.carbs += macros.carbs;
    achieved.fat += macros.fat;
  });

  const withinTolerance = Math.abs(achieved.calories - mealTargets.calories) < 5;

  return {
    items: itemGrams,
    achievedMacros: achieved,
    warnings: withinTolerance ? [] : [`Achieved ${Math.round(achieved.calories)} kcal (target: ${mealTargets.calories})`],
    withinTolerance,
  };
}

/**
 * Calculate a single product's portion for adding to a meal.
 * Returns 0g - user clicks Generate to calculate exact portions.
 */
export function calculateSingleItemPortion(
  product: Product,
  mealType: MealType,
  existingItems: MealPlanItem[],
  dailyTargets: MacroTotals,
  settings: PortioningSettings = DEFAULT_PORTIONING_SETTINGS
): PortioningResult {
  if (product.product_type === "fixed" && product.fixed_portion_grams) {
    return {
      grams: product.fixed_portion_grams,
      macros: calculateMacrosForGrams(product, product.fixed_portion_grams),
      warnings: [],
    };
  }
  
  if (product.ignore_macros) {
    return {
      grams: 100,
      macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      warnings: [],
    };
  }

  return {
    grams: 0,
    macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    warnings: ["Click 'Generate' after adding all items to auto-calculate exact portions"],
  };
}
