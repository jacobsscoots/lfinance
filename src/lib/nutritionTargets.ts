/**
 * Nutrition Target Calculator
 * Pure functions for calculating BMR, TDEE, and macro targets.
 * Metric units only (cm, kg).
 */

// ============= Types =============

export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extremely_active";
export type Formula = "mifflin_st_jeor" | "harris_benedict" | "katch_mcardle";
export type GoalType = "maintain" | "cut" | "bulk";

export interface CalculatorInput {
  age: number;            // years
  sex: Sex;
  heightCm: number;       // centimeters
  weightKg: number;       // kilograms
  activityLevel: ActivityLevel;
  bodyFatPercent?: number; // optional, 0-100
  formula: Formula;
}

export interface MacroRules {
  proteinPerKg: number;   // grams per kg bodyweight (default: 2.2)
  fatPerKg: number;       // grams per kg bodyweight (default: 0.8)
}

export interface CalculatorOutput {
  bmr: number;            // Basal Metabolic Rate (kcal)
  tdee: number;           // Total Daily Energy Expenditure (kcal)
  targetCalories: number; // After goal adjustment (kcal)
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
}

// ============= Constants =============

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,          // Little or no exercise
  lightly_active: 1.375,   // Light exercise 1-3 days/week
  moderately_active: 1.55, // Moderate exercise 3-5 days/week
  very_active: 1.725,      // Hard exercise 6-7 days/week
  extremely_active: 1.9,   // Very hard exercise, physical job
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (little or no exercise)",
  lightly_active: "Lightly Active (1-3 days/week)",
  moderately_active: "Moderately Active (3-5 days/week)",
  very_active: "Very Active (6-7 days/week)",
  extremely_active: "Extremely Active (physical job)",
};

export const GOAL_ADJUSTMENTS: Record<GoalType, number> = {
  maintain: 0,
  cut: -300,    // 300 kcal deficit
  bulk: 200,    // 200 kcal surplus
};

export const GOAL_LABELS: Record<GoalType, string> = {
  maintain: "Maintain Weight",
  cut: "Cut (−300 kcal)",
  bulk: "Lean Bulk (+200 kcal)",
};

export const DEFAULT_MACRO_RULES: MacroRules = {
  proteinPerKg: 2.2,
  fatPerKg: 0.8,
};

// ============= BMR Calculations =============

/**
 * Mifflin-St Jeor Equation (1990) - Most commonly used, good accuracy
 * Male:   BMR = (10 × weight) + (6.25 × height) − (5 × age) + 5
 * Female: BMR = (10 × weight) + (6.25 × height) − (5 × age) − 161
 */
export function calculateMifflinStJeor(input: Omit<CalculatorInput, "formula" | "activityLevel" | "bodyFatPercent">): number {
  const { weightKg, heightCm, age, sex } = input;
  const base = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
  return sex === "male" ? base + 5 : base - 161;
}

/**
 * Revised Harris-Benedict Equation (1984)
 * Male:   BMR = (13.397 × weight) + (4.799 × height) − (5.677 × age) + 88.362
 * Female: BMR = (9.247 × weight) + (3.098 × height) − (4.330 × age) + 447.593
 */
export function calculateHarrisBenedict(input: Omit<CalculatorInput, "formula" | "activityLevel" | "bodyFatPercent">): number {
  const { weightKg, heightCm, age, sex } = input;
  if (sex === "male") {
    return (13.397 * weightKg) + (4.799 * heightCm) - (5.677 * age) + 88.362;
  }
  return (9.247 * weightKg) + (3.098 * heightCm) - (4.330 * age) + 447.593;
}

/**
 * Katch-McArdle Formula - Uses lean body mass, requires body fat %
 * BMR = 370 + (21.6 × LBM)
 * where LBM = weight × (1 - bodyFat/100)
 */
export function calculateKatchMcArdle(weightKg: number, bodyFatPercent: number): number {
  const leanBodyMass = weightKg * (1 - bodyFatPercent / 100);
  return 370 + (21.6 * leanBodyMass);
}

/**
 * Calculate BMR using the specified formula
 */
export function calculateBMR(input: CalculatorInput): number {
  switch (input.formula) {
    case "mifflin_st_jeor":
      return calculateMifflinStJeor(input);
    case "harris_benedict":
      return calculateHarrisBenedict(input);
    case "katch_mcardle":
      if (input.bodyFatPercent === undefined || input.bodyFatPercent === null) {
        throw new Error("Katch-McArdle formula requires body fat percentage");
      }
      return calculateKatchMcArdle(input.weightKg, input.bodyFatPercent);
    default:
      return calculateMifflinStJeor(input);
  }
}

// ============= TDEE Calculation =============

/**
 * Calculate Total Daily Energy Expenditure
 * TDEE = BMR × Activity Multiplier
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel];
}

// ============= Macro Calculations =============

/**
 * Calculate macro targets based on TDEE, goal, and macro rules
 * 
 * Protein: proteinPerKg × bodyweight (g)
 * Fat: fatPerKg × bodyweight (g)
 * Carbs: remaining calories / 4 (g)
 */
export function calculateMacros(
  targetCalories: number,
  weightKg: number,
  rules: MacroRules = DEFAULT_MACRO_RULES
): { proteinGrams: number; fatGrams: number; carbsGrams: number } {
  const proteinGrams = Math.round(rules.proteinPerKg * weightKg);
  const fatGrams = Math.round(rules.fatPerKg * weightKg);
  
  // Protein = 4 kcal/g, Fat = 9 kcal/g
  const proteinCalories = proteinGrams * 4;
  const fatCalories = fatGrams * 9;
  
  // Remaining calories go to carbs (4 kcal/g)
  const remainingCalories = Math.max(0, targetCalories - proteinCalories - fatCalories);
  const carbsGrams = Math.round(remainingCalories / 4);
  
  return { proteinGrams, fatGrams, carbsGrams };
}

// ============= Full Calculation =============

/**
 * Calculate all nutrition targets from input
 */
export function calculateNutritionTargets(
  input: CalculatorInput,
  goal: GoalType,
  macroRules: MacroRules = DEFAULT_MACRO_RULES
): CalculatorOutput {
  const bmr = calculateBMR(input);
  const tdee = calculateTDEE(bmr, input.activityLevel);
  const targetCalories = Math.round(tdee + GOAL_ADJUSTMENTS[goal]);
  
  const macros = calculateMacros(targetCalories, input.weightKg, macroRules);
  
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories,
    ...macros,
  };
}

// ============= Validation =============

/**
 * Validate calculator input
 */
export function validateCalculatorInput(input: Partial<CalculatorInput>): string[] {
  const errors: string[] = [];
  
  if (!input.age || input.age < 15 || input.age > 100) {
    errors.push("Age must be between 15 and 100");
  }
  if (!input.sex) {
    errors.push("Sex is required");
  }
  if (!input.heightCm || input.heightCm < 100 || input.heightCm > 250) {
    errors.push("Height must be between 100 and 250 cm");
  }
  if (!input.weightKg || input.weightKg < 30 || input.weightKg > 300) {
    errors.push("Weight must be between 30 and 300 kg");
  }
  if (input.bodyFatPercent !== undefined && (input.bodyFatPercent < 3 || input.bodyFatPercent > 60)) {
    errors.push("Body fat must be between 3% and 60%");
  }
  if (input.formula === "katch_mcardle" && (input.bodyFatPercent === undefined || input.bodyFatPercent === null)) {
    errors.push("Katch-McArdle formula requires body fat percentage");
  }
  
  return errors;
}

/**
 * Check if calculated macros are reasonably balanced
 */
export function verifyMacroBalance(output: CalculatorOutput, tolerance: number = 5): boolean {
  const calculatedCalories = 
    (output.proteinGrams * 4) + 
    (output.carbsGrams * 4) + 
    (output.fatGrams * 9);
  
  return Math.abs(calculatedCalories - output.targetCalories) <= tolerance;
}
