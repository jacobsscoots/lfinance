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
 *
 * SYMMETRIC scoring: penalize distance from target equally in both directions.
 * This prevents the old asymmetric bias that pushed all portions upward,
 * making fat impossible when protein/carbs slightly overshoot.
 */
export function scorePlan(
  portions: Map<string, number>,
  totals: MacroTotals,
  targets: SolverTargets,
  items: SolverItem[]
): number {
  const delta = calculateDelta(totals, targets);

  let score = 0;

  // Symmetric penalties — absolute distance from target
  // Calories: weight 1 per kcal deviation
  score += Math.abs(delta.calories) * 1;

  // Macros: weight 10 per gram deviation (macros are 1g precision)
  score += Math.abs(delta.protein) * 10;
  score += Math.abs(delta.carbs) * 10;
  score += Math.abs(delta.fat) * 10;

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
 * Calculate net error for optimization — SYMMETRIC
 *
 * Equal penalty for over and under, with extra penalty for exceeding tolerance.
 * This ensures the solver converges toward the center of the tolerance band
 * instead of biasing toward one side.
 */
function calculateNetError(delta: MacroTotals, tolerances: ToleranceConfig): number {
  let error = 0;

  // Symmetric base penalty: absolute distance from target
  error += Math.abs(delta.calories) * 1;
  error += Math.abs(delta.protein) * 10;
  error += Math.abs(delta.carbs) * 8;
  error += Math.abs(delta.fat) * 10;

  // Extra penalty for exceeding tolerance in EITHER direction
  const calAbs = Math.abs(delta.calories);
  if (calAbs > tolerances.calories.max) {
    error += (calAbs - tolerances.calories.max) * 5;
  }

  const proAbs = Math.abs(delta.protein);
  if (proAbs > tolerances.protein.max) {
    error += (proAbs - tolerances.protein.max) * 30;
  }

  const carbAbs = Math.abs(delta.carbs);
  if (carbAbs > tolerances.carbs.max) {
    error += (carbAbs - tolerances.carbs.max) * 20;
  }

  const fatAbs = Math.abs(delta.fat);
  if (fatAbs > tolerances.fat.max) {
    error += (fatAbs - tolerances.fat.max) * 30;
  }

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
  const totals = sumMacros(items, portions, true);

  // Report which macros are outside tolerance
  const macroChecks: Array<{ name: string; achieved: number; target: number; tol: number }> = [
    { name: 'Protein', achieved: totals.protein, target: targets.protein, tol: tolerances.protein.max },
    { name: 'Carbs', achieved: totals.carbs, target: targets.carbs, tol: tolerances.carbs.max },
    { name: 'Fat', achieved: totals.fat, target: targets.fat, tol: tolerances.fat.max },
    { name: 'Calories', achieved: totals.calories, target: targets.calories, tol: tolerances.calories.max },
  ];
  for (const mc of macroChecks) {
    const diff = mc.achieved - mc.target;
    if (Math.abs(diff) > mc.tol) {
      blockers.push({
        itemName: mc.name,
        constraint: 'macro_tolerance',
        value: Math.round(diff),
        detail: `${mc.name}: ${Math.round(mc.achieved)} vs target ${mc.target} (${diff > 0 ? '+' : ''}${Math.round(diff)}, tolerance ±${mc.tol})`,
      });
    }
  }

  // Check locked items that contribute significantly
  for (const item of items) {
    if (item.editableMode !== 'LOCKED') continue;
    const grams = portions.get(item.id) ?? 0;
    if (grams <= 0) continue;
    const macros = calculateMacros(item, grams);
    if (macros.fat > targets.fat * 0.3) {
      blockers.push({
        itemName: item.name,
        constraint: 'LOCKED',
        value: macros.fat,
        detail: `LOCKED at ${grams}g → ${Math.round(macros.fat)}g fat (${Math.round(macros.fat / targets.fat * 100)}% of target)`,
      });
    }
    if (macros.protein > targets.protein * 0.3) {
      blockers.push({
        itemName: item.name,
        constraint: 'LOCKED',
        value: macros.protein,
        detail: `LOCKED at ${grams}g → ${Math.round(macros.protein)}g protein (${Math.round(macros.protein / targets.protein * 100)}% of target)`,
      });
    }
  }

  // Check adjustable items at their limits
  for (const item of items) {
    if (item.editableMode === 'LOCKED') continue;
    const grams = portions.get(item.id) ?? 0;
    if (item.maxPortionGrams > 0 && grams >= item.maxPortionGrams) {
      blockers.push({
        itemName: item.name,
        constraint: 'max_portion',
        value: item.maxPortionGrams,
        detail: `${item.name} at MAX ${item.maxPortionGrams}g (${item.category}) — can't add more`,
      });
    }
    if (item.minPortionGrams > 0 && grams <= item.minPortionGrams) {
      blockers.push({
        itemName: item.name,
        constraint: 'min_portion',
        value: item.minPortionGrams,
        detail: `${item.name} at MIN ${item.minPortionGrams}g (${item.category}) — can't reduce`,
      });
    }
  }

  return blockers;
}

// ============================================================================
// FEASIBILITY PRE-CHECK (Fix A1)
// ============================================================================

interface FeasibilityBounds {
  minTotals: MacroTotals;
  maxTotals: MacroTotals;
}

/**
 * Compute min/max achievable totals given current items and constraints
 */
function computeFeasibilityBounds(
  items: SolverItem[],
  seasoningsCountMacros: boolean
): FeasibilityBounds {
  const minTotals: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const maxTotals: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  
  for (const item of items) {
    // Skip seasonings unless counting them
    if (item.category === 'seasoning' && !seasoningsCountMacros && !item.countMacros) {
      continue;
    }
    
    // Determine min/max grams for this item
    let minGrams: number;
    let maxGrams: number;
    
    if (item.editableMode === 'LOCKED') {
      // Locked items contribute fixed amount
      minGrams = item.currentGrams;
      maxGrams = item.currentGrams;
    } else {
      // Adjustable items have a range
      minGrams = Math.max(0, item.minPortionGrams);
      maxGrams = item.maxPortionGrams > 0 ? item.maxPortionGrams : 500;
    }
    
    // Calculate macro contributions at min/max grams
    const minMacros = calculateMacros(item, minGrams);
    const maxMacros = calculateMacros(item, maxGrams);
    
    minTotals.calories += minMacros.calories;
    minTotals.protein += minMacros.protein;
    minTotals.carbs += minMacros.carbs;
    minTotals.fat += minMacros.fat;
    
    maxTotals.calories += maxMacros.calories;
    maxTotals.protein += maxMacros.protein;
    maxTotals.carbs += maxMacros.carbs;
    maxTotals.fat += maxMacros.fat;
  }
  
  return { minTotals: roundMacros(minTotals), maxTotals: roundMacros(maxTotals) };
}

/**
 * Check if targets are achievable within feasibility bounds
 * Returns null if feasible, or a failure reason with blockers if not
 */
function checkFeasibility(
  items: SolverItem[],
  targets: SolverTargets,
  tolerances: ToleranceConfig,
  seasoningsCountMacros: boolean
): SolverFailure | null {
  const { minTotals, maxTotals } = computeFeasibilityBounds(items, seasoningsCountMacros);
  
  const blockers: Blocker[] = [];
  
  // Check each macro - target must be reachable within [min, max + tolerance]
  // Calories
  if (maxTotals.calories < targets.calories) {
    blockers.push({
      itemName: 'All items',
      constraint: 'max_achievable_calories',
      value: maxTotals.calories,
      detail: `Max achievable: ${maxTotals.calories} kcal, target: ${targets.calories} kcal`,
    });
  }
  if (minTotals.calories > targets.calories + tolerances.calories.max) {
    blockers.push({
      itemName: 'All items',
      constraint: 'min_achievable_calories',
      value: minTotals.calories,
      detail: `Min achievable: ${minTotals.calories} kcal, target: ${targets.calories} kcal`,
    });
  }
  
  // Protein
  if (maxTotals.protein < targets.protein) {
    blockers.push({
      itemName: 'All items',
      constraint: 'max_achievable_protein',
      value: maxTotals.protein,
      detail: `Max achievable: ${maxTotals.protein}g protein, target: ${targets.protein}g`,
    });
  }
  if (minTotals.protein > targets.protein + tolerances.protein.max) {
    blockers.push({
      itemName: 'All items',
      constraint: 'min_achievable_protein',
      value: minTotals.protein,
      detail: `Min achievable: ${minTotals.protein}g protein, target: ${targets.protein}g`,
    });
  }
  
  // Carbs
  if (maxTotals.carbs < targets.carbs) {
    blockers.push({
      itemName: 'All items',
      constraint: 'max_achievable_carbs',
      value: maxTotals.carbs,
      detail: `Max achievable: ${maxTotals.carbs}g carbs, target: ${targets.carbs}g`,
    });
  }
  if (minTotals.carbs > targets.carbs + tolerances.carbs.max) {
    blockers.push({
      itemName: 'All items',
      constraint: 'min_achievable_carbs',
      value: minTotals.carbs,
      detail: `Min achievable: ${minTotals.carbs}g carbs, target: ${targets.carbs}g`,
    });
  }
  
  // Fat
  if (maxTotals.fat < targets.fat) {
    blockers.push({
      itemName: 'All items',
      constraint: 'max_achievable_fat',
      value: maxTotals.fat,
      detail: `Max achievable: ${maxTotals.fat}g fat, target: ${targets.fat}g`,
    });
  }
  if (minTotals.fat > targets.fat + tolerances.fat.max) {
    blockers.push({
      itemName: 'All items',
      constraint: 'min_achievable_fat',
      value: minTotals.fat,
      detail: `Min achievable: ${minTotals.fat}g fat, target: ${targets.fat}g`,
    });
  }
  
  if (blockers.length > 0) {
    return {
      reason: 'impossible_targets',
      blockers,
      closestTotals: maxTotals, // Best we can do is max
      targetDelta: calculateDelta(maxTotals, targets),
      iterationsRun: 0,
    };
  }
  
  return null;
}

// ============================================================================
// MULTI-START INITIALIZATION STRATEGIES (Fix A2)
// ============================================================================

type InitStrategy = 'current' | 'midpoint' | 'protein_heavy' | 'carb_heavy';

function initializePortionsWithStrategy(
  items: SolverItem[],
  strategy: InitStrategy
): Map<string, number> {
  const portions = new Map<string, number>();
  
  for (const item of items) {
    let grams: number;
    
    if (item.editableMode === 'LOCKED') {
      grams = item.currentGrams;
    } else {
      const min = item.minPortionGrams;
      const max = item.maxPortionGrams > 0 ? item.maxPortionGrams : 500;
      
      switch (strategy) {
        case 'current':
          grams = item.currentGrams;
          break;
        case 'midpoint':
          grams = Math.round((min + max) / 2);
          break;
        case 'protein_heavy':
          // Proteins at 75% of max, carbs at 25% of range
          if (item.category === 'protein') {
            grams = Math.round(min + (max - min) * 0.75);
          } else if (item.category === 'carb') {
            grams = Math.round(min + (max - min) * 0.25);
          } else {
            grams = Math.round((min + max) / 2);
          }
          break;
        case 'carb_heavy':
          // Carbs at 75% of max, proteins at 25% of range
          if (item.category === 'carb') {
            grams = Math.round(min + (max - min) * 0.75);
          } else if (item.category === 'protein') {
            grams = Math.round(min + (max - min) * 0.25);
          } else {
            grams = Math.round((min + max) / 2);
          }
          break;
        default:
          grams = item.currentGrams;
      }
      
      grams = clampToConstraints(grams, item);
    }

    portions.set(item.id, grams);
  }

  return portions;
}

// ============================================================================
// MACRO-BALANCE INITIALIZATION (target-aware starting point)
// ============================================================================

/**
 * Target-aware initialization: groups items by primary nutrient contribution
 * and allocates portions to approximately hit each macro target.
 * Much better starting point than midpoint or blind strategies.
 */
function macroBalanceInit(
  items: SolverItem[],
  targets: SolverTargets,
  seasoningsCountMacros: boolean
): Map<string, number> {
  const portions = new Map<string, number>();

  // 1. Set locked items and seasonings
  for (const item of items) {
    if (item.editableMode === 'LOCKED' || item.category === 'seasoning') {
      portions.set(item.id, item.currentGrams);
    }
  }
  scaleSeasonings(items, portions);

  // 2. Compute what locked items already contribute
  const lockedTotals = sumMacros(items, portions, seasoningsCountMacros);
  const remaining = {
    protein: Math.max(0, targets.protein - lockedTotals.protein),
    carbs: Math.max(0, targets.carbs - lockedTotals.carbs),
    fat: Math.max(0, targets.fat - lockedTotals.fat),
    calories: Math.max(0, targets.calories - lockedTotals.calories),
  };

  // 3. Get adjustable items
  const adjustable = items.filter(i =>
    i.editableMode !== 'LOCKED' && i.category !== 'seasoning'
  );

  if (adjustable.length === 0) return portions;

  // 4. Classify items by primary nutrient (relative to target scale)
  const classify = (item: SolverItem): 'protein' | 'carb' | 'fat' | 'mixed' => {
    const p = item.nutritionPer100g.protein;
    const c = item.nutritionPer100g.carbs;
    const f = item.nutritionPer100g.fat;
    const pNorm = targets.protein > 0 ? p / targets.protein : 0;
    const cNorm = targets.carbs > 0 ? c / targets.carbs : 0;
    const fNorm = targets.fat > 0 ? f / targets.fat : 0;
    if (pNorm > cNorm && pNorm > fNorm) return 'protein';
    if (cNorm > pNorm && cNorm > fNorm) return 'carb';
    if (fNorm > pNorm && fNorm > cNorm) return 'fat';
    return 'mixed';
  };

  const groups: Record<string, SolverItem[]> = {
    protein: [], carb: [], fat: [], mixed: []
  };
  for (const item of adjustable) {
    groups[classify(item)].push(item);
  }

  // 5. Allocate each group to approximately hit its primary macro target
  const allocateGroup = (
    group: SolverItem[],
    nutrientKey: 'protein' | 'carbs' | 'fat',
    targetAmount: number
  ) => {
    if (group.length === 0 || targetAmount <= 0) return;
    const totalDensity = group.reduce((sum, item) => {
      const ef = item.eatenFactor ?? 1;
      return sum + (item.nutritionPer100g[nutrientKey] / 100 * ef);
    }, 0);
    if (totalDensity <= 0) {
      for (const item of group) {
        const mid = Math.round((item.minPortionGrams + item.maxPortionGrams) / 2);
        portions.set(item.id, clampToConstraints(mid, item));
      }
      return;
    }
    for (const item of group) {
      const ef = item.eatenFactor ?? 1;
      const density = item.nutritionPer100g[nutrientKey] / 100 * ef;
      if (density <= 0) {
        const mid = Math.round((item.minPortionGrams + item.maxPortionGrams) / 2);
        portions.set(item.id, clampToConstraints(mid, item));
        continue;
      }
      const share = density / totalDensity;
      const neededGrams = (targetAmount * share) / density;
      const grams = clampToConstraints(Math.round(neededGrams), item);
      portions.set(item.id, grams);
    }
  };

  // Protein first (user's top priority), then carbs, then fat
  allocateGroup(groups.protein, 'protein', remaining.protein);
  allocateGroup(groups.carb, 'carbs', remaining.carbs);
  allocateGroup(groups.fat, 'fat', remaining.fat);

  // Mixed items and any unallocated go to midpoint
  for (const item of adjustable) {
    if (!portions.has(item.id)) {
      const mid = Math.round((item.minPortionGrams + item.maxPortionGrams) / 2);
      portions.set(item.id, clampToConstraints(mid, item));
    }
  }

  return portions;
}

// ============================================================================
// GRADIENT-BASED COORDINATE DESCENT SOLVER
// ============================================================================

/**
 * Gradient-based coordinate descent solver.
 *
 * For each adjustable item, computes the analytically optimal step size
 * to minimize weighted macro error, then applies it (Gauss-Seidel style).
 *
 * Key advantages over greedy hill-climbing:
 * - Each step is analytically optimal (not limited to discrete step sizes)
 * - All items adjusted per iteration (not just one)
 * - Gauss-Seidel updates propagate information immediately
 * - Converges in ~10-30 iterations vs 100+ for greedy
 *
 * Includes a fine-tuning phase with ±1g/±step adjustments to escape
 * rounding traps when the gradient step rounds to zero.
 */
function runGradientSolve(
  items: SolverItem[],
  targets: SolverTargets,
  tolerances: ToleranceConfig,
  seasoningsCountMacros: boolean,
  maxIterations: number,
  initPortions: Map<string, number>,
  debugMode: boolean
): SolverResult & { iterationsRun: number } {
  const portions = new Map(initPortions);
  scaleSeasonings(items, portions);

  const adjustableItems = items.filter(item =>
    item.editableMode !== 'LOCKED' && item.category !== 'seasoning'
  );

  if (adjustableItems.length === 0) {
    const totals = sumMacros(items, portions, seasoningsCountMacros);
    const delta = calculateDelta(totals, targets);
    if (isWithinTolerance(totals, targets, tolerances)) {
      return { success: true, portions, totals: roundMacros(totals), score: 0, iterationsRun: 0 };
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
      bestEffortPortions: portions,
      iterationsRun: 0,
    } as SolverResult & { iterationsRun: number };
  }

  // Precompute nutrient density per gram for each adjustable item
  const nutrientDensity = adjustableItems.map(item => {
    const ef = item.eatenFactor ?? 1;
    return {
      cal: item.nutritionPer100g.calories / 100 * ef,
      pro: item.nutritionPer100g.protein / 100 * ef,
      carb: item.nutritionPer100g.carbs / 100 * ef,
      fat: item.nutritionPer100g.fat / 100 * ef,
    };
  });

  // Macro weights matching calculateNetError
  const W = { cal: 1, pro: 10, carb: 8, fat: 10 };

  let bestCandidate: CandidatePlan | null = null;
  let iterationsRun = 0;
  let lastError = Infinity;
  let stagnation = 0;
  let validSinceImproved = 0; // Track how many iterations since last improvement within tolerance

  for (let iter = 0; iter < maxIterations; iter++, iterationsRun++) {
    const totals = sumMacros(items, portions, seasoningsCountMacros);
    const delta = calculateDelta(totals, targets);
    const currentError = calculateNetError(delta, tolerances);

    // Check for valid solution — DON'T break immediately. Keep iterating
    // to find better solutions within tolerance. Only stop after 15
    // consecutive in-tolerance iterations with no improvement.
    if (isWithinTolerance(totals, targets, tolerances)) {
      const score = scorePlan(portions, totals, targets, items);
      if (!bestCandidate || score < bestCandidate.score) {
        bestCandidate = { portions: new Map(portions), totals: roundMacros(totals), score };
        validSinceImproved = 0;
      } else {
        validSinceImproved++;
      }
      if (validSinceImproved >= 15) break; // Fully converged within tolerance
    } else {
      validSinceImproved = 0;
    }

    if (currentError < 0.1) break;

    // Stagnation check — increase patience for tighter convergence
    if (Math.abs(currentError - lastError) < 0.01) {
      stagnation++;
      if (stagnation > 60) break;
    } else {
      stagnation = 0;
    }
    lastError = currentError;

    // What we still need (positive = under target)
    const need = {
      cal: targets.calories - totals.calories,
      pro: targets.protein - totals.protein,
      carb: targets.carbs - totals.carbs,
      fat: targets.fat - totals.fat,
    };

    let anyChanged = false;

    // PHASE 1: Gradient coordinate descent — optimal step per item
    for (let j = 0; j < adjustableItems.length; j++) {
      const item = adjustableItems[j];
      const n = nutrientDensity[j];
      const currentGrams = portions.get(item.id) ?? item.currentGrams;

      // Optimal step to minimize weighted squared error:
      // Δg = Σ(w_m × need_m × n_m) / Σ(w_m × n_m²)
      const numerator =
        W.cal * need.cal * n.cal +
        W.pro * need.pro * n.pro +
        W.carb * need.carb * n.carb +
        W.fat * need.fat * n.fat;

      const denominator =
        W.cal * n.cal * n.cal +
        W.pro * n.pro * n.pro +
        W.carb * n.carb * n.carb +
        W.fat * n.fat * n.fat;

      if (denominator < 1e-10) continue;

      const optimalStep = numerator / denominator;

      let newGrams = applyRounding(
        currentGrams + optimalStep,
        item.roundingRule,
        item.unitSizeGrams
      );
      newGrams = clampToConstraints(newGrams, item);

      if (newGrams !== currentGrams) {
        // Gauss-Seidel: update need immediately so next item sees the effect
        const dg = newGrams - currentGrams;
        need.cal -= dg * n.cal;
        need.pro -= dg * n.pro;
        need.carb -= dg * n.carb;
        need.fat -= dg * n.fat;
        portions.set(item.id, newGrams);
        anyChanged = true;
      }
    }

    // PHASE 2: Multi-pass fine-tuning — escape rounding traps with ±step
    // increments. Loop until no item changes (not just one pass).
    if (!anyChanged) {
      let fineTunePass = 0;
      const MAX_FINE_TUNE_PASSES = 5;
      while (fineTunePass < MAX_FINE_TUNE_PASSES) {
        fineTunePass++;
        let passChanged = false;

        for (let j = 0; j < adjustableItems.length; j++) {
          const item = adjustableItems[j];
          const currentGrams = portions.get(item.id) ?? 0;
          const step = Math.max(item.portionStepGrams, 1);

          const candidateSet = new Set<number>();
          for (const d of [1, -1, 2, -2, 3, -3, step, -step, step * 2, -step * 2, step * 3, -step * 3]) {
            const g = clampToConstraints(currentGrams + d, item);
            if (g !== currentGrams) candidateSet.add(g);
          }

          let bestError = tryAdjustment(items, portions, item.id, currentGrams, targets, tolerances, seasoningsCountMacros);
          let bestGrams = currentGrams;

          for (const g of candidateSet) {
            const error = tryAdjustment(items, portions, item.id, g, targets, tolerances, seasoningsCountMacros);
            if (error < bestError - 0.001) {
              bestError = error;
              bestGrams = g;
            }
          }

          if (bestGrams !== currentGrams) {
            portions.set(item.id, bestGrams);
            passChanged = true;
            anyChanged = true;
          }
        }

        if (!passChanged) break; // No item changed this pass — converged
        scaleSeasonings(items, portions);
      }
      if (!anyChanged) break; // Truly converged after all fine-tuning
    }

    scaleSeasonings(items, portions);
  }

  // Return best candidate if found
  if (bestCandidate) {
    const itemsWithMeta = items.map(item => ({
      id: item.id,
      category: item.category,
      maxPortionGrams: item.maxPortionGrams,
      name: item.name,
      foodType: item.category === 'seasoning' ? 'seasoning' : undefined,
    }));
    const { portions: normPortions, capped } = normalizeSeasoningPortions(
      bestCandidate.portions, itemsWithMeta, DEFAULT_SEASONING_MAX_GRAMS
    );
    const warnings: string[] = [];
    if (capped.length > 0) {
      warnings.push(`Capped ${capped.length} seasoning(s) to max ${DEFAULT_SEASONING_MAX_GRAMS}g`);
    }
    return {
      success: true,
      portions: normPortions,
      totals: bestCandidate.totals,
      score: bestCandidate.score,
      iterationsRun,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // Failed — return best-effort with diagnostics
  const itemsWithMeta = items.map(item => ({
    id: item.id,
    category: item.category,
    maxPortionGrams: item.maxPortionGrams,
    name: item.name,
    foodType: item.category === 'seasoning' ? 'seasoning' : undefined,
  }));
  const { portions: normPortions } = normalizeSeasoningPortions(
    portions, itemsWithMeta, DEFAULT_SEASONING_MAX_GRAMS
  );
  const finalTotals = sumMacros(items, normPortions, seasoningsCountMacros);
  const finalDelta = calculateDelta(finalTotals, targets);

  return {
    success: false,
    failure: {
      reason: stagnation > 30 ? 'stagnation' : 'max_iterations_exceeded',
      blockers: collectBlockers(items, normPortions, targets, tolerances),
      closestTotals: roundMacros(finalTotals),
      targetDelta: finalDelta,
      iterationsRun,
    },
    bestEffortPortions: normPortions,
    iterationsRun,
  } as SolverResult & { iterationsRun: number };
}

/**
 * Main solver function
 *
 * IMPORTANT: Always returns usable portions — even when the exact tolerance
 * cannot be satisfied, the solver returns its best-effort closest plan so the
 * UI never shows 0g blanks. The `success` flag distinguishes "within
 * tolerance" (true) from "best-effort" (false).
 */

// Minimum calories per meal type — safety net against obviously broken results
// (e.g., a 19 kcal lunch). Snack meals are exempt.
const MEAL_CALORIE_MINIMUMS: Record<string, number> = {
  breakfast: 100,
  lunch: 100,
  dinner: 100,
};

/**
 * Post-solve validation: each active meal (with items) must meet a minimum
 * calorie floor. Returns null if valid, or a list of failing meals.
 */
function validateMealMinimums(
  items: SolverItem[],
  portions: Map<string, number>,
  countSeasonings: boolean
): { meal: string; calories: number; minimum: number }[] | null {
  const mealCalories: Record<string, number> = {};
  const mealHasItems: Record<string, boolean> = {};

  for (const item of items) {
    const grams = portions.get(item.id) ?? 0;
    if (grams <= 0) continue;
    if (!countSeasonings && item.category === 'seasoning') continue;

    const macros = calculateMacros(item, grams);
    mealCalories[item.mealType] = (mealCalories[item.mealType] ?? 0) + macros.calories;
    mealHasItems[item.mealType] = true;
  }

  const failures: { meal: string; calories: number; minimum: number }[] = [];
  for (const [meal, minimum] of Object.entries(MEAL_CALORIE_MINIMUMS)) {
    if (mealHasItems[meal] && (mealCalories[meal] ?? 0) < minimum) {
      failures.push({ meal, calories: Math.round(mealCalories[meal] ?? 0), minimum });
    }
  }

  return failures.length > 0 ? failures : null;
}

export function solve(
  items: SolverItem[],
  targets: SolverTargets,
  options: Partial<SolverOptions> = {}
): SolverResult {
  const opts: SolverOptions = { ...DEFAULT_SOLVER_OPTIONS, ...options };
  const { maxIterations, tolerances, seasoningsCountMacros } = opts;

  // ============================================================
  // FIX A1: Feasibility pre-check — but still return best-effort
  // ============================================================
  const feasibilityFailure = checkFeasibility(items, targets, tolerances, seasoningsCountMacros);

  // Early exit: no adjustable items — return whatever we have
  if (!hasAdjustableItems(items)) {
    const portions = initializePortions(items);
    scaleSeasonings(items, portions);
    const totals = sumMacros(items, portions, seasoningsCountMacros);
    const delta = calculateDelta(totals, targets);

    const mealFailures = validateMealMinimums(items, portions, seasoningsCountMacros);
    if (isWithinTolerance(totals, targets, tolerances) && !mealFailures) {
      return {
        success: true,
        portions,
        totals: roundMacros(totals),
        score: 0,
        iterationsRun: 0,
      };
    }

    // Best-effort: return the portions we have (non-zero) with failure flag
    return {
      success: false,
      failure: {
        reason: 'no_adjustable_items',
        blockers: collectBlockers(items, portions, targets, tolerances),
        closestTotals: roundMacros(totals),
        targetDelta: delta,
        iterationsRun: 0,
      },
      // Attach best-effort portions so caller can still use them
      bestEffortPortions: portions,
    } as SolverResult;
  }

  // If infeasible, still run the solver to get closest-possible portions
  // (don't short-circuit; the solver will get as close as it can)

  // ============================================================
  // PHASE 1: Gradient solver with multiple starting points
  // Give macro_balance (best init) 50% of iterations, then split
  // the rest across fewer fallback strategies.
  // ============================================================
  const initStrategies: InitStrategy[] = ['midpoint', 'current'];

  // Build initialization portfolios: macro_balance first (best), then fallbacks
  const initPortfolios: Array<{ name: string; portions: Map<string, number>; iterShare: number }> = [
    { name: 'macro_balance', portions: macroBalanceInit(items, targets, seasoningsCountMacros), iterShare: 0.50 },
    { name: 'midpoint', portions: initializePortionsWithStrategy(items, 'midpoint'), iterShare: 0.25 },
    { name: 'current', portions: initializePortionsWithStrategy(items, 'current'), iterShare: 0.25 },
  ];

  // Greedy fallback gets whatever is left
  const greedyBudget = Math.ceil(maxIterations * 0.15);

  let bestResult: SolverResult | null = null;
  let bestFailedPortions: Map<string, number> | null = null;
  let totalIterations = 0;
  let lastFailureReason: 'max_iterations_exceeded' | 'stagnation' = 'max_iterations_exceeded';

  // Helper to evaluate and track a solver result
  const evaluateResult = (result: SolverResult & { iterationsRun: number }): SolverResult | null => {
    totalIterations += result.iterationsRun;

    if (result.success) {
      // Post-validation: check meal-level calorie minimums
      const mealFailures = validateMealMinimums(items, result.portions, seasoningsCountMacros);
      if (mealFailures) {
        const totals = sumMacros(items, result.portions, seasoningsCountMacros);
        const delta = calculateDelta(totals, targets);
        const mealFailResult = {
          success: false,
          failure: {
            reason: 'impossible_targets' as const,
            blockers: mealFailures.map(f => ({
              itemName: f.meal,
              constraint: `meal_minimum`,
              detail: `${f.meal} has only ${f.calories} kcal (min ${f.minimum})`,
            })),
            closestTotals: roundMacros(totals),
            targetDelta: delta,
            iterationsRun: totalIterations,
          },
          bestEffortPortions: result.portions,
        } as SolverResult;
        if (!bestResult) {
          bestResult = mealFailResult;
          bestFailedPortions = result.portions;
        }
        return null; // Not a valid solution
      }
      return result; // Valid solution — caller should return it
    }

    // Track best failed result
    const currentFailure = (result as { success: false; failure: SolverFailure }).failure;
    const currentScore = Math.abs(currentFailure.targetDelta.calories) +
      Math.abs(currentFailure.targetDelta.protein) * 10 +
      Math.abs(currentFailure.targetDelta.carbs) * 8 +
      Math.abs(currentFailure.targetDelta.fat) * 10;

    if (!bestResult) {
      bestResult = result;
      bestFailedPortions = (result as any).bestEffortPortions ?? null;
      lastFailureReason = currentFailure.reason as 'max_iterations_exceeded' | 'stagnation';
    } else {
      const bestFailure = (bestResult as { success: false; failure: SolverFailure }).failure;
      const bestScore = Math.abs(bestFailure.targetDelta.calories) +
        Math.abs(bestFailure.targetDelta.protein) * 10 +
        Math.abs(bestFailure.targetDelta.carbs) * 8 +
        Math.abs(bestFailure.targetDelta.fat) * 10;
      if (currentScore < bestScore) {
        bestResult = result;
        bestFailedPortions = (result as any).bestEffortPortions ?? null;
        lastFailureReason = currentFailure.reason as 'max_iterations_exceeded' | 'stagnation';
      }
    }
    return null;
  };

  // Try gradient solver with each initialization (weighted iteration budgets)
  for (const init of initPortfolios) {
    const budget = Math.ceil(maxIterations * init.iterShare);
    const result = runGradientSolve(
      items, targets, tolerances, seasoningsCountMacros,
      budget, init.portions, opts.debugMode
    );
    const validResult = evaluateResult(result);
    if (validResult) return validResult;
  }

  // ============================================================
  // PHASE 2: Legacy greedy solver as single fallback
  // ============================================================
  {
    const result = runSingleSolve(
      items, targets, tolerances, seasoningsCountMacros,
      greedyBudget, 'midpoint', opts.debugMode
    );
    const validResult = evaluateResult(result);
    if (validResult) return validResult;
  }

  // All strategies failed — return best attempt with diagnostics
  if (bestResult && !bestResult.success) {
    const failure = (bestResult as { success: false; failure: SolverFailure }).failure;
    return {
      success: false,
      failure: {
        ...failure,
        reason: feasibilityFailure ? 'impossible_targets' : lastFailureReason,
        iterationsRun: totalIterations,
      },
      bestEffortPortions: bestFailedPortions ?? undefined,
    } as SolverResult;
  }

  // Fallback (shouldn't reach here)
  const portions = initializePortions(items);
  const totals = sumMacros(items, portions, seasoningsCountMacros);
  return {
    success: false,
    failure: {
      reason: 'max_iterations_exceeded',
      blockers: collectBlockers(items, portions, targets, tolerances),
      closestTotals: roundMacros(totals),
      targetDelta: calculateDelta(totals, targets),
      iterationsRun: totalIterations,
    },
    bestEffortPortions: portions,
  } as SolverResult;
}

/**
 * Single solve attempt with given strategy
 */
function runSingleSolve(
  items: SolverItem[],
  targets: SolverTargets,
  tolerances: ToleranceConfig,
  seasoningsCountMacros: boolean,
  maxIterations: number,
  strategy: InitStrategy,
  debugMode: boolean
): SolverResult & { iterationsRun: number } {
  let iterationsRun = 0;
  
  // Initialize portions with strategy
  let portions = initializePortionsWithStrategy(items, strategy);
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
  
  for (let iteration = 0; iteration < maxIterations; iteration++, iterationsRun++) {
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
      if (debugMode) {
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
      iterationsRun,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
  
  // No valid solution found — return best-effort portions so UI never shows 0g
  // Apply seasoning normalization to the best-effort portions too
  const itemsWithMeta = items.map(item => ({
    id: item.id,
    category: item.category,
    maxPortionGrams: item.maxPortionGrams,
    name: item.name,
    foodType: item.category === 'seasoning' ? 'seasoning' : undefined,
  }));
  const { portions: normalizedPortions } = normalizeSeasoningPortions(
    portions,
    itemsWithMeta,
    DEFAULT_SEASONING_MAX_GRAMS
  );

  const finalTotals = sumMacros(items, normalizedPortions, seasoningsCountMacros);
  const finalDelta = calculateDelta(finalTotals, targets);
  const failureReason = stagnationCount >= STAGNATION_LIMIT ? 'stagnation' : 'max_iterations_exceeded';

  return {
    success: false,
    failure: {
      reason: failureReason,
      blockers: collectBlockers(items, normalizedPortions, targets, tolerances),
      closestTotals: roundMacros(finalTotals),
      targetDelta: finalDelta,
      iterationsRun,
    },
    bestEffortPortions: normalizedPortions,
    iterationsRun,
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
    premade: 'premade',
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
  // User rules: fruit 50-150g, granola/snack 20-80g, yoghurt/dairy 100-500g, seasoning ≤15g
  const defaultConstraints: Record<string, { min: number; max: number }> = {
    protein: { min: 100, max: 300 },
    carb: { min: 50, max: 250 },
    dairy: { min: 100, max: 500 },
    fruit: { min: 50, max: 150 },
    veg: { min: 50, max: 200 },
    seasoning: { min: 0, max: 15 },
    snack: { min: 20, max: 80 },
    fat: { min: 5, max: 50 },
    premade: { min: 100, max: 500 },
    other: { min: 10, max: 300 },
  };
  
  const defaults = defaultConstraints[category] ?? defaultConstraints.other;
  
  // For seasonings, use sensible initial grams if not specified
  let effectiveInitialGrams = initialGrams;
  if (category === 'seasoning' && initialGrams === 0) {
    effectiveInitialGrams = DEFAULT_SEASONING_FALLBACK_GRAMS;
  }
  
  // ============================================================
  // FIX B0: Seasoning constraints OVERRIDE product constraints
  // This prevents contradictory min/max (e.g., min=100, max=15)
  // ============================================================
  const isSeasoning = category === 'seasoning';
  
  // For seasonings: FORCE safe constraints regardless of product settings
  const minPortion = isSeasoning 
    ? 0 
    : (product.min_portion_grams ?? defaults.min);
  
  const maxPortion = isSeasoning 
    ? DEFAULT_SEASONING_MAX_GRAMS 
    : Math.min(product.max_portion_grams ?? defaults.max, 9999);
  
  // Seasonings are LOCKED (not optimization variables) and don't count macros
  const editableMode = isSeasoning 
    ? 'LOCKED' as const
    : ((product.editable_mode as SolverItem['editableMode']) ?? 'FREE');
  
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
    editableMode,
    minPortionGrams: minPortion,
    maxPortionGrams: maxPortion,
    portionStepGrams: isSeasoning ? 1 : (product.portion_step_grams ?? 1),
    roundingRule: isSeasoning ? 'nearest_1g' : ((product.rounding_rule as RoundingRule) ?? 'nearest_1g'),
    unitType: (product.default_unit_type as SolverItem['unitType']) ?? 'grams',
    unitSizeGrams: product.unit_size_g ?? null,
    eatenFactor: product.eaten_factor ?? 1,
    seasoningRatePer100g: product.seasoning_rate_per_100g ?? null,
    pairedProteinId: pairedProteinId ?? null,
    // FIX B: For locked/fixed items, initialGrams comes from the actual DB
    // item.quantity_grams (the user-set value). Use it as the authoritative source.
    // Only fall back to product.fixed_portion_grams when initialGrams is 0 (FREE items).
    currentGrams: isSeasoning
      ? Math.min(effectiveInitialGrams || (product.fixed_portion_grams ?? DEFAULT_SEASONING_FALLBACK_GRAMS), DEFAULT_SEASONING_MAX_GRAMS)
      : (initialGrams > 0 ? initialGrams : (product.fixed_portion_grams ?? effectiveInitialGrams)),
    countMacros: !isSeasoning,
  };
}
