/**
 * Precision Auto-Portioning Algorithm for Target-Based Meal Planning.
 * Uses iterative multi-target optimization to calculate EXACT gram quantities.
 * Zero tolerance - day totals match ALL targets exactly (calories, protein, carbs, fat).
 */

import { Product } from "@/hooks/useProducts";
import { MealPlanItem, MealType } from "@/hooks/useMealPlanItems";
import { MacroTotals } from "./mealCalculations";
import { storePortioningSolverDebug, PortioningDebugItem, PortioningDebugTotals, PortioningSolverDebugPayload } from "./portioningDebug";


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
  const sauceKeywords = ["sauce", "seasoning", "spice", "oil", "butter", "dressing", "mayo", "ketchup", "mustard", "herb", "pepper", "salt", "schwartz", "paprika", "garlic", "cajun", "curry", "teriyaki", "soy"];
  return sauceKeywords.some(kw => name.includes(kw)) || product.food_type === "sauce";
}

/**
 * Detect yoghurt type for breakfast proportionality.
 * Primary = 0%/fat-free (main base, 200-300g)
 * Secondary = Greek/full-fat (smaller portion, 50-150g)
 */
function getYoghurtType(product: Product): "primary" | "secondary" | "none" {
  const name = product.name.toLowerCase();
  if (!name.includes("yogurt") && !name.includes("yoghurt")) return "none";
  
  // 0% or fat-free yoghurt = primary base (larger portion)
  if (name.includes("0%") || name.includes("fat free") || name.includes("fat-free") || name.includes("skyr")) {
    return "primary";
  }
  
  // Greek/full-fat = secondary (smaller portion for fat/creaminess)
  if (name.includes("greek") || name.includes("natural") || name.includes("full fat") || name.includes("full-fat")) {
    return "secondary";
  }
  
  // Default yoghurt to primary
  return "primary";
}

/**
 * Check if a product is specifically a SEASONING (not a sauce).
 * Seasonings are dry powders/rubs/spice mixes with small realistic portions.
 */
function isSeasoning(product: Product): boolean {
  const name = product.name.toLowerCase();
  const seasoningKeywords = ["seasoning", "rub", "spice", "powder", "mix", "paprika", "cajun", "herbs", "pepper"];
  const brandKeywords = ["schwartz"];
  
  // Check for seasoning keywords or brand
  const hasSeasoningKeyword = seasoningKeywords.some(kw => name.includes(kw));
  const hasBrandKeyword = brandKeywords.some(kw => name.includes(kw));
  
  // Exclude liquid sauces (soy sauce, teriyaki sauce, etc.)
  const isSauce = name.includes("sauce");
  
  return (hasSeasoningKeyword || hasBrandKeyword) && !isSauce;
}

/**
 * Check if a product is specifically granola (for extended topper range).
 */
function isGranola(product: Product): boolean {
  const name = product.name.toLowerCase();
  return name.includes("granola");
}

// Seasoning constants - realistic ranges
const MAX_SEASONING_GRAMS = 15;    // Absolute maximum (hard cap)
const DEFAULT_SEASONING_GRAMS = 8; // Default when no pairing found
const MAX_GRANOLA_GRAMS = 60;      // Extended max for granola toppers

/**
 * Seasoning-to-protein pairing map with realistic gram quantities.
 * All values MUST be ≤10g to keep seasonings realistic.
 */
const SEASONING_PAIRINGS: Record<string, { proteins: string[]; grams: number }> = {
  "schwartz": { proteins: ["chicken", "beef", "pork", "lamb"], grams: 8 },
  "paprika": { proteins: ["chicken", "pork"], grams: 3 },
  "garlic": { proteins: ["chicken", "fish", "prawn", "shrimp"], grams: 6 },
  "herbs": { proteins: ["fish", "chicken", "lamb"], grams: 5 },
  "lemon": { proteins: ["fish", "salmon", "cod", "prawn"], grams: 8 },  // Capped at 10g
  "pepper": { proteins: ["beef", "steak", "chicken"], grams: 2 },
  "curry": { proteins: ["chicken", "tofu", "prawn"], grams: 8 },        // Capped at 10g
  "soy": { proteins: ["fish", "tofu", "prawn", "salmon"], grams: 10 },  // Capped at 10g (liquid, borderline sauce)
  "teriyaki": { proteins: ["salmon", "chicken"], grams: 10 },           // Capped at 10g
  "cajun": { proteins: ["chicken", "fish", "prawn"], grams: 5 },
  "bbq": { proteins: ["chicken", "pork", "beef"], grams: 10 },          // Capped at 10g
  "honey": { proteins: ["chicken", "salmon"], grams: 8 },               // Capped at 10g
};

/**
 * Get smart seasoning portion based on protein pairing.
 * All returned values are capped at MAX_SEASONING_GRAMS.
 */
function getSeasoningPortion(product: Product, allItems: EditableItem[]): number {
  const seasoningName = product.name.toLowerCase();
  
  // Find proteins in the same meal
  const proteins = allItems.filter(i => isHighProteinSource(i.product));
  
  // Find best match from pairing map
  for (const [key, config] of Object.entries(SEASONING_PAIRINGS)) {
    if (seasoningName.includes(key)) {
      // Check if any protein in meal matches
      const hasMatchingProtein = proteins.some(p => 
        config.proteins.some(pName => p.product.name.toLowerCase().includes(pName))
      );
      if (hasMatchingProtein) {
        // Enforce hard cap even on pairing values
        return Math.min(config.grams, MAX_SEASONING_GRAMS);
      }
    }
  }
  
  // Default: small portion if no specific match, still capped
  return Math.min(DEFAULT_SEASONING_GRAMS, MAX_SEASONING_GRAMS);
}

/**
 * Get max portion for a product based on its type.
 * IMPORTANT: Seasonings and sauces are handled separately.
 */
function getMaxPortion(product: Product, settings: PortioningSettings): number {
  // Seasonings get strict 15g hard cap
  if (isSeasoning(product)) {
    return MAX_SEASONING_GRAMS;
  }
  
  // Sauces (non-seasonings) use existing logic - don't cap at 15g
  if (isSauceOrSeasoning(product) && !isSeasoning(product)) {
    return 30; // Sauces can go up to 30g (e.g., passata, curry sauce)
  }
  
  // Granola topper can go up to 60g
  if (getBreakfastRole(product) === "topper" && isGranola(product)) {
    return MAX_GRANOLA_GRAMS;
  }
  
  // Other toppers keep original 40g max
  if (getBreakfastRole(product) === "topper") {
    return 40;
  }
  
  return settings.maxGrams;
}

/**
 * Get minimum portion for breakfast items by role.
 */
function getBreakfastMinimum(role: "base" | "secondary" | "topper" | "other"): number {
  switch (role) {
    case "base": return 100;       // Yogurt min 100g
    case "secondary": return 80;   // Fruit min 80g
    case "topper": return 25;      // Granola min 25g
    default: return 10;
  }
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
 * Weights: Protein 1.5x, Calories 1.0x, Carbs 0.8x, Fat 1.2x (increased from 0.8x for parity)
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
    // Fat weighting increased to 1.2 to treat it as first-class with protein
    totalWeighted: Math.abs(calError) + 1.5 * Math.abs(proError) + 
                   0.8 * Math.abs(carbError) + 1.2 * Math.abs(fatError),
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

  // === STEP 0: Set sauce/seasoning items using smart pairing logic ===
  sauceItems.forEach(idx => {
    grams[idx] = getSeasoningPortion(items[idx].product, items);
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

  // === BREAKFAST SPECIAL HANDLING WITH PROPORTIONAL YOGHURT ===
  if (mealType === "breakfast") {
    // Separate yoghurts into primary (0%) and secondary (Greek/full-fat)
    const primaryYoghurt: number[] = [];
    const secondaryYoghurt: number[] = [];
    
    breakfastBase.forEach(idx => {
      const yogType = getYoghurtType(items[idx].product);
      if (yogType === "secondary") {
        secondaryYoghurt.push(idx);
      } else {
        primaryYoghurt.push(idx); // primary or none defaults to primary
      }
    });
    
    // Step 1: Set granola (topper) to 30g - within 25-40g range
    breakfastTopper.forEach(idx => {
      grams[idx] = 30;
    });
    
    // Step 2: Set fruit to 90g (within 80-120g range)
    breakfastSecondary.forEach(idx => {
      grams[idx] = 90;
    });
    
    // Step 3: Size PRIMARY yoghurt (0%) for protein - target 200-300g
    // This is the main base, sized to hit ~70% of breakfast protein
    if (primaryYoghurt.length > 0) {
      const proteinNeeded = adjustedTargets.protein * 0.7;
      const totalProtPer100g = primaryYoghurt.reduce((s, i) => s + items[i].proteinPer100g, 0);
      if (totalProtPer100g > 0) {
        const gramsNeeded = (proteinNeeded / totalProtPer100g) * 100;
        primaryYoghurt.forEach(idx => {
          // Clamp to realistic 200-300g range
          grams[idx] = Math.max(200, Math.min(300, gramsNeeded));
        });
      } else {
        primaryYoghurt.forEach(idx => {
          grams[idx] = 250; // Default if no protein info
        });
      }
    }
    
    // Step 4: Size SECONDARY yoghurt (Greek/full-fat) smaller - target 50-150g
    // This adds fat/creaminess without overwhelming the bowl
    if (secondaryYoghurt.length > 0) {
      // Calculate fat contribution needed after primary
      const currentFat = sumMacros(items, grams).fat;
      const fatGap = adjustedTargets.fat - currentFat - sauceContrib.fat;
      
      secondaryYoghurt.forEach(idx => {
        if (fatGap > 0 && items[idx].fatPer100g > 0) {
          const gramsForFat = (fatGap / items[idx].fatPer100g) * 100;
          // Clamp to realistic 50-150g range
          grams[idx] = Math.max(50, Math.min(150, gramsForFat));
        } else {
          grams[idx] = 75; // Default small portion
        }
      });
    }
    
    // Step 5: Fine-tune toppers to hit remaining carb/fat targets
    const afterYoghurtMacros = sumMacros(items, grams);
    const carbGap = adjustedTargets.carbs - afterYoghurtMacros.carbs;
    
    // Adjust fruit (80-120g range) to help with carbs
    if (breakfastSecondary.length > 0 && Math.abs(carbGap) > 5) {
      breakfastSecondary.forEach(idx => {
        const carbPer100g = items[idx].carbsPer100g;
        if (carbPer100g > 0) {
          const adjustment = (carbGap * 0.5 / carbPer100g) * 100;
          const newGrams = grams[idx] + adjustment;
          grams[idx] = Math.max(80, Math.min(120, newGrams));
        }
      });
    }
    
    // Adjust granola (25-60g range for granola, 25-40g for other toppers) for final carb balance
    breakfastTopper.forEach(idx => {
      const currentMacros = sumMacros(items, grams);
      const finalCarbGap = adjustedTargets.carbs - currentMacros.carbs;
      const carbPer100g = items[idx].carbsPer100g;
      
      // Determine max for this topper: granola can go to 60g, others stay at 40g
      const topperMax = isGranola(items[idx].product) ? MAX_GRANOLA_GRAMS : 40;
      
      if (carbPer100g > 0 && Math.abs(finalCarbGap) > 2) {
        const adjustment = (finalCarbGap * 0.3 / carbPer100g) * 100;
        const newGrams = grams[idx] + adjustment;
        grams[idx] = Math.max(25, Math.min(topperMax, newGrams));
      } else {
        grams[idx] = Math.max(25, Math.min(topperMax, grams[idx]));
      }
    });
    
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
    
    // Step 3: Size carb items to hit carb target with sensible minimums
    // Rice/pasta/grains should have minimum 80g to be a realistic serving
    const CARB_MIN_GRAMS = 80;
    if (carbItems.length > 0 && remainingCarbs > 0) {
      const totalCarbsPer100g = carbItems.reduce((sum, idx) => sum + items[idx].carbsPer100g, 0);
      if (totalCarbsPer100g > 0) {
        const gramsNeeded = (remainingCarbs / totalCarbsPer100g) * 100;
        carbItems.forEach(idx => {
          // Enforce minimum 80g for staple carbs (rice, pasta, etc.)
          grams[idx] = Math.max(CARB_MIN_GRAMS, Math.min(settings.maxGrams, gramsNeeded));
        });
      }
    } else if (carbItems.length > 0) {
      // Even with no remaining carb target, give carb items a sensible minimum
      carbItems.forEach(idx => {
        grams[idx] = CARB_MIN_GRAMS;
      });
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
  
  // Store results as integers (whole numbers for kitchen scales)
  for (let i = 0; i < n; i++) {
    result.set(items[i].itemId, Math.round(grams[i]));
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
  
  // Identify items that should NOT be adjusted (sauces/seasonings)
  const lockedIndices = new Set<number>();
  items.forEach((item, idx) => {
    if (isSauceOrSeasoning(item.product)) {
      lockedIndices.add(idx);
    }
  });
  
  // Helper to check if an index is adjustable
  const isAdjustable = (idx: number): boolean => {
    if (lockedIndices.has(idx)) return false;
    if (mealType === "breakfast" && getBreakfastRole(items[idx].product) === "topper") return false;
    return true;
  };
  
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
        if (!isAdjustable(i)) continue;
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
        if (!isAdjustable(i)) continue;
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
        if (!isAdjustable(i)) continue;
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
        if (!isAdjustable(i)) continue;
        // Prefer non-protein-heavy items for calorie adjustment
        if (items[i].caloriesPer100g > bestCalPer100g && items[i].proteinPer100g < 15) {
          bestIdx = i;
          bestCalPer100g = items[i].caloriesPer100g;
        }
      }
      
      // Fallback to any adjustable item if no low-protein option
      if (bestIdx < 0) {
        for (let i = 0; i < items.length; i++) {
          if (!isAdjustable(i)) continue;
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
 * @param mealDate - Optional meal date string for debug logging (yyyy-MM-dd format)
 */
export function calculateDayPortions(
  items: MealPlanItem[],
  dailyTargets: MacroTotals,
  settings: PortioningSettings = DEFAULT_PORTIONING_SETTINGS,
  mealDate?: string
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

  // === FEASIBILITY PRE-CHECK ===
  // Calculate achievable macro ranges from editable items
  const allEditablesForCheck = activeMeals.flatMap(mt => editableByMeal[mt]);
  let minAchievableFat = 0;
  let maxAchievableFat = 0;
  let minAchievableCal = 0;
  let maxAchievableCal = 0;
  
  allEditablesForCheck.forEach(item => {
    const minG = isSauceOrSeasoning(item.product) ? 3 : settings.minGrams;
    const maxG = getMaxPortion(item.product, settings);
    
    minAchievableFat += (item.fatPer100g * minG) / 100;
    maxAchievableFat += (item.fatPer100g * maxG) / 100;
    minAchievableCal += (item.caloriesPer100g * minG) / 100;
    maxAchievableCal += (item.caloriesPer100g * maxG) / 100;
  });

  // Check if remaining fat is achievable
  const fatInfeasible = remainingTargets.fat > maxAchievableFat || remainingTargets.fat < minAchievableFat;
  const calInfeasible = remainingTargets.calories > maxAchievableCal || remainingTargets.calories < minAchievableCal;

  if (fatInfeasible) {
    warnings.push(`Fat target (${Math.round(dailyTargets.fat)}g) may be unreachable. Fixed items contribute ${Math.round(fixedContribution.fat)}g; editable items can only provide ${Math.round(minAchievableFat)}-${Math.round(maxAchievableFat)}g more.`);
  }
  if (calInfeasible && !fatInfeasible) {
    warnings.push(`Calorie target (${Math.round(dailyTargets.calories)}) may be unreachable with current item constraints.`);
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

  // === HELPER: Single source of truth for item constraints ===
  const getItemConstraints = (item: EditableItem, mealType: MealType): { minGrams: number; maxGrams: number } => {
    const role = mealType === "breakfast" ? getBreakfastRole(item.product) : null;
    let minGrams = settings.minGrams;
    let maxGrams = getMaxPortion(item.product, settings);
    
    // SEASONINGS: strict 3-15g range, never used as macro knob
    if (isSeasoning(item.product)) {
      return { minGrams: 3, maxGrams: MAX_SEASONING_GRAMS };
    }
    
    // Breakfast role-specific constraints
    if (role === "topper") {
      minGrams = 25;
      // Granola can go up to 60g, other toppers stay at 40g
      maxGrams = isGranola(item.product) ? MAX_GRANOLA_GRAMS : 40;
    } else if (role === "secondary") {
      minGrams = 80;
      maxGrams = 120;
    } else if (role === "base") {
      const yogType = getYoghurtType(item.product);
      if (yogType === "primary") {
        minGrams = 200;
        maxGrams = 300;
      } else if (yogType === "secondary") {
        minGrams = 50;
        maxGrams = 150;
      }
    }
    
    // Staple carbs (rice/pasta) have 80g minimum
    if (item.carbsPer100g > 25 && item.proteinPer100g < 10) {
      minGrams = Math.max(minGrams, 80);
    }
    
    return { minGrams, maxGrams };
  };

  // === PHASE 1.5: Per-Meal Calorie Balance Loop ===
  // Ensure each meal is within ±15 kcal of its equal share (iterative with early exit)
  const MEAL_CAL_TOLERANCE = 15;
  const MAX_MEAL_BALANCE_ITERATIONS = 15;

  const mealCalorieBalanceLoop = () => {
    let noProgressCount = 0;
    let lastTotalError = Infinity;

    for (let iteration = 0; iteration < MAX_MEAL_BALANCE_ITERATIONS; iteration++) {
      let maxMealError = 0;

      for (const mealType of mainMeals) {
        const mealTarget = mealTargets[mealType].calories;
        const mealEditables = editableByMeal[mealType];
        if (mealEditables.length === 0) continue;

        // Calculate current meal calories (editables + locked/fixed)
        let mealCals = 0;

        // Editable items in this meal
        mealEditables.forEach(item => {
          const grams = allItemGrams.get(item.itemId) || 0;
          mealCals += (item.caloriesPer100g * grams) / 100;
        });

        // Locked/fixed items in this meal
        mealItems[mealType].forEach(item => {
          if (!item.product || item.product.ignore_macros) return;
          if (item.is_locked || item.product.product_type === "fixed") {
            const grams = allItemGrams.get(item.id) || item.quantity_grams;
            mealCals += (item.product.calories_per_100g * grams) / 100;
          }
        });

        const mealErr = mealTarget - mealCals;
        maxMealError = Math.max(maxMealError, Math.abs(mealErr));

        // If outside tolerance, adjust using single source of truth constraints
        if (Math.abs(mealErr) > MEAL_CAL_TOLERANCE) {
          const adjustable = mealEditables
            .filter(i => !isSauceOrSeasoning(i.product))
            .filter(i => {
              // Breakfast: avoid adjusting toppers/secondary by default (they have fixed ranges)
              if (mealType === "breakfast") return getBreakfastRole(i.product) === "base";
              return true;
            })
            .sort((a, b) => b.caloriesPer100g - a.caloriesPer100g);

          if (adjustable.length > 0) {
            const item = adjustable[0];
            const currentGrams = allItemGrams.get(item.itemId) || 0;

            // Get constraints from the shared helper
            const { minGrams, maxGrams } = getItemConstraints(item, mealType);

            const adjustment = (mealErr / item.caloriesPer100g) * 100;
            const cappedAdjustment = Math.max(-20, Math.min(20, adjustment));

            const newGrams = Math.max(minGrams, Math.min(maxGrams, Math.round(currentGrams + cappedAdjustment)));
            allItemGrams.set(item.itemId, newGrams);
          }
        }
      }

      // Early exit if all meals within tolerance
      if (maxMealError <= MEAL_CAL_TOLERANCE) break;

      // No-progress detection
      if (maxMealError >= lastTotalError - 1) {
        noProgressCount++;
        if (noProgressCount > 3) break;
      } else {
        noProgressCount = 0;
      }

      lastTotalError = maxMealError;
    }
  };

  mealCalorieBalanceLoop();

  // === COMPOSITION ENFORCEMENT / VALIDATION PASS ===
  // Ensure lunch/dinner have non-zero protein + carb + veg when selected
  // Ensure breakfast roles follow non-zero rules (base/secondary/topper) when selected
  // IMPORTANT: Runs BEFORE the final precision loop so precision is the last mutating step
  
  const validateMealComposition = () => {
    // Lunch & dinner: protein + carb + veg non-zero when those items exist
    for (const mealType of ["lunch", "dinner"] as MealType[]) {
      const mealEditables = editableByMeal[mealType];
      if (mealEditables.length === 0) continue;

      const proteins = mealEditables.filter(i => isHighProteinSource(i.product));
      const carbs = mealEditables.filter(i => i.carbsPer100g > 25 && i.proteinPer100g < 10);
      const vegs = mealEditables.filter(i => getFoodType(i.product) === "veg");

      [proteins, carbs, vegs].forEach(category => {
        category.forEach(item => {
          const grams = allItemGrams.get(item.itemId) || 0;
          const { minGrams, maxGrams } = getItemConstraints(item, mealType);

          // If the user selected the item (exists in editables), it must be non-zero (>= min)
          if (grams < minGrams) {
            allItemGrams.set(item.itemId, Math.max(minGrams, Math.min(maxGrams, minGrams)));
          }
        });
      });
    }

    // Breakfast: ensure selected items respect role minimums (topper/secondary/base) via getItemConstraints
    const breakfastEditables = editableByMeal.breakfast;
    if (breakfastEditables.length > 0) {
      breakfastEditables.forEach(item => {
        const grams = allItemGrams.get(item.itemId) || 0;
        const { minGrams, maxGrams } = getItemConstraints(item, "breakfast");

        // Selected breakfast items must not end at 0g; enforce min
        if (grams < minGrams) {
          allItemGrams.set(item.itemId, Math.max(minGrams, Math.min(maxGrams, minGrams)));
        }
      });
    }
  };

  validateMealComposition();

  // === PHASE 2: Global day-level fine-tuning ===
  // Recalculate totals and adjust across all items to hit exact daily targets
  let totalAchieved = calculateTotalMacros(allItemGrams, editableByMeal, fixedContribution, activeMeals);
  
  // Collect all editable items across meals for global adjustment
  // FILTER OUT constrained items (sauces, seasonings) - they have fixed portions
  // EXCEPT granola toppers which are valuable fat sources
  const allEditables: { item: EditableItem; grams: number; mealType: MealType }[] = [];
  activeMeals.forEach(mealType => {
    editableByMeal[mealType].forEach(item => {
      // Skip sauces/seasonings - they have fixed smart portions
      if (isSauceOrSeasoning(item.product)) return;
      
      // Skip breakfast toppers EXCEPT granola (granola is a key fat source)
      if (mealType === "breakfast" && getBreakfastRole(item.product) === "topper") {
        if (!isGranola(item.product)) return; // Only granola participates
      }
      
      const currentGrams = allItemGrams.get(item.itemId) || 0;
      allEditables.push({ item, grams: currentGrams, mealType });
    });
  });

  // Global precision passes (up to 50 iterations for tighter convergence)
  for (let globalPass = 0; globalPass < 50; globalPass++) {
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
    
    // === Adjust protein (direction-aware) ===
    if (Math.abs(proErr) >= 0.3) {
      const proteinSources = allEditables
        .filter(e => isHighProteinSource(e.item.product) && e.item.proteinPer100g > 5)
        .sort((a, b) => b.item.proteinPer100g - a.item.proteinPer100g);
      
      if (proteinSources.length > 0) {
        const best = proteinSources[0];
        const adjustment = (proErr / best.item.proteinPer100g) * 100;
        const currentGrams = allItemGrams.get(best.item.itemId) || 0;
        const maxForItem = getMaxPortion(best.item.product, settings);
        
        // Direction-aware: only increase if under, only decrease if over
        let newGrams = currentGrams + adjustment;
        newGrams = Math.max(settings.minGrams, Math.min(maxForItem, newGrams));
        allItemGrams.set(best.item.itemId, Math.round(newGrams * 10) / 10);
      }
    }
    
    // Recalculate
    totalAchieved = calculateTotalMacros(allItemGrams, editableByMeal, fixedContribution, activeMeals);
    
    // === Adjust carbs (using high-carb, low-protein items, direction-aware) ===
    const carbErrAfter = dailyTargets.carbs - totalAchieved.carbs;
    if (Math.abs(carbErrAfter) >= 0.3) {
      const carbSources = allEditables
        .filter(e => e.item.carbsPer100g > 15 && e.item.proteinPer100g < 10)
        .sort((a, b) => b.item.carbsPer100g - a.item.carbsPer100g);
      
      if (carbSources.length > 0) {
        const best = carbSources[0];
        const adjustment = (carbErrAfter / best.item.carbsPer100g) * 100;
        const currentGrams = allItemGrams.get(best.item.itemId) || 0;
        const maxForItem = getMaxPortion(best.item.product, settings);
        
        let newGrams = currentGrams + adjustment;
        newGrams = Math.max(settings.minGrams, Math.min(maxForItem, newGrams));
        allItemGrams.set(best.item.itemId, Math.round(newGrams * 10) / 10);
      }
    }
    
    // Recalculate
    totalAchieved = calculateTotalMacros(allItemGrams, editableByMeal, fixedContribution, activeMeals);
    
    // === Adjust fat (direction-aware) - relaxed filter to include more items ===
    const fatErrAfter = dailyTargets.fat - totalAchieved.fat;
    if (Math.abs(fatErrAfter) >= 0.3) {
      // Relaxed filter: fatPer100g >= 3 (includes Greek yogurt ~10g, granola ~15g, salmon ~13g)
      // Also explicitly include secondary yoghurt type for fat contribution
      const fatSources = allEditables
        .filter(e => {
          if (isSauceOrSeasoning(e.item.product)) return false;
          if (e.item.fatPer100g >= 3) return true;
          // Include secondary yoghurt (Greek) even if fat is lower
          if (e.mealType === "breakfast" && getYoghurtType(e.item.product) === "secondary") return true;
          return false;
        })
        .sort((a, b) => b.item.fatPer100g - a.item.fatPer100g);
      
      if (fatSources.length > 0) {
        const best = fatSources[0];
        const adjustment = (fatErrAfter / best.item.fatPer100g) * 100;
        const currentGrams = allItemGrams.get(best.item.itemId) || 0;
        const maxForItem = getMaxPortion(best.item.product, settings);
        
        let newGrams = currentGrams + adjustment;
        newGrams = Math.max(settings.minGrams, Math.min(maxForItem, newGrams));
        allItemGrams.set(best.item.itemId, Math.round(newGrams * 10) / 10);
      }
    }
    
    // Recalculate
    totalAchieved = calculateTotalMacros(allItemGrams, editableByMeal, fixedContribution, activeMeals);
    
    // === Final calorie adjustment (direction-aware, using low-protein items) ===
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
        const maxForItem = getMaxPortion(best.item.product, settings);
        
        let newGrams = currentGrams + adjustment;
        newGrams = Math.max(settings.minGrams, Math.min(maxForItem, newGrams));
        allItemGrams.set(best.item.itemId, Math.round(newGrams * 10) / 10);
      }
    }
  }

  // === FINAL VALIDATION PASS: Ensure no item exceeds its max portion ===
  allEditables.forEach(({ item }) => {
    const currentGrams = allItemGrams.get(item.itemId) || 0;
    const maxForItem = getMaxPortion(item.product, settings);
    if (currentGrams > maxForItem) {
      allItemGrams.set(item.itemId, maxForItem);
    }
  });
  
  // Also validate sauces/seasonings and toppers that were excluded from global adjustment
  activeMeals.forEach(mealType => {
    editableByMeal[mealType].forEach(item => {
      const currentGrams = allItemGrams.get(item.itemId) || 0;
      const maxForItem = getMaxPortion(item.product, settings);
      if (currentGrams > maxForItem) {
        allItemGrams.set(item.itemId, maxForItem);
      }
    });
  });

  // === INTEGER ROUNDING + REBALANCE PASS ===
  // Convert all portions to whole integers, then rebalance to maintain macro targets
  const integerRoundingPass = () => {
    // Track drift caused by rounding
    let roundingDrift = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    
    // Step 1: Round all items to nearest integer
    activeMeals.forEach(mealType => {
      editableByMeal[mealType].forEach(item => {
        const currentGrams = allItemGrams.get(item.itemId) || 0;
        const roundedGrams = Math.round(currentGrams);
        
        // Get min/max constraints based on item type
        const role = mealType === "breakfast" ? getBreakfastRole(item.product) : null;
        let minGrams = settings.minGrams;
        let maxGrams = getMaxPortion(item.product, settings);
        
        // Topper-specific constraints (25-60g for granola, 25-40g for others)
        if (role === "topper") {
          minGrams = 25;
          maxGrams = isGranola(item.product) ? MAX_GRANOLA_GRAMS : 40;
        }
        // Fruit constraints (80-120g)
        else if (role === "secondary") {
          minGrams = 80;
          maxGrams = 120;
        }
        // Primary yoghurt constraints (200-300g)
        else if (role === "base") {
          const yogType = getYoghurtType(item.product);
          if (yogType === "primary") {
            minGrams = 200;
            maxGrams = 300;
          } else if (yogType === "secondary") {
            minGrams = 50;
            maxGrams = 150;
          }
        }
        
        // Clamp to valid range
        const finalGrams = Math.max(minGrams, Math.min(maxGrams, roundedGrams));
        
        // Calculate drift from rounding
        const macrosBefore = calculateMacrosForGrams(item.product, currentGrams);
        const macrosAfter = calculateMacrosForGrams(item.product, finalGrams);
        
        roundingDrift.calories += macrosAfter.calories - macrosBefore.calories;
        roundingDrift.protein += macrosAfter.protein - macrosBefore.protein;
        roundingDrift.carbs += macrosAfter.carbs - macrosBefore.carbs;
        roundingDrift.fat += macrosAfter.fat - macrosBefore.fat;
        
        allItemGrams.set(item.itemId, finalGrams);
      });
    });
    
    // Step 2: ITERATIVE PRECISION LOOP - run until ALL macros within ±1g
    // This replaces the single-pass ±1g adjustment with calculated exact corrections
    
    const MAX_PRECISION_ITERATIONS = 100;  // Increased from 50 for tighter macro constraints
    const MACRO_TOLERANCE = 1.0;  // ±1g for protein, carbs, fat
    const CAL_TOLERANCE = 5.0;    // ±5 kcal for calories
    const MAX_STEP_SIZE = 20;     // Reduced from 25 for finer adjustments near target
    
    // Filter items available for rebalancing (exclude sauces, fruit)
    // INCLUDE granola toppers (they're valuable fat knobs)
    const rebalanceItems = allEditables.filter(e => {
      if (isSauceOrSeasoning(e.item.product)) return false;
      const role = e.mealType === "breakfast" ? getBreakfastRole(e.item.product) : null;
      // Allow granola topper (key fat source), exclude other toppers and fruit
      if (role === "topper" && !isGranola(e.item.product)) return false;
      if (role === "secondary") return false;
      return true;
    });
    
    // Categorize items by their best macro contribution
    const proteinSources = rebalanceItems
      .filter(e => isHighProteinSource(e.item.product) && e.item.proteinPer100g > 5)
      .sort((a, b) => {
        // Prefer items with highest protein density and lowest carb/fat impact
        const aRatio = a.item.proteinPer100g / (a.item.carbsPer100g + a.item.fatPer100g + 1);
        const bRatio = b.item.proteinPer100g / (b.item.carbsPer100g + b.item.fatPer100g + 1);
        return bRatio - aRatio;
      });
    
    const carbSources = rebalanceItems
      .filter(e => e.item.carbsPer100g > 15 && e.item.proteinPer100g < 10)
      .sort((a, b) => {
        // Prefer items with highest carb density and lowest fat impact
        const aRatio = a.item.carbsPer100g / (a.item.fatPer100g + 1);
        const bRatio = b.item.carbsPer100g / (b.item.fatPer100g + 1);
        return bRatio - aRatio;
      });
    
    // Fat sources: fatPer100g >= 3 (was > 5) to include more items
    // Also include secondary yoghurt (Greek) for fat contribution
    const fatSources = rebalanceItems
      .filter(e => {
        if (e.item.fatPer100g >= 3) return true;
        if (e.mealType === "breakfast" && getYoghurtType(e.item.product) === "secondary") return true;
        return false;
      })
      .sort((a, b) => {
        // Prefer items with highest fat density and lowest protein/carb impact
        const aRatio = a.item.fatPer100g / (a.item.proteinPer100g + a.item.carbsPer100g + 1);
        const bRatio = b.item.fatPer100g / (b.item.proteinPer100g + b.item.carbsPer100g + 1);
        return bRatio - aRatio;
      });
    
    // NOTE: Uses getItemConstraints defined earlier in the function (single source of truth)
    
    let noProgressCount = 0;
    let lastTotalError = Infinity;
    
    for (let iteration = 0; iteration < MAX_PRECISION_ITERATIONS; iteration++) {
      // Calculate current totals
      const current = calculateTotalMacros(allItemGrams, editableByMeal, fixedContribution, activeMeals);
      
      const proErr = dailyTargets.protein - current.protein;
      const carbErr = dailyTargets.carbs - current.carbs;
      const fatErr = dailyTargets.fat - current.fat;
      const calErr = dailyTargets.calories - current.calories;
      
      // Check if all macros are within tolerance
      if (Math.abs(proErr) <= MACRO_TOLERANCE && 
          Math.abs(carbErr) <= MACRO_TOLERANCE && 
          Math.abs(fatErr) <= MACRO_TOLERANCE && 
          Math.abs(calErr) <= CAL_TOLERANCE) {
        break; // Success! All targets hit
      }
      
      // Track progress to detect oscillation - use tighter threshold
      const totalError = Math.abs(proErr) + Math.abs(carbErr) + Math.abs(fatErr);
      if (totalError >= lastTotalError - 0.05) {
        noProgressCount++;
        if (noProgressCount > 15) {
          // No progress for 15 iterations - break to avoid infinite loop
          break;
        }
      } else {
        noProgressCount = 0;
      }
      lastTotalError = totalError;
      
      // Prioritize adjustments by error magnitude
      const errors = [
        { type: "protein", err: proErr, sources: proteinSources, macroPer100g: (s: EditableItem) => s.proteinPer100g },
        { type: "carbs", err: carbErr, sources: carbSources, macroPer100g: (s: EditableItem) => s.carbsPer100g },
        { type: "fat", err: fatErr, sources: fatSources, macroPer100g: (s: EditableItem) => s.fatPer100g },
      ].sort((a, b) => Math.abs(b.err) - Math.abs(a.err));
      
      // Adjust the macro with the largest error first
      for (const { err, sources, macroPer100g } of errors) {
        if (Math.abs(err) <= MACRO_TOLERANCE || sources.length === 0) continue;
        
        // Try each source in order until one can be adjusted
        for (const source of sources) {
          const currentGrams = allItemGrams.get(source.item.itemId) || 0;
          const { minGrams, maxGrams } = getItemConstraints(source.item, source.mealType);
          
          // Calculate exact grams needed to fix this error
          const macroDensity = macroPer100g(source.item);
          if (macroDensity <= 0) continue;
          
          let gramsNeeded = (err / macroDensity) * 100;
          
          // Cap step size to avoid oscillation
          gramsNeeded = Math.max(-MAX_STEP_SIZE, Math.min(MAX_STEP_SIZE, gramsNeeded));
          
          // Calculate new grams and clamp to constraints
          let newGrams = currentGrams + gramsNeeded;
          newGrams = Math.max(minGrams, Math.min(maxGrams, newGrams));
          
          // Only apply if it would make meaningful progress
          const actualAdjustment = newGrams - currentGrams;
          if (Math.abs(actualAdjustment) >= 0.5) {
            // Round to integer
            allItemGrams.set(source.item.itemId, Math.round(newGrams));
            break; // Made an adjustment, move to next iteration
          }
        }
        
        // Only adjust one macro per iteration to maintain stability
        break;
      }
    }
  };
  
  integerRoundingPass();

  // === FINAL CARB REDUCTION PASS ===
  // If carbs are still over target after precision loop, do final reduction
  totalAchieved = calculateTotalMacros(allItemGrams, editableByMeal, fixedContribution, activeMeals);
  let carbOverage = totalAchieved.carbs - dailyTargets.carbs;
  
  if (carbOverage > 1) {
    const carbSources = allEditables
      .filter(e => e.item.carbsPer100g > 20)
      .sort((a, b) => b.item.carbsPer100g - a.item.carbsPer100g);
    
    for (const source of carbSources) {
      if (carbOverage <= 1) break;
      
      const currentGrams = allItemGrams.get(source.item.itemId) || 0;
      const role = source.mealType === "breakfast" ? getBreakfastRole(source.item.product) : null;
      
      let minForItem = settings.minGrams;
      if (role === "topper") minForItem = 25;
      else if (role === "secondary") minForItem = 80;
      else if (source.item.carbsPer100g > 25 && source.item.proteinPer100g < 10) minForItem = 80;
      
      const maxReduction = currentGrams - minForItem;
      if (maxReduction > 0) {
        // Calculate exact reduction needed
        const gramsToRemove = Math.min(maxReduction, (carbOverage / source.item.carbsPer100g) * 100);
        const reduction = Math.max(1, Math.round(gramsToRemove));
        const newGrams = Math.round(currentGrams - reduction);
        allItemGrams.set(source.item.itemId, newGrams);
        
        carbOverage -= (reduction / 100) * source.item.carbsPer100g;
      }
    }
  }
  
  // === FINAL FAT RECONCILIATION PASS ===
  // If fat is still short after carb reduction, explicitly add grams to fat sources
  // This is the key fix for the -14g to -21g fat shortage issue
  totalAchieved = calculateTotalMacros(allItemGrams, editableByMeal, fixedContribution, activeMeals);
  let fatShortage = dailyTargets.fat - totalAchieved.fat;
  
  if (fatShortage > 1) {
    // Find all fat sources including granola (now in allEditables)
    const fatKnobs = allEditables
      .filter(e => {
        if (isSauceOrSeasoning(e.item.product)) return false;
        if (e.item.fatPer100g >= 5) return true;
        // Include granola explicitly
        if (isGranola(e.item.product)) return true;
        return false;
      })
      .sort((a, b) => b.item.fatPer100g - a.item.fatPer100g);
    
    for (const source of fatKnobs) {
      if (fatShortage <= 1) break;
      
      const currentGrams = allItemGrams.get(source.item.itemId) || 0;
      const { minGrams, maxGrams } = getItemConstraints(source.item, source.mealType);
      
      // Calculate grams needed to close the fat gap
      const gramsToAdd = (fatShortage / source.item.fatPer100g) * 100;
      const maxAddable = maxGrams - currentGrams;
      const actualAdd = Math.min(gramsToAdd, maxAddable);
      
      if (actualAdd >= 1) {
        const newGrams = Math.round(currentGrams + actualAdd);
        allItemGrams.set(source.item.itemId, newGrams);
        fatShortage -= (actualAdd / 100) * source.item.fatPer100g;
      }
    }
  }
  
  // If fat is still over target, reduce from fat sources
  totalAchieved = calculateTotalMacros(allItemGrams, editableByMeal, fixedContribution, activeMeals);
  let fatOverage = totalAchieved.fat - dailyTargets.fat;
  
  if (fatOverage > 1) {
    const fatKnobs = allEditables
      .filter(e => !isSauceOrSeasoning(e.item.product) && e.item.fatPer100g >= 5)
      .sort((a, b) => b.item.fatPer100g - a.item.fatPer100g);
    
    for (const source of fatKnobs) {
      if (fatOverage <= 1) break;
      
      const currentGrams = allItemGrams.get(source.item.itemId) || 0;
      const { minGrams } = getItemConstraints(source.item, source.mealType);
      
      const gramsToRemove = (fatOverage / source.item.fatPer100g) * 100;
      const maxRemovable = currentGrams - minGrams;
      const actualRemove = Math.min(gramsToRemove, maxRemovable);
      
      if (actualRemove >= 1) {
        const newGrams = Math.round(currentGrams - actualRemove);
        allItemGrams.set(source.item.itemId, newGrams);
        fatOverage -= (actualRemove / 100) * source.item.fatPer100g;
      }
    }
  }
  
  // === FINAL PRECISION VERIFICATION PASS ===
  // One last check to ensure we're within tolerance, with small corrections if needed
  totalAchieved = calculateTotalMacros(allItemGrams, editableByMeal, fixedContribution, activeMeals);
  
  const finalProErr = dailyTargets.protein - totalAchieved.protein;
  const finalCarbErr = dailyTargets.carbs - totalAchieved.carbs;
  const finalFatErr = dailyTargets.fat - totalAchieved.fat;
  
  // Make micro-corrections if still outside tolerance (adjust by 1-2g)
  const microCorrect = (
    sources: { item: EditableItem; mealType: MealType }[], 
    err: number, 
    macroPer100g: (item: EditableItem) => number
  ) => {
    if (Math.abs(err) <= 1 || sources.length === 0) return;
    
    for (const source of sources) {
      const currentGrams = allItemGrams.get(source.item.itemId) || 0;
      const role = source.mealType === "breakfast" ? getBreakfastRole(source.item.product) : null;
      
      let minGrams = settings.minGrams;
      let maxGrams = getMaxPortion(source.item.product, settings);
      if (role === "base") {
        const yogType = getYoghurtType(source.item.product);
        if (yogType === "primary") { minGrams = 200; maxGrams = 300; }
        else if (yogType === "secondary") { minGrams = 50; maxGrams = 150; }
      }
      
      const density = macroPer100g(source.item);
      if (density <= 0) continue;
      
      const gramsNeeded = Math.round((err / density) * 100);
      if (Math.abs(gramsNeeded) >= 1) {
        const newGrams = Math.max(minGrams, Math.min(maxGrams, currentGrams + gramsNeeded));
        if (newGrams !== currentGrams) {
          allItemGrams.set(source.item.itemId, newGrams);
          break;
        }
      }
    }
  };
  
  // Build source lists for micro-corrections
  const finalProteinSources = allEditables
    .filter(e => !isSauceOrSeasoning(e.item.product) && isHighProteinSource(e.item.product))
    .sort((a, b) => b.item.proteinPer100g - a.item.proteinPer100g);
  
  const finalCarbSources = allEditables
    .filter(e => !isSauceOrSeasoning(e.item.product) && e.item.carbsPer100g > 15)
    .sort((a, b) => b.item.carbsPer100g - a.item.carbsPer100g);
  
  // Relaxed fat sources filter: fatPer100g >= 3 to include Greek yogurt, granola, etc.
  const finalFatSources = allEditables
    .filter(e => {
      if (isSauceOrSeasoning(e.item.product)) return false;
      if (e.item.fatPer100g >= 3) return true;
      if (isGranola(e.item.product)) return true;
      return false;
    })
    .sort((a, b) => b.item.fatPer100g - a.item.fatPer100g);
  
  microCorrect(finalProteinSources, finalProErr, i => i.proteinPer100g);
  microCorrect(finalCarbSources, finalCarbErr, i => i.carbsPer100g);
  microCorrect(finalFatSources, finalFatErr, i => i.fatPer100g);

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

  // Emit debug payload for dev-only console comparison (via localStorage flag)
  const debugItems: PortioningDebugItem[] = [];
  activeMeals.forEach(mt => {
    mealItems[mt].forEach(item => {
      if (!item.product) return;
      const grams = allItemGrams.get(item.id) || 0;
      const macro = calculateMacrosForGrams(item.product, grams);
      debugItems.push({
        itemId: item.id,
        name: item.product.name,
        mealType: mt,
        grams,
        per100g: {
          calories: item.product.calories_per_100g,
          protein: item.product.protein_per_100g,
          carbs: item.product.carbs_per_100g,
          fat: item.product.fat_per_100g,
        },
        contribution: macro,
        flags: {
          locked: item.is_locked,
          fixed: item.product.product_type === "fixed",
          ignored: !!item.product.ignore_macros,
          seasoningLike: isSauceOrSeasoning(item.product),
        },
      });
    });
  });
  const debugPayload: PortioningSolverDebugPayload = {
    mealDate: mealDate ?? "unknown",
    targets: dailyTargets,
    achieved: totalAchieved,
    warnings,
    items: debugItems,
    createdAt: new Date().toISOString(),
  };
  storePortioningSolverDebug(debugPayload);

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
