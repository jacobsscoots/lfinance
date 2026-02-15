/**
 * Seasoning Rules - Post-solve normalization and hard caps
 * 
 * This module provides:
 * - isSeasoning() - Detect if a product is a seasoning
 * - isSeasoningByName() - Fallback detection by product name patterns
 * - computeSeasoningGrams() - Derive grams from paired protein
 * - normalizeSeasoningPortions() - Post-solve normalizer with hard cap
 * 
 * IMPORTANT: This is an isolated patch that runs AFTER the solver
 * without modifying the core optimization loop.
 */

// Default hard cap for ALL seasonings (configurable in future)
export const DEFAULT_SEASONING_MAX_GRAMS = 15;

// Default grams for seasonings without a paired protein (0 = solver calculates proportionally)
export const DEFAULT_SEASONING_FALLBACK_GRAMS = 0;

export interface SeasoningCapOptions {
  maxGrams?: number; // Default: 15g
  countInMacros?: boolean; // Default: false
}

/**
 * Check if a food type should be treated as a seasoning
 */
export function isSeasoning(foodType: string | null | undefined): boolean {
  if (!foodType) return false;
  const type = foodType.toLowerCase();
  return type === 'sauce' || type === 'seasoning';
}

/**
 * Fallback: Check if a product NAME indicates it's a seasoning
 * This catches items that weren't correctly categorized in food_type
 */
export function isSeasoningByName(name: string | null | undefined): boolean {
  if (!name) return false;
  const lowered = name.toLowerCase();

  // Seasoning patterns - dry rubs, spices, powders
  const seasoningPatterns = [
    'seasoning', 'rub', 'spice', 'powder', 'paprika', 'cajun',
    'herbs', 'pepper', 'schwartz', 'oregano', 'cumin', 'chili',
    'coriander', 'turmeric', 'garam masala', 'curry powder',
    'garlic powder', 'onion powder', 'mixed spice'
  ];

  // Sauce patterns - liquid condiments
  // NOTE: patterns must be specific enough to not match food names
  // e.g., 'bbq sauce' not 'bbq' (which would match 'BBQ Chicken Pasta')
  const saucePatterns = [
    'sauce', 'dressing', 'mayo', 'ketchup', 'mustard',
    'soy sauce', 'teriyaki', 'sriracha', 'hot sauce', 'bbq sauce',
    'bbq rub', 'bbq seasoning', 'marinade', 'vinegar', 'glaze'
  ];

  // "oil" only matches as standalone word or common oil phrases,
  // not inside words like "foil" or product names
  const oilPatterns = [
    'olive oil', 'coconut oil', 'vegetable oil', 'rapeseed oil',
    'sesame oil', 'cooking oil', 'sunflower oil',
  ];

  return seasoningPatterns.some(p => lowered.includes(p)) ||
         saucePatterns.some(p => lowered.includes(p)) ||
         oilPatterns.some(p => lowered.includes(p));
}

/**
 * Derive seasoning grams from paired protein grams
 * Uses the seasoning_rate_per_100g to calculate proportional amount
 */
export function computeSeasoningGrams(
  proteinGrams: number,
  ratePer100g: number,
  maxGrams: number = DEFAULT_SEASONING_MAX_GRAMS
): number {
  const derived = Math.round((proteinGrams * ratePer100g) / 100);
  return Math.min(derived, maxGrams);
}

/**
 * Check if an item should be treated as a seasoning for capping purposes.
 * Uses category first, then falls back to name detection.
 */
export function shouldCapAsSeasoning(
  category: string | null | undefined,
  name: string | null | undefined,
  foodType: string | null | undefined
): boolean {
  // Direct category match
  if (category === 'seasoning') return true;

  // Food type match (sauce or seasoning)
  if (isSeasoning(foodType)) return true;

  // Only use name-based fallback when category is 'other' or unset.
  // Items with known categories (protein, carb, dairy, premade, etc.) should
  // NOT be recategorized as seasoning based on name patterns alone.
  const knownNonSeasoningCategories = [
    'protein', 'carb', 'veg', 'dairy', 'fruit', 'snack', 'premade', 'fat'
  ];
  if (category && knownNonSeasoningCategories.includes(category)) return false;

  // Fallback to name-based detection (only for 'other' or unset category)
  return isSeasoningByName(name);
}

/**
 * Post-solve normalization - clamp any seasoning that exceeds the hard cap
 * 
 * This function is called AFTER the solver returns a successful result,
 * ensuring seasonings never exceed the hard cap regardless of solver behavior.
 * 
 * Enhanced to detect seasonings by category, food_type, OR name patterns.
 */
export function normalizeSeasoningPortions(
  portions: Map<string, number>,
  items: Array<{ 
    id: string; 
    category: string; 
    maxPortionGrams: number;
    name?: string;
    foodType?: string | null;
  }>,
  hardCap: number = DEFAULT_SEASONING_MAX_GRAMS
): { portions: Map<string, number>; capped: string[] } {
  const result = new Map(portions);
  const capped: string[] = [];

  for (const item of items) {
    // Check if this item should be treated as a seasoning
    const isSeas = shouldCapAsSeasoning(item.category, item.name, item.foodType);
    if (!isSeas) continue;

    const current = result.get(item.id) ?? 0;
    // Use the smaller of: item's max portion OR the hard cap
    const cap = Math.min(item.maxPortionGrams, hardCap);

    if (current > cap) {
      result.set(item.id, cap);
      capped.push(item.id);
    }
  }

  return { portions: result, capped };
}

/**
 * Validate product nutrition values to catch unit conversion bugs.
 * Returns an error message if invalid, or null if valid.
 */
export function validateProductNutrition(
  product: {
    name: string;
    calories_per_100g: number;
    protein_per_100g: number;
    carbs_per_100g: number;
    fat_per_100g: number;
  }
): string | null {
  const { name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g } = product;
  
  // Check individual macro bounds (0-100g per 100g)
  if (protein_per_100g < 0 || protein_per_100g > 100) {
    return `${name}: protein_per_100g (${protein_per_100g}) outside valid range 0-100`;
  }
  if (carbs_per_100g < 0 || carbs_per_100g > 100) {
    return `${name}: carbs_per_100g (${carbs_per_100g}) outside valid range 0-100`;
  }
  if (fat_per_100g < 0 || fat_per_100g > 100) {
    return `${name}: fat_per_100g (${fat_per_100g}) outside valid range 0-100`;
  }
  
  // Check total macros (protein + carbs + fat <= 102g to allow slight rounding)
  const totalMacros = protein_per_100g + carbs_per_100g + fat_per_100g;
  if (totalMacros > 102) {
    return `${name}: total macros (${totalMacros.toFixed(1)}g) exceed 100g per 100g`;
  }
  
  // Check calorie sanity (0-900 kcal per 100g is reasonable)
  if (calories_per_100g < 0 || calories_per_100g > 900) {
    return `${name}: calories_per_100g (${calories_per_100g}) outside valid range 0-900`;
  }
  
  return null;
}
