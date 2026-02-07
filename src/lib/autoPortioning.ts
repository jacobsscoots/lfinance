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
/**
 * Check if a product is a high-protein source (yogurt, chicken, fish, eggs, etc.)
 */
function isHighProteinSource(product: Product): boolean {
  const name = product.name.toLowerCase();
  const proteinKeywords = ["yogurt", "yoghurt", "chicken", "fish", "salmon", "tuna", "cod", "egg", "beef", "turkey", "pork", "prawn", "shrimp", "tofu", "tempeh", "lean"];
  return proteinKeywords.some(kw => name.includes(kw)) || product.protein_per_100g > 15;
}

/**
 * Get breakfast role for a product: "base" (yogurt), "secondary" (fruit), "topper" (granola)
 */
function getBreakfastRole(product: Product): "base" | "secondary" | "topper" | "other" {
  const name = product.name.toLowerCase();
  
  // Yogurt is the main base
  if (name.includes("yogurt") || name.includes("yoghurt")) {
    return "base";
  }
  
  // Fruit is secondary
  const fruitKeywords = ["fruit", "berry", "berries", "banana", "apple", "mango", "strawberry", "blueberry", "raspberry"];
  if (fruitKeywords.some(kw => name.includes(kw)) || product.food_type === "fruit") {
    return "secondary";
  }
  
  // Granola/cereal is just a topper
  const topperKeywords = ["granola", "muesli", "cereal", "oat", "crunchy", "topper"];
  if (topperKeywords.some(kw => name.includes(kw))) {
    return "topper";
  }
  
  return "other";
}

/**
 * Solve for exact grams using weighted least squares optimization.
 * Prioritizes: PROTEIN FIRST (exact), then Calories, then Carbs/Fat
 */
function solveExactPortions(
  items: EditableItem[],
  targetMacros: MacroTotals,
  settings: PortioningSettings,
  mealType?: MealType
): Map<string, number> {
  const result = new Map<string, number>();
  
  if (items.length === 0) return result;

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

  const n = items.length;
  const grams: number[] = new Array(n).fill(50); // Start with modest portions

  // Calculate current totals helper
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

  // === BREAKFAST SPECIAL HANDLING ===
  // Apply composition rules: yogurt = base (large), fruit = secondary (medium), granola = topper (small)
  if (mealType === "breakfast") {
    const baseItems: number[] = [];
    const secondaryItems: number[] = [];
    const topperItems: number[] = [];
    const otherItems: number[] = [];
    
    items.forEach((item, idx) => {
      const role = getBreakfastRole(item.product);
      switch (role) {
        case "base": baseItems.push(idx); break;
        case "secondary": secondaryItems.push(idx); break;
        case "topper": topperItems.push(idx); break;
        default: otherItems.push(idx); break;
      }
    });
    
    // Set initial proportions based on role
    // Base (yogurt): ~50-60% of calories
    // Secondary (fruit): ~25-35% of calories  
    // Topper (granola): ~10-15% of calories (small amount)
    const baseRatio = baseItems.length > 0 ? 0.55 : 0;
    const secondaryRatio = secondaryItems.length > 0 ? 0.30 : 0;
    const topperRatio = topperItems.length > 0 ? 0.10 : 0;
    const otherRatio = 1 - baseRatio - secondaryRatio - topperRatio;
    
    // Distribute base items (yogurt - largest portions)
    if (baseItems.length > 0) {
      const baseCalTarget = targetMacros.calories * baseRatio / baseItems.length;
      baseItems.forEach(idx => {
        if (items[idx].caloriesPer100g > 0) {
          grams[idx] = Math.max(settings.minGrams, Math.min(settings.maxGrams, 
            (baseCalTarget / items[idx].caloriesPer100g) * 100
          ));
        }
      });
    }
    
    // Distribute secondary items (fruit - medium portions)
    if (secondaryItems.length > 0) {
      const secondaryCalTarget = targetMacros.calories * secondaryRatio / secondaryItems.length;
      secondaryItems.forEach(idx => {
        if (items[idx].caloriesPer100g > 0) {
          grams[idx] = Math.max(settings.minGrams, Math.min(settings.maxGrams,
            (secondaryCalTarget / items[idx].caloriesPer100g) * 100
          ));
        }
      });
    }
    
    // Distribute topper items (granola - SMALL portions, max ~30-40g)
    if (topperItems.length > 0) {
      const topperCalTarget = targetMacros.calories * topperRatio / topperItems.length;
      topperItems.forEach(idx => {
        if (items[idx].caloriesPer100g > 0) {
          // Cap granola at 40g regardless of calorie needs
          grams[idx] = Math.max(settings.minGrams, Math.min(40,
            (topperCalTarget / items[idx].caloriesPer100g) * 100
          ));
        } else {
          grams[idx] = 30; // Default small topper
        }
      });
    }
    
    // Other items get remaining calories
    if (otherItems.length > 0 && otherRatio > 0) {
      const otherCalTarget = targetMacros.calories * otherRatio / otherItems.length;
      otherItems.forEach(idx => {
        if (items[idx].caloriesPer100g > 0) {
          grams[idx] = Math.max(settings.minGrams, Math.min(settings.maxGrams,
            (otherCalTarget / items[idx].caloriesPer100g) * 100
          ));
        }
      });
    }
  } else {
    // === NON-BREAKFAST: Standard protein-first approach ===
    
    // Separate items by primary macro contribution
    const proteinItems: number[] = [];
    const carbItems: number[] = [];
    const fatItems: number[] = [];
    const otherItems: number[] = [];
    
    items.forEach((item, idx) => {
      if (isHighProteinSource(item.product) || item.foodType === "protein" || item.proteinPer100g > 15) {
        proteinItems.push(idx);
      } else if (item.foodType === "carb" || item.carbsPer100g > 30) {
        carbItems.push(idx);
      } else if (item.foodType === "fat" || item.fatPer100g > 15) {
        fatItems.push(idx);
      } else {
        otherItems.push(idx);
      }
    });

    // Phase 1: Size protein sources to hit protein target EXACTLY
    if (proteinItems.length > 0 && targetMacros.protein > 0) {
      const totalProteinPer100g = proteinItems.reduce((sum, idx) => sum + items[idx].proteinPer100g, 0);
      if (totalProteinPer100g > 0) {
        // Calculate exact grams needed to hit protein
        const baseGrams = (targetMacros.protein / totalProteinPer100g) * 100;
        proteinItems.forEach(idx => {
          grams[idx] = Math.max(settings.minGrams, Math.min(settings.maxGrams, baseGrams));
        });
      }
    }

    // Phase 2: Adjust carb/other sources to fill remaining calories
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

    // Phase 3: Fine-tune with other/fat items
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
  }

  // === PHASE 4: PROTEIN PRECISION PASS ===
  // Adjust protein sources to hit EXACT protein target (within 0.5g)
  let currentTotals = calcTotals();
  let proteinDiff = targetMacros.protein - currentTotals.protein;
  
  if (Math.abs(proteinDiff) > 0.5) {
    // Find high-protein items to adjust
    const proteinSourceIndices = items
      .map((item, idx) => ({ idx, item, isProtein: isHighProteinSource(item.product) }))
      .filter(x => x.isProtein && x.item.proteinPer100g > 5)
      .sort((a, b) => b.item.proteinPer100g - a.item.proteinPer100g);
    
    for (const { idx, item } of proteinSourceIndices) {
      if (Math.abs(proteinDiff) < 0.5) break;
      
      const proteinPer100g = item.proteinPer100g;
      if (proteinPer100g <= 0) continue;
      
      // Calculate how many grams to add/remove to close the gap
      const gramsNeeded = (proteinDiff / proteinPer100g) * 100;
      const newGrams = grams[idx] + gramsNeeded;
      const clampedGrams = Math.max(settings.minGrams, Math.min(settings.maxGrams, newGrams));
      const actualChange = clampedGrams - grams[idx];
      
      grams[idx] = clampedGrams;
      proteinDiff -= (actualChange / 100) * proteinPer100g;
    }
  }

  // === PHASE 5: FINAL CALORIE ADJUSTMENT ===
  // After protein is locked in, adjust non-protein items to hit calorie target
  currentTotals = calcTotals();
  let calDiff = targetMacros.calories - currentTotals.calories;
  
  if (Math.abs(calDiff) > 1) {
    // Find non-protein items to adjust (prefer carbs)
    const adjustableIndices = items
      .map((item, idx) => ({ idx, item, isProtein: isHighProteinSource(item.product) }))
      .filter(x => !x.isProtein && x.item.caloriesPer100g > 0)
      .sort((a, b) => b.item.caloriesPer100g - a.item.caloriesPer100g);
    
    for (const { idx, item } of adjustableIndices) {
      if (Math.abs(calDiff) < 1) break;
      
      const calsPer100g = item.caloriesPer100g;
      const gramsNeeded = (calDiff / calsPer100g) * 100;
      const newGrams = grams[idx] + gramsNeeded;
      const clampedGrams = Math.max(settings.minGrams, Math.min(settings.maxGrams, newGrams));
      const actualChange = clampedGrams - grams[idx];
      
      grams[idx] = clampedGrams;
      calDiff -= (actualChange / 100) * calsPer100g;
    }
  }

  // Store results (round to 1 decimal for clean display)
  for (let i = 0; i < n; i++) {
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
    
    const portions = solveExactPortions(editables, targets, settings, mealType);
    
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

  // === FINAL PROTEIN PRECISION PASS ===
  // Adjust protein sources across all meals to hit EXACT daily protein target
  let proteinDiff = dailyTargets.protein - totalAchieved.protein;
  
  if (Math.abs(proteinDiff) > 0.5) {
    // Collect all protein sources across meals
    const proteinSources: { itemId: string; product: Product; currentGrams: number; proteinPer100g: number }[] = [];
    
    activeMeals.forEach(mealType => {
      editableByMeal[mealType].forEach(item => {
        if (isHighProteinSource(item.product) && item.proteinPer100g > 5) {
          proteinSources.push({
            itemId: item.itemId,
            product: item.product,
            currentGrams: allItemGrams.get(item.itemId) || 0,
            proteinPer100g: item.proteinPer100g,
          });
        }
      });
    });
    
    // Sort by protein density (highest first for efficient adjustment)
    proteinSources.sort((a, b) => b.proteinPer100g - a.proteinPer100g);
    
    for (const source of proteinSources) {
      if (Math.abs(proteinDiff) < 0.5) break;
      
      const gramsNeeded = (proteinDiff / source.proteinPer100g) * 100;
      const newGrams = source.currentGrams + gramsNeeded;
      const clampedGrams = Math.max(settings.minGrams, Math.min(settings.maxGrams, newGrams));
      const actualChange = clampedGrams - source.currentGrams;
      
      allItemGrams.set(source.itemId, Math.round(clampedGrams * 10) / 10);
      proteinDiff -= (actualChange / 100) * source.proteinPer100g;
      
      // Update the source's current grams for next iteration
      source.currentGrams = clampedGrams;
    }
    
    // Recalculate totals after protein adjustment
    totalAchieved = { ...fixedContribution };
    allItemGrams.forEach((grams, itemId) => {
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

  // === FINAL CALORIE ADJUSTMENT (using non-protein items) ===
  const calDiff = dailyTargets.calories - totalAchieved.calories;
  
  if (Math.abs(calDiff) > 1) {
    // Find best NON-PROTEIN item to adjust (to preserve protein target)
    let bestItemId: string | null = null;
    let bestCalPer100g = 0;
    let bestCurrentGrams = 0;
    
    activeMeals.forEach(mealType => {
      editableByMeal[mealType].forEach(item => {
        // Skip protein sources to preserve protein target
        if (isHighProteinSource(item.product)) return;
        
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
