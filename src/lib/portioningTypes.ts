/**
 * Portioning Engine V2 - Type Definitions
 * 
 * Strict tolerance-based meal plan generator that keeps iterating
 * until targets are met within allowances.
 */

// Editable mode determines how the solver can adjust portions
export type EditableMode = 'LOCKED' | 'BOUNDED' | 'FREE';

// Rounding rules for portion sizes
export type RoundingRule = 'nearest_1g' | 'nearest_5g' | 'nearest_10g' | 'whole_unit_only';

// Unit type for measurement
export type UnitType = 'grams' | 'whole_unit';

// Food categories for meal balancing
export type FoodCategory = 
  | 'protein' 
  | 'carb' 
  | 'veg' 
  | 'dairy' 
  | 'fruit' 
  | 'snack' 
  | 'seasoning' 
  | 'premade'
  | 'fat'
  | 'other';

// Meal types
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// Nutritional values per 100g
export interface NutritionPer100g {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Macro totals for a plan/meal
export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Solver item - represents a product in the solving context
export interface SolverItem {
  id: string;
  name: string;
  category: FoodCategory;
  mealType: MealType;
  nutritionPer100g: NutritionPer100g;
  
  // Portion constraints
  editableMode: EditableMode;
  minPortionGrams: number;
  maxPortionGrams: number;
  portionStepGrams: number;
  roundingRule: RoundingRule;
  
  // For whole unit items
  unitType: UnitType;
  unitSizeGrams: number | null;
  
  // Effective eating factor (0-1)
  eatenFactor: number;
  
  // For seasonings that scale with protein
  seasoningRatePer100g: number | null;
  pairedProteinId: string | null;
  
  // Current portion in grams (mutable during solve)
  currentGrams: number;
  
  // Whether to count macros (seasonings might be excluded)
  countMacros: boolean;
}

// Tolerance configuration
export interface ToleranceConfig {
  calories: { min: number; max: number }; // e.g., { min: 0, max: 50 }
  protein: { min: number; max: number };  // e.g., { min: 0, max: 2 }
  carbs: { min: number; max: number };    // e.g., { min: 0, max: 2 }
  fat: { min: number; max: number };      // e.g., { min: 0, max: 2 }
}

// Default tolerances per spec — SYMMETRIC: ±1g macros, ±50 kcal calories
// Using symmetric (min = max) prevents the solver from being unable to find
// solutions when hitting all 4 macros at-or-above simultaneously is impossible
// (e.g., overshooting protein/carbs steals calorie budget from fat).
export const DEFAULT_TOLERANCES: ToleranceConfig = {
  calories: { min: 50, max: 50 },
  protein: { min: 1, max: 1 },
  carbs: { min: 1, max: 1 },
  fat: { min: 1, max: 1 },
};

// Solver targets
export interface SolverTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Candidate plan during iteration
export interface CandidatePlan {
  portions: Map<string, number>; // itemId -> grams
  totals: MacroTotals;
  score: number;
}

// Failure reasons
export type FailureReason = 
  | 'locked_conflict'
  | 'portion_cap'
  | 'ratio_constraint'
  | 'rounding_conflict'
  | 'max_iterations_exceeded'
  | 'impossible_targets'
  | 'stagnation'
  | 'invalid_product_nutrition'
  | 'no_adjustable_items';

// Blocker info for failure reporting
export interface Blocker {
  itemName: string;
  constraint: string;
  value: number;
  detail?: string;
}

// Solver failure result
export interface SolverFailure {
  reason: FailureReason;
  blockers: Blocker[];
  closestTotals: MacroTotals;
  targetDelta: MacroTotals;
  iterationsRun: number;
}

// Successful solver result
export interface SolverSuccess {
  success: true;
  portions: Map<string, number>; // itemId -> grams
  totals: MacroTotals;
  score: number;
  iterationsRun: number;
  warnings?: string[];
}

// Failed solver result — always includes bestEffortPortions so UI never shows 0g
export interface SolverFailed {
  success: false;
  failure: SolverFailure;
  bestEffortPortions?: Map<string, number>;
}

// Union result type
export type SolverResult = SolverSuccess | SolverFailed;

// Slot definition for meal templates
export interface SlotDefinition {
  role: FoodCategory;
  required: boolean;
  minCalorieShare?: number; // 0-1
  maxCalorieShare?: number; // 0-1
  minGrams?: number;
  maxGrams?: number;
  minProteinGrams?: number; // e.g., protein slot must contribute >= 40g
}

// Meal template
export interface MealTemplate {
  id: string;
  userId: string;
  name: string;
  mealType: MealType;
  slotDefinitions: SlotDefinition[];
  isDefault: boolean;
}

// Debug info for transparency
export interface SolverDebugInfo {
  iteration: number;
  currentTotals: MacroTotals;
  targetDelta: MacroTotals;
  adjustments: { itemId: string; from: number; to: number }[];
  constraintsApplied: string[];
}

// Solver options
export interface SolverOptions {
  maxIterations: number;
  tolerances: ToleranceConfig;
  templates?: MealTemplate[];
  debugMode: boolean;
  seasoningsCountMacros: boolean;
}

// Default solver options
export const DEFAULT_SOLVER_OPTIONS: SolverOptions = {
  maxIterations: 1500,
  tolerances: DEFAULT_TOLERANCES,
  debugMode: false,
  seasoningsCountMacros: false,
};
