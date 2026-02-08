/**
 * Seasoning Rules - Post-solve normalization and hard caps
 * 
 * This module provides:
 * - isSeasoning() - Detect if a product is a seasoning
 * - computeSeasoningGrams() - Derive grams from paired protein
 * - normalizeSeasoningPortions() - Post-solve normalizer with hard cap
 * 
 * IMPORTANT: This is an isolated patch that runs AFTER the solver
 * without modifying the core optimization loop.
 */

// Default hard cap for ALL seasonings (configurable in future)
export const DEFAULT_SEASONING_MAX_GRAMS = 15;

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
 * Post-solve normalization - clamp any seasoning that exceeds the hard cap
 * 
 * This function is called AFTER the solver returns a successful result,
 * ensuring seasonings never exceed the hard cap regardless of solver behavior.
 */
export function normalizeSeasoningPortions(
  portions: Map<string, number>,
  items: Array<{ id: string; category: string; maxPortionGrams: number }>,
  hardCap: number = DEFAULT_SEASONING_MAX_GRAMS
): { portions: Map<string, number>; capped: string[] } {
  const result = new Map(portions);
  const capped: string[] = [];

  for (const item of items) {
    if (item.category !== 'seasoning') continue;

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
