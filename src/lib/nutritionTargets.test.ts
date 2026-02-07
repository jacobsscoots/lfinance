import { describe, it, expect } from "vitest";
import {
  calculateMifflinStJeor,
  calculateHarrisBenedict,
  calculateKatchMcArdle,
  calculateBMR,
  calculateTDEE,
  calculateMacros,
  calculateNutritionTargets,
  verifyMacroBalance,
  validateCalculatorInput,
  ACTIVITY_MULTIPLIERS,
  DEFAULT_MACRO_RULES,
  CalculatorInput,
} from "./nutritionTargets";

describe("nutritionTargets", () => {
  // Test subject: 30-year-old male, 180cm, 80kg
  const maleInput: CalculatorInput = {
    age: 30,
    sex: "male",
    heightCm: 180,
    weightKg: 80,
    activityLevel: "moderately_active",
    formula: "mifflin_st_jeor",
  };

  // Test subject: 28-year-old female, 165cm, 60kg
  const femaleInput: CalculatorInput = {
    age: 28,
    sex: "female",
    heightCm: 165,
    weightKg: 60,
    activityLevel: "lightly_active",
    formula: "mifflin_st_jeor",
  };

  describe("Mifflin-St Jeor Formula", () => {
    it("should calculate BMR for male correctly", () => {
      // BMR = (10 × 80) + (6.25 × 180) − (5 × 30) + 5 = 800 + 1125 - 150 + 5 = 1780
      const bmr = calculateMifflinStJeor(maleInput);
      expect(bmr).toBe(1780);
    });

    it("should calculate BMR for female correctly", () => {
      // BMR = (10 × 60) + (6.25 × 165) − (5 × 28) − 161 = 600 + 1031.25 - 140 - 161 = 1330.25
      const bmr = calculateMifflinStJeor(femaleInput);
      expect(bmr).toBeCloseTo(1330.25, 1);
    });
  });

  describe("Harris-Benedict Formula", () => {
    it("should calculate BMR for male correctly", () => {
      // BMR = (13.397 × 80) + (4.799 × 180) − (5.677 × 30) + 88.362
      // = 1071.76 + 863.82 - 170.31 + 88.362 = 1853.632
      const bmr = calculateHarrisBenedict(maleInput);
      expect(bmr).toBeCloseTo(1853.63, 1);
    });

    it("should calculate BMR for female correctly", () => {
      // BMR = (9.247 × 60) + (3.098 × 165) − (4.330 × 28) + 447.593
      // = 554.82 + 511.17 - 121.24 + 447.593 = 1392.343
      const bmr = calculateHarrisBenedict(femaleInput);
      expect(bmr).toBeCloseTo(1392.34, 1);
    });
  });

  describe("Katch-McArdle Formula", () => {
    it("should calculate BMR using lean body mass", () => {
      // LBM = 80 × (1 - 15/100) = 80 × 0.85 = 68
      // BMR = 370 + (21.6 × 68) = 370 + 1468.8 = 1838.8
      const bmr = calculateKatchMcArdle(80, 15);
      expect(bmr).toBeCloseTo(1838.8, 1);
    });

    it("should only work when body fat is provided", () => {
      const inputWithoutBf: CalculatorInput = {
        ...maleInput,
        formula: "katch_mcardle",
        bodyFatPercent: undefined,
      };
      
      expect(() => calculateBMR(inputWithoutBf)).toThrow("requires body fat");
    });

    it("should work when body fat is provided", () => {
      const inputWithBf: CalculatorInput = {
        ...maleInput,
        formula: "katch_mcardle",
        bodyFatPercent: 15,
      };
      
      const bmr = calculateBMR(inputWithBf);
      expect(bmr).toBeCloseTo(1838.8, 1);
    });
  });

  describe("TDEE Calculation", () => {
    it("should apply correct activity multiplier for sedentary", () => {
      const bmr = 1780;
      const tdee = calculateTDEE(bmr, "sedentary");
      expect(tdee).toBe(bmr * 1.2);
    });

    it("should apply correct activity multiplier for moderately active", () => {
      const bmr = 1780;
      const tdee = calculateTDEE(bmr, "moderately_active");
      expect(tdee).toBe(bmr * 1.55);
    });

    it("should apply correct activity multiplier for extremely active", () => {
      const bmr = 1780;
      const tdee = calculateTDEE(bmr, "extremely_active");
      expect(tdee).toBe(bmr * 1.9);
    });
  });

  describe("Macro Calculations", () => {
    it("should calculate protein based on bodyweight", () => {
      const macros = calculateMacros(2500, 80);
      // Default: 2.2g/kg × 80kg = 176g protein
      expect(macros.proteinGrams).toBe(176);
    });

    it("should calculate fat based on bodyweight", () => {
      const macros = calculateMacros(2500, 80);
      // Default: 0.8g/kg × 80kg = 64g fat
      expect(macros.fatGrams).toBe(64);
    });

    it("should fill remaining calories with carbs", () => {
      const macros = calculateMacros(2500, 80);
      // Protein: 176g × 4 = 704 kcal
      // Fat: 64g × 9 = 576 kcal
      // Remaining: 2500 - 704 - 576 = 1220 kcal
      // Carbs: 1220 / 4 = 305g
      expect(macros.carbsGrams).toBe(305);
    });

    it("should handle custom macro rules", () => {
      const customRules = { proteinPerKg: 2.0, fatPerKg: 1.0 };
      const macros = calculateMacros(2500, 80, customRules);
      
      expect(macros.proteinGrams).toBe(160);  // 2.0 × 80
      expect(macros.fatGrams).toBe(80);       // 1.0 × 80
    });

    it("should not return negative carbs", () => {
      // Very low calorie target
      const macros = calculateMacros(1000, 100);
      expect(macros.carbsGrams).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Full Calculation", () => {
    it("should calculate correct output for maintain goal", () => {
      const output = calculateNutritionTargets(maleInput, "maintain");
      
      expect(output.bmr).toBe(1780);
      expect(output.tdee).toBe(Math.round(1780 * 1.55));
      expect(output.targetCalories).toBe(output.tdee);
    });

    it("should subtract 300 kcal for cut goal", () => {
      const output = calculateNutritionTargets(maleInput, "cut");
      
      expect(output.targetCalories).toBe(output.tdee - 300);
    });

    it("should add 200 kcal for bulk goal", () => {
      const output = calculateNutritionTargets(maleInput, "bulk");
      
      expect(output.targetCalories).toBe(output.tdee + 200);
    });
  });

  describe("Macro Balance Verification", () => {
    it("should verify macros add up to target calories within tolerance", () => {
      const output = calculateNutritionTargets(maleInput, "maintain");
      
      // Macros should add up to roughly the target calories
      const calculatedCalories = 
        (output.proteinGrams * 4) + 
        (output.carbsGrams * 4) + 
        (output.fatGrams * 9);
      
      expect(Math.abs(calculatedCalories - output.targetCalories)).toBeLessThanOrEqual(5);
    });

    it("should pass verifyMacroBalance for valid output", () => {
      const output = calculateNutritionTargets(maleInput, "maintain");
      expect(verifyMacroBalance(output)).toBe(true);
    });

    it("should detect imbalanced macros", () => {
      const badOutput = {
        bmr: 1800,
        tdee: 2800,
        targetCalories: 2500,
        proteinGrams: 200,
        fatGrams: 100,
        carbsGrams: 400,  // This would be way more than target
      };
      
      expect(verifyMacroBalance(badOutput)).toBe(false);
    });
  });

  describe("Validation", () => {
    it("should validate age range", () => {
      const errors = validateCalculatorInput({ ...maleInput, age: 10 });
      expect(errors).toContain("Age must be between 15 and 100");
    });

    it("should require sex", () => {
      const errors = validateCalculatorInput({ ...maleInput, sex: undefined });
      expect(errors).toContain("Sex is required");
    });

    it("should validate height range", () => {
      const errors = validateCalculatorInput({ ...maleInput, heightCm: 50 });
      expect(errors).toContain("Height must be between 100 and 250 cm");
    });

    it("should validate weight range", () => {
      const errors = validateCalculatorInput({ ...maleInput, weightKg: 500 });
      expect(errors).toContain("Weight must be between 30 and 300 kg");
    });

    it("should validate body fat range", () => {
      const errors = validateCalculatorInput({ ...maleInput, bodyFatPercent: 70 });
      expect(errors).toContain("Body fat must be between 3% and 60%");
    });

    it("should require body fat for Katch-McArdle", () => {
      const errors = validateCalculatorInput({ 
        ...maleInput, 
        formula: "katch_mcardle",
        bodyFatPercent: undefined 
      });
      expect(errors).toContain("Katch-McArdle formula requires body fat percentage");
    });

    it("should pass validation for valid input", () => {
      const errors = validateCalculatorInput(maleInput);
      expect(errors).toHaveLength(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle minimum valid values", () => {
      const minInput: CalculatorInput = {
        age: 15,
        sex: "female",
        heightCm: 100,
        weightKg: 30,
        activityLevel: "sedentary",
        formula: "mifflin_st_jeor",
      };
      
      const output = calculateNutritionTargets(minInput, "maintain");
      expect(output.bmr).toBeGreaterThan(0);
      expect(output.tdee).toBeGreaterThan(0);
    });

    it("should handle maximum valid values", () => {
      const maxInput: CalculatorInput = {
        age: 100,
        sex: "male",
        heightCm: 250,
        weightKg: 300,
        activityLevel: "extremely_active",
        formula: "mifflin_st_jeor",
      };
      
      const output = calculateNutritionTargets(maxInput, "bulk");
      expect(output.bmr).toBeGreaterThan(0);
      expect(output.targetCalories).toBeGreaterThan(output.tdee);
    });
  });
});
