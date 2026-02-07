/**
 * Auto-portioning algorithm for Target-Based meal planning.
 * Calculates optimal gram quantities for items to meet daily targets.
 */

import { Product } from "@/hooks/useProducts";
import { MealPlanItem, MealType } from "@/hooks/useMealPlanItems";
import { MacroTotals } from "./mealCalculations";

export type FoodType = "protein" | "carb" | "fat" | "veg" | "fruit" | "dairy" | "sauce" | "treat" | "other";

export interface PortioningSettings {
  minGrams: number;
  maxGrams: number;
  rounding: number; // Round to nearest X grams
  tolerancePercent: number; // Acceptable deviation from target
}

export const DEFAULT_PORTIONING_SETTINGS: PortioningSettings = {
  minGrams: 10,
  maxGrams: 500,
  rounding: 5,
  tolerancePercent: 2,
};

export interface PortioningResult {
  grams: number;
  macros: MacroTotals;
  warnings: string[];
}

export interface MealPortioningResult {
  items: Map<string, number>; // product_id -> grams
  achievedMacros: MacroTotals;
  warnings: string[];
  withinTolerance: boolean;
}

/**
 * Round a value to the nearest multiple of `rounding`.
 */
function roundTo(value: number, rounding: number): number {
  if (rounding <= 0) return Math.round(value);
  return Math.round(value / rounding) * rounding;
}

/**
 * Clamp a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
  
  // If no eligibility set, allow all meals (backwards compatibility)
  if (!eligibility || eligibility.length === 0) {
    return true;
  }
  
  return eligibility.includes(mealType);
}

/**
 * Get products that are not allowed for a specific meal.
 */
export function getIneligibleProducts(products: Product[], mealType: MealType): Product[] {
  return products.filter(p => !isProductAllowedForMeal(p, mealType));
}

/**
 * Calculate optimal grams for a single product to contribute towards remaining targets.
 * Uses protein-first approach: high-protein foods are sized by protein need.
 */
export function calculateOptimalGrams(
  product: Product,
  remainingTargets: MacroTotals,
  existingItems: { product: Product; grams: number }[],
  settings: PortioningSettings = DEFAULT_PORTIONING_SETTINGS
): PortioningResult {
  const warnings: string[] = [];
  
  // Handle fixed-portion products
  if (product.product_type === "fixed" && product.fixed_portion_grams) {
    const grams = product.fixed_portion_grams;
    return {
      grams,
      macros: calculateMacrosForGrams(product, grams),
      warnings: [],
    };
  }
  
  // Handle ignore_macros products (just use default portion)
  if (product.ignore_macros) {
    const grams = settings.rounding > 0 
      ? roundTo(100, settings.rounding) 
      : 100;
    return {
      grams: clamp(grams, settings.minGrams, settings.maxGrams),
      macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      warnings: [],
    };
  }
  
  const proteinPer100g = product.protein_per_100g || 0;
  const calsPer100g = product.calories_per_100g || 0;
  
  let targetGrams: number;
  
  // Protein-first approach
  if (proteinPer100g > 15) {
    // High-protein food - size by protein need
    if (remainingTargets.protein > 0) {
      targetGrams = (remainingTargets.protein / proteinPer100g) * 100;
    } else {
      // No more protein needed, use minimum portion
      targetGrams = settings.minGrams;
      warnings.push("Protein target already met, using minimum portion");
    }
  } else if (calsPer100g > 0) {
    // Size by calorie need
    if (remainingTargets.calories > 0) {
      targetGrams = (remainingTargets.calories / calsPer100g) * 100;
    } else {
      // No more calories needed
      targetGrams = settings.minGrams;
      warnings.push("Calorie target already met, using minimum portion");
    }
  } else {
    // Product has no meaningful nutrition, use default
    targetGrams = 100;
  }
  
  // Apply constraints
  let finalGrams = roundTo(targetGrams, settings.rounding);
  finalGrams = clamp(finalGrams, settings.minGrams, settings.maxGrams);
  
  const macros = calculateMacrosForGrams(product, finalGrams);
  
  return { grams: finalGrams, macros, warnings };
}

/**
 * Calculate portions for all items in a meal to meet targets.
 * Items are processed in priority order: protein sources first, then others.
 */
export function calculateMealPortions(
  products: Product[],
  mealTargets: MacroTotals,
  lockedItems: { productId: string; grams: number }[],
  settings: PortioningSettings = DEFAULT_PORTIONING_SETTINGS
): MealPortioningResult {
  const warnings: string[] = [];
  const itemGrams = new Map<string, number>();
  
  // Start with locked items contribution
  let achieved: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  
  for (const locked of lockedItems) {
    const product = products.find(p => p.id === locked.productId);
    if (product) {
      const macros = calculateMacrosForGrams(product, locked.grams);
      achieved.calories += macros.calories;
      achieved.protein += macros.protein;
      achieved.carbs += macros.carbs;
      achieved.fat += macros.fat;
      itemGrams.set(locked.productId, locked.grams);
    }
  }
  
  // Get remaining targets
  const remaining: MacroTotals = {
    calories: Math.max(0, mealTargets.calories - achieved.calories),
    protein: Math.max(0, mealTargets.protein - achieved.protein),
    carbs: Math.max(0, mealTargets.carbs - achieved.carbs),
    fat: Math.max(0, mealTargets.fat - achieved.fat),
  };
  
  // Get unlocked, editable products
  const editableProducts = products.filter(p => 
    p.product_type === "editable" && 
    !p.ignore_macros &&
    !lockedItems.some(l => l.productId === p.id)
  );
  
  // Sort by protein density (high protein first)
  const sortedProducts = [...editableProducts].sort((a, b) => 
    (b.protein_per_100g || 0) - (a.protein_per_100g || 0)
  );
  
  // Calculate portions for each product
  const existingItems: { product: Product; grams: number }[] = [];
  
  for (const product of sortedProducts) {
    const currentRemaining = {
      calories: Math.max(0, mealTargets.calories - achieved.calories),
      protein: Math.max(0, mealTargets.protein - achieved.protein),
      carbs: Math.max(0, mealTargets.carbs - achieved.carbs),
      fat: Math.max(0, mealTargets.fat - achieved.fat),
    };
    
    const result = calculateOptimalGrams(product, currentRemaining, existingItems, settings);
    
    itemGrams.set(product.id, result.grams);
    warnings.push(...result.warnings);
    
    achieved.calories += result.macros.calories;
    achieved.protein += result.macros.protein;
    achieved.carbs += result.macros.carbs;
    achieved.fat += result.macros.fat;
    
    existingItems.push({ product, grams: result.grams });
  }
  
  // Handle fixed-portion products
  const fixedProducts = products.filter(p => 
    p.product_type === "fixed" &&
    !lockedItems.some(l => l.productId === p.id)
  );
  
  for (const product of fixedProducts) {
    const grams = product.fixed_portion_grams || 100;
    const macros = calculateMacrosForGrams(product, grams);
    
    itemGrams.set(product.id, grams);
    achieved.calories += macros.calories;
    achieved.protein += macros.protein;
    achieved.carbs += macros.carbs;
    achieved.fat += macros.fat;
  }
  
  // Check if within tolerance
  const calorieDiff = Math.abs(achieved.calories - mealTargets.calories);
  const calorieTolerance = mealTargets.calories * (settings.tolerancePercent / 100);
  const proteinDiff = Math.abs(achieved.protein - mealTargets.protein);
  const proteinTolerance = mealTargets.protein * (settings.tolerancePercent / 100);
  
  const withinTolerance = calorieDiff <= calorieTolerance && proteinDiff <= proteinTolerance;
  
  if (!withinTolerance) {
    if (calorieDiff > calorieTolerance) {
      warnings.push(`Calories ${achieved.calories > mealTargets.calories ? 'over' : 'under'} by ${Math.round(calorieDiff)} kcal`);
    }
    if (proteinDiff > proteinTolerance) {
      warnings.push(`Protein ${achieved.protein > mealTargets.protein ? 'over' : 'under'} by ${Math.round(proteinDiff)}g`);
    }
  }
  
  return {
    items: itemGrams,
    achievedMacros: achieved,
    warnings,
    withinTolerance,
  };
}

/**
 * Calculate a single product's portion for adding to a meal.
 * This is used in the "Add item" dialog in target mode.
 */
export function calculateSingleItemPortion(
  product: Product,
  mealType: MealType,
  existingItems: MealPlanItem[],
  dailyTargets: MacroTotals,
  settings: PortioningSettings = DEFAULT_PORTIONING_SETTINGS
): PortioningResult {
  // Calculate what's already consumed today
  const existingMacros = existingItems.reduce(
    (acc, item) => {
      if (!item.product || item.product.ignore_macros) return acc;
      const macros = calculateMacrosForGrams(item.product, item.quantity_grams);
      return {
        calories: acc.calories + macros.calories,
        protein: acc.protein + macros.protein,
        carbs: acc.carbs + macros.carbs,
        fat: acc.fat + macros.fat,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  
  // Remaining targets
  const remaining: MacroTotals = {
    calories: Math.max(0, dailyTargets.calories - existingMacros.calories),
    protein: Math.max(0, dailyTargets.protein - existingMacros.protein),
    carbs: Math.max(0, dailyTargets.carbs - existingMacros.carbs),
    fat: Math.max(0, dailyTargets.fat - existingMacros.fat),
  };
  
  // For a typical day with 4 meals, divide remaining by meals left
  // This is a simplistic approach - could be enhanced with meal-specific targets
  const mealsRemaining = 4; // Simplified - could track actual remaining meals
  const mealShare: MacroTotals = {
    calories: remaining.calories / mealsRemaining,
    protein: remaining.protein / mealsRemaining,
    carbs: remaining.carbs / mealsRemaining,
    fat: remaining.fat / mealsRemaining,
  };
  
  return calculateOptimalGrams(
    product,
    mealShare,
    existingItems.map(i => ({ product: i.product!, grams: i.quantity_grams })).filter(x => x.product),
    settings
  );
}
