/**
 * Portioning Engine V2 - Deterministic Constraint-Based Optimizer
 * 
 * This solver keeps iterating until it finds a valid plan that matches
 * calorie + macro targets within strict tolerances, or returns an explicit
 * failure reason.
 * 
 * Key properties:
 * - Deterministic (same inputs → same outputs)
 * - No LLM calls (pure math/logic)
 * - Respects LOCKED/BOUNDED/FREE constraints
 * - Integer grams output
 * - Tracks best valid candidate and returns it
 */

import {
  SolverItem,
  SolverTargets,
  SolverResult,
  SolverOptions,
  MacroTotals,
  CandidatePlan,
  SolverFailure,
  Blocker,
  ToleranceConfig,
  DEFAULT_SOLVER_OPTIONS,
  SolverDebugInfo,
  RoundingRule,
  MealType,
} from './portioningTypes';
import { 
  normalizeSeasoningPortions, 
  DEFAULT_SEASONING_MAX_GRAMS,
  shouldCapAsSeasoning,
  validateProductNutrition,
  DEFAULT_SEASONING_FALLBACK_GRAMS,
} from './seasoningRules';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate macros for a given gram amount using effective eating factor
 */
export function calculateMacros(item: SolverItem, grams: number): MacroTotals {
  const effectiveGrams = grams * item.eatenFactor;
  const factor = effectiveGrams / 100;
  
  return {
    calories: item.nutritionPer100g.calories * factor,
    protein: item.nutritionPer100g.protein * factor,
    carbs: item.nutritionPer100g.carbs * factor,
    fat: item.nutritionPer100g.fat * factor,
  };
}

/**
 * Sum macros from multiple items
 */
export function sumMacros(items: SolverItem[], portions: Map<string, number>, countSeasonings: boolean): MacroTotals {
  const totals: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  
  for (const item of items) {
    // Skip seasonings if not counting them
    if (item.category === 'seasoning' && !countSeasonings && !item.countMacros) {
      continue;
    }
    
    const grams = portions.get(item.id) ?? item.currentGrams;
    const macros = calculateMacros(item, grams);
    
    totals.calories += macros.calories;
    totals.protein += macros.protein;
    totals.carbs += macros.carbs;
    totals.fat += macros.fat;
  }
  
  return totals;
}

/**
 * Round macros to integers for display/comparison
 */
export function roundMacros(macros: MacroTotals): MacroTotals {
  return {
    calories: Math.round(macros.calories),
    protein: Math.round(macros.protein),
    carbs: Math.round(macros.carbs),
    fat: Math.round(macros.fat),
  };
}

/**
 * Apply rounding rule to gram value
 */
export function applyRounding(grams: number, rule: RoundingRule, unitSize?: number | null): number {
  switch (rule) {
    case 'nearest_1g':
      return Math.round(grams);
    case 'nearest_5g':
      return Math.round(grams / 5) * 5;
    case 'nearest_10g':
      return Math.round(grams / 10) * 10;
    case 'whole_unit_only':
      if (unitSize && unitSize > 0) {
        return Math.round(grams / unitSize) * unitSize;
      }
      return Math.round(grams);
    default:
      return Math.round(grams);
  }
}

/**
 * Clamp grams to item's portion constraints
 */
export function clampToConstraints(grams: number, item: SolverItem): number {
  let clamped = grams;
  
  // Apply min/max constraints
  if (item.minPortionGrams > 0) {
    clamped = Math.max(clamped, item.minPortionGrams);
  }
  if (item.maxPortionGrams > 0) {
    clamped = Math.min(clamped, item.maxPortionGrams);
  }
  
  // Apply step constraint (snap to nearest step)
  if (item.portionStepGrams > 1) {
    clamped = Math.round(clamped / item.portionStepGrams) * item.portionStepGrams;
  }
  
  // Apply rounding rule
  clamped = applyRounding(clamped, item.roundingRule, item.unitSizeGrams);
  
  // Re-apply min/max after rounding
  if (item.minPortionGrams > 0) {
    clamped = Math.max(clamped, item.minPortionGrams);
  }
  if (item.maxPortionGrams > 0) {
    clamped = Math.min(clamped, item.maxPortionGrams);
  }
  
  return Math.max(0, clamped);
}

/**
 * Check if totals are within tolerance of targets
 * Spec: target <= achieved <= target + tolerance
 */
export function isWithinTolerance(
  achieved: MacroTotals,
  targets: SolverTargets,
  tolerances: ToleranceConfig
): boolean {
  const rounded = roundMacros(achieved);
  
  // Calories: target <= achieved <= target + tolerance.max
  if (rounded.calories < targets.calories - tolerances.calories.min ||
      rounded.calories > targets.calories + tolerances.calories.max) {
    return false;
  }
  
  // Protein
  if (rounded.protein < targets.protein - tolerances.protein.min ||
      rounded.protein > targets.protein + tolerances.protein.max) {
    return false;
  }
  
  // Carbs
  if (rounded.carbs < targets.carbs - tolerances.carbs.min ||
      rounded.carbs > targets.carbs + tolerances.carbs.max) {
    return false;
  }
  
  // Fat
  if (rounded.fat < targets.fat - tolerances.fat.min ||
      rounded.fat > targets.fat + tolerances.fat.max) {
    return false;
  }
  
  return true;
}

/**
 * Calculate delta between achieved and target (negative = under, positive = over)
 */
export function calculateDelta(achieved: MacroTotals, targets: SolverTargets): MacroTotals {
  const rounded = roundMacros(achieved);
  return {
    calories: rounded.calories - targets.calories,
    protein: rounded.protein - targets.protein,
    carbs: rounded.carbs - targets.carbs,
    fat: rounded.fat - targets.fat,
  };
}

/**
 * Score a plan - lower is better
 * Priority: calorie overage, then macro overage, then portion naturalness
 */
export function scorePlan(
  portions: Map<string, number>,
  totals: MacroTotals,
  targets: SolverTargets,
  items: SolverItem[]
): number {
  const delta = calculateDelta(totals, targets);
  
  // Penalize being under target heavily (should be >= target)
  let score = 0;
  
  // Calorie overage (weight: 10)
  const calOverage = Math.max(0, delta.calories);
  const calUnder = Math.max(0, -delta.calories);
  score += calOverage * 10 + calUnder * 100; // Heavy penalty for under
  
  // Macro overages (weight: 5 each)
  const proteinOver = Math.max(0, delta.protein);
  const proteinUnder = Math.max(0, -delta.protein);
  score += proteinOver * 5 + proteinUnder * 50;
  
  const carbsOver = Math.max(0, delta.carbs);
  const carbsUnder = Math.max(0, -delta.carbs);
  score += carbsOver * 5 + carbsUnder * 50;
  
  const fatOver = Math.max(0, delta.fat);
  const fatUnder = Math.max(0, -delta.fat);
  score += fatOver * 5 + fatUnder * 50;
  
  // Portion naturalness - prefer round numbers and middle-of-range portions
  for (const item of items) {
    if (item.editableMode === 'LOCKED') continue;
    
    const grams = portions.get(item.id) ?? 0;
    
    // Prefer portions divisible by 5
    if (grams % 5 !== 0) score += 0.5;
    
    // Prefer portions in the middle of the allowed range
    if (item.minPortionGrams > 0 && item.maxPortionGrams > 0) {
      const midPoint = (item.minPortionGrams + item.maxPortionGrams) / 2;
      const distanceFromMid = Math.abs(grams - midPoint);
      const range = item.maxPortionGrams - item.minPortionGrams;
      if (range > 0) {
        score += (distanceFromMid / range) * 0.1;
      }
    }
  }
  
  return score;
}

// ============================================================================
// SEASONING SCALING
// ============================================================================

/**
 * Scale seasonings based on their paired protein grams.
 * Enhanced to handle seasonings without explicit pairing by using a default fallback.
 */
export function scaleSeasonings(items: SolverItem[], portions: Map<string, number>): void {
  // Find all proteins in the meal for fallback pairing
  const proteinItems = items.filter(i => i.category === 'protein');
  const totalProteinGrams = proteinItems.reduce(
    (sum, p) => sum + (portions.get(p.id) ?? p.currentGrams), 
    0
  );
  
  for (const item of items) {
    if (item.category !== 'seasoning') continue;
    
    // If explicitly paired, use that protein
    if (item.seasoningRatePer100g && item.pairedProteinId) {
      const proteinGrams = portions.get(item.pairedProteinId);
      if (proteinGrams !== undefined) {
        const seasoningGrams = Math.round(proteinGrams * item.seasoningRatePer100g / 100);
        const clamped = clampToConstraints(seasoningGrams, item);
        portions.set(item.id, clamped);
        continue;
      }
    }
    
    // If has rate but no paired ID, use total protein as basis
    if (item.seasoningRatePer100g && !item.pairedProteinId && totalProteinGrams > 0) {
      const seasoningGrams = Math.round(totalProteinGrams * item.seasoningRatePer100g / 100);
      const clamped = clampToConstraints(seasoningGrams, item);
      portions.set(item.id, clamped);
      continue;
    }
    
    // No pairing info: use default fallback grams (already clamped in init)
    // Just ensure it doesn't exceed hard cap
    const current = portions.get(item.id) ?? item.currentGrams;
    if (current > DEFAULT_SEASONING_MAX_GRAMS) {
      portions.set(item.id, DEFAULT_SEASONING_MAX_GRAMS);
    }
  }
}

// ============================================================================
// ADJUSTMENT STRATEGIES
// ============================================================================

/**
 * Calculate net error for optimization
 */
function calculateNetError(delta: MacroTotals, tolerances: ToleranceConfig): number {
  let error = 0;
  
  // Under-target is heavily penalized
  if (delta.calories < 0) error += Math.abs(delta.calories) * 2;
  if (delta.protein < 0) error += Math.abs(delta.protein) * 20;
  if (delta.carbs < 0) error += Math.abs(delta.carbs) * 10;
  if (delta.fat < 0) error += Math.abs(delta.fat) * 15;
  
  // Over-tolerance is penalized
  if (delta.calories > tolerances.calories.max) error += (delta.calories - tolerances.calories.max) * 2;
  if (delta.protein > tolerances.protein.max) error += (delta.protein - tolerances.protein.max) * 20;
  if (delta.carbs > tolerances.carbs.max) error += (delta.carbs - tolerances.carbs.max) * 10;
  if (delta.fat > tolerances.fat.max) error += (delta.fat - tolerances.fat.max) * 15;
  
  return error;
}

/**
 * Try adjusting a single item and return the resulting error
 */
function tryAdjustment(
  items: SolverItem[],
  portions: Map<string, number>,
  itemId: string,
  newGrams: number,
  targets: SolverTargets,
  tolerances: ToleranceConfig,
  seasoningsCountMacros: boolean
): number {
  const testPortions = new Map(portions);
  testPortions.set(itemId, newGrams);
  scaleSeasonings(items, testPortions);
  const totals = sumMacros(items, testPortions, seasoningsCountMacros);
  const delta = calculateDelta(totals, targets);
  return calculateNetError(delta, tolerances);
}

/**
 * Get possible gram adjustments for an item
 */
function getPossibleAdjustments(item: SolverItem, currentGrams: number): number[] {
  const adjustments: number[] = [];
  const step = Math.max(item.portionStepGrams, 1);
  
  // Try small and large adjustments in both directions
  const stepSizes = [step, step * 2, step * 5, step * 10];
  
  for (const size of stepSizes) {
    // Increase
    const increased = clampToConstraints(currentGrams + size, item);
    if (increased !== currentGrams && !adjustments.includes(increased)) {
      adjustments.push(increased);
    }
    
    // Decrease
    const decreased = clampToConstraints(currentGrams - size, item);
    if (decreased !== currentGrams && !adjustments.includes(decreased)) {
      adjustments.push(decreased);
    }
  }
  
  return adjustments;
}

// ============================================================================
// MAIN SOLVER
// ============================================================================

/**
 * Initialize portions from items' current grams
 */
function initializePortions(items: SolverItem[]): Map<string, number> {
  const portions = new Map<string, number>();
  
  for (const item of items) {
    let grams = item.currentGrams;
    
    // Apply constraints for non-locked items
    if (item.editableMode !== 'LOCKED') {
      grams = clampToConstraints(grams, item);
    }
    
    portions.set(item.id, grams);
  }
  
  return portions;
}

/**
 * Check if any adjustable items exist
 */
function hasAdjustableItems(items: SolverItem[]): boolean {
  return items.some(item => 
    item.editableMode !== 'LOCKED' && item.category !== 'seasoning'
  );
}

/**
 * Collect blockers for failure reporting
 */
function collectBlockers(
  items: SolverItem[],
  portions: Map<string, number>,
  targets: SolverTargets,
  tolerances: ToleranceConfig
): Blocker[] {
  const blockers: Blocker[] = [];
  
  // Check locked items that contribute significantly
  for (const item of items) {
    if (item.editableMode !== 'LOCKED') continue;
    
    const grams = portions.get(item.id) ?? 0;
    const macros = calculateMacros(item, grams);
    
    // Check each macro
    if (macros.fat > targets.fat * 0.3) {
      blockers.push({
        itemName: item.name,
        constraint: 'LOCKED',
        value: macros.fat,
        detail: `Contributes ${Math.round(macros.fat)}g fat (${Math.round(macros.fat / targets.fat * 100)}% of target)`,
      });
    }
    if (macros.protein > targets.protein * 0.3) {
      blockers.push({
        itemName: item.name,
        constraint: 'LOCKED',
        value: macros.protein,
        detail: `Contributes ${Math.round(macros.protein)}g protein`,
      });
    }
  }
  
  // Check items at their limits
  for (const item of items) {
    if (item.editableMode === 'LOCKED') continue;
    
    const grams = portions.get(item.id) ?? 0;
    
    if (item.maxPortionGrams > 0 && grams >= item.maxPortionGrams) {
      blockers.push({
        itemName: item.name,
        constraint: 'max_portion',
        value: item.maxPortionGrams,
        detail: `At maximum portion of ${item.maxPortionGrams}g`,
      });
    }
    if (item.minPortionGrams > 0 && grams <= item.minPortionGrams) {
      blockers.push({
        itemName: item.name,
        constraint: 'min_portion',
        value: item.minPortionGrams,
        detail: `At minimum portion of ${item.minPortionGrams}g`,
      });
    }
  }
  
  return blockers;
}

/**
 * Main solver function
 */
export function solve(
  items: SolverItem[],
  targets: SolverTargets,
  options: Partial<SolverOptions> = {}
): SolverResult {
  const opts: SolverOptions = { ...DEFAULT_SOLVER_OPTIONS, ...options };
  const { maxIterations, tolerances, seasoningsCountMacros } = opts;
  
  // Early exit: no adjustable items
  if (!hasAdjustableItems(items)) {
    const portions = initializePortions(items);
    scaleSeasonings(items, portions);
    const totals = sumMacros(items, portions, seasoningsCountMacros);
    const delta = calculateDelta(totals, targets);
    
    if (isWithinTolerance(totals, targets, tolerances)) {
      return {
        success: true,
        portions,
        totals: roundMacros(totals),
        score: 0,
        iterationsRun: 0,
      };
    }
    
    return {
      success: false,
      failure: {
        reason: 'no_adjustable_items',
        blockers: collectBlockers(items, portions, targets, tolerances),
        closestTotals: roundMacros(totals),
        targetDelta: delta,
        iterationsRun: 0,
      },
    };
  }
  
  // Initialize portions
  let portions = initializePortions(items);
  scaleSeasonings(items, portions);
  
  // Track best valid candidate
  const candidates: CandidatePlan[] = [];
  let bestScore = Infinity;
  let stagnationCount = 0;
  const STAGNATION_LIMIT = 50;
  
  // Debug log for development
  const debugLogs: SolverDebugInfo[] = [];
  
  // Get adjustable items
  const adjustableItems = items.filter(item => 
    item.editableMode !== 'LOCKED' && item.category !== 'seasoning'
  );
  
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Calculate current totals
    const totals = sumMacros(items, portions, seasoningsCountMacros);
    const delta = calculateDelta(totals, targets);
    const currentError = calculateNetError(delta, tolerances);
    
    // Check if valid
    if (isWithinTolerance(totals, targets, tolerances)) {
      const score = scorePlan(portions, totals, targets, items);
      candidates.push({
        portions: new Map(portions),
        totals: roundMacros(totals),
        score,
      });
      
      // Keep searching for better solutions (up to 5 more iterations)
      if (candidates.length >= 5) {
        break;
      }
    }
    
    // Early exit if error is very low (close to solution)
    if (currentError < 0.1) {
      break;
    }
    
    // Try all possible single-item adjustments and pick the best
    let bestAdjustment: { itemId: string; grams: number; error: number } | null = null;
    
    for (const item of adjustableItems) {
      const currentGrams = portions.get(item.id) ?? item.currentGrams;
      const possibleGrams = getPossibleAdjustments(item, currentGrams);
      
      for (const newGrams of possibleGrams) {
        const error = tryAdjustment(items, portions, item.id, newGrams, targets, tolerances, seasoningsCountMacros);
        
        if (!bestAdjustment || error < bestAdjustment.error) {
          bestAdjustment = { itemId: item.id, grams: newGrams, error };
        }
      }
    }
    
    // Apply best adjustment if it improves error
    if (bestAdjustment && bestAdjustment.error < currentError - 0.001) {
      const item = items.find(i => i.id === bestAdjustment!.itemId)!;
      const oldGrams = portions.get(item.id) ?? 0;
      portions.set(bestAdjustment.itemId, bestAdjustment.grams);
      scaleSeasonings(items, portions);
      
      stagnationCount = 0;
      bestScore = bestAdjustment.error;
      
      // Debug logging
      if (opts.debugMode) {
        debugLogs.push({
          iteration,
          currentTotals: roundMacros(totals),
          targetDelta: delta,
          adjustments: [{ itemId: bestAdjustment.itemId, from: oldGrams, to: bestAdjustment.grams }],
          constraintsApplied: [],
        });
      }
    } else {
      // No improvement found
      stagnationCount++;
      if (stagnationCount >= STAGNATION_LIMIT) {
        break;
      }
    }
  }
  
  // Return best candidate if we found valid solutions
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0];
    
    // Post-solve: enforce seasoning hard caps (isolated patch)
    // Enhanced: pass item name and foodType for fallback detection
    const itemsWithMeta = items.map(item => ({
      id: item.id,
      category: item.category,
      maxPortionGrams: item.maxPortionGrams,
      name: item.name,
      foodType: item.category === 'seasoning' ? 'seasoning' : undefined,
    }));
    
    const { portions: normalizedPortions, capped } = normalizeSeasoningPortions(
      best.portions,
      itemsWithMeta,
      DEFAULT_SEASONING_MAX_GRAMS
    );
    
    const warnings: string[] = [];
    if (capped.length > 0) {
      warnings.push(`Capped ${capped.length} seasoning(s) to max ${DEFAULT_SEASONING_MAX_GRAMS}g`);
    }
    
    return {
      success: true,
      portions: normalizedPortions,
      totals: best.totals,
      score: best.score,
      iterationsRun: candidates.length,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
  
  // No valid solution found
  const finalTotals = sumMacros(items, portions, seasoningsCountMacros);
  const finalDelta = calculateDelta(finalTotals, targets);
  
  return {
    success: false,
    failure: {
      reason: 'max_iterations_exceeded',
      blockers: collectBlockers(items, portions, targets, tolerances),
      closestTotals: roundMacros(finalTotals),
      targetDelta: finalDelta,
      iterationsRun: maxIterations,
    },
  };
}

// ============================================================================
// HELPER: Convert Product to SolverItem
// ============================================================================

export interface ProductToSolverInput {
  id: string;
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  food_type: string | null;
  editable_mode?: string;
  min_portion_grams?: number | null;
  max_portion_grams?: number | null;
  portion_step_grams?: number;
  rounding_rule?: string;
  eaten_factor?: number;
  seasoning_rate_per_100g?: number | null;
  default_unit_type?: string;
  unit_size_g?: number | null;
  fixed_portion_grams?: number | null;
}

export function productToSolverItem(
  product: ProductToSolverInput,
  mealType: MealType,
  initialGrams: number,
  pairedProteinId?: string
): SolverItem {
  // Determine category from food_type
  // NOTE: Both 'sauce' and 'seasoning' map to 'seasoning' category for hard cap enforcement
  const categoryMap: Record<string, SolverItem['category']> = {
    protein: 'protein',
    carb: 'carb',
    veg: 'veg',
    dairy: 'dairy',
    fruit: 'fruit',
    sauce: 'seasoning',
    seasoning: 'seasoning', // Explicit mapping for 'seasoning' food_type
    treat: 'snack',
    fat: 'fat',
    other: 'other',
  };
  
  // Check for seasoning by name if food_type is 'other' or missing
  const foodType = product.food_type ?? 'other';
  let category = categoryMap[foodType] ?? 'other';
  
  // Fallback: detect seasonings by name patterns if categorized as 'other'
  if (category === 'other' && shouldCapAsSeasoning('other', product.name, foodType)) {
    category = 'seasoning';
  }
  
  // Default portion constraints based on category
  const defaultConstraints: Record<string, { min: number; max: number }> = {
    protein: { min: 100, max: 300 },
    carb: { min: 50, max: 250 },
    dairy: { min: 100, max: 350 },
    fruit: { min: 50, max: 300 },
    veg: { min: 50, max: 200 },
    seasoning: { min: 1, max: 15 },
    snack: { min: 20, max: 100 },
    fat: { min: 5, max: 50 },
    other: { min: 10, max: 300 },
  };
  
  const defaults = defaultConstraints[category] ?? defaultConstraints.other;
  
  // For seasonings, use sensible initial grams if not specified
  let effectiveInitialGrams = initialGrams;
  if (category === 'seasoning' && initialGrams === 0) {
    effectiveInitialGrams = DEFAULT_SEASONING_FALLBACK_GRAMS;
  }
  
  return {
    id: product.id,
    name: product.name,
    category,
    mealType,
    nutritionPer100g: {
      calories: product.calories_per_100g,
      protein: product.protein_per_100g,
      carbs: product.carbs_per_100g,
      fat: product.fat_per_100g,
    },
    editableMode: (product.editable_mode as SolverItem['editableMode']) ?? 'FREE',
    minPortionGrams: product.min_portion_grams ?? defaults.min,
    maxPortionGrams: Math.min(product.max_portion_grams ?? defaults.max, category === 'seasoning' ? DEFAULT_SEASONING_MAX_GRAMS : 9999),
    portionStepGrams: product.portion_step_grams ?? 1,
    roundingRule: (product.rounding_rule as RoundingRule) ?? 'nearest_1g',
    unitType: (product.default_unit_type as SolverItem['unitType']) ?? 'grams',
    unitSizeGrams: product.unit_size_g ?? null,
    eatenFactor: product.eaten_factor ?? 1,
    seasoningRatePer100g: product.seasoning_rate_per_100g ?? null,
    pairedProteinId: pairedProteinId ?? null,
    currentGrams: product.fixed_portion_grams ?? effectiveInitialGrams,
    countMacros: category !== 'seasoning',
  };
}
