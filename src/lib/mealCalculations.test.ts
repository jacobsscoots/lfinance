import { describe, it, expect } from "vitest";
import { getTargetsForDate, WeeklyTargetsOverride } from "./mealCalculations";
import { NutritionSettings } from "@/hooks/useNutritionSettings";

// Mock settings for tests
const mockGlobalSettings: NutritionSettings = {
  id: "test-id",
  user_id: "user-1",
  mode: "target_based",
  daily_calorie_target: 2000,
  protein_target_grams: 150,
  carbs_target_grams: 200,
  fat_target_grams: 65,
  weekend_targets_enabled: true,
  weekend_calorie_target: 2200,
  weekend_protein_target_grams: 140,
  weekend_carbs_target_grams: 220,
  weekend_fat_target_grams: 70,
  min_grams_per_item: 10,
  max_grams_per_item: 500,
  portion_rounding: 5,
  target_tolerance_percent: 2,
  age: null,
  sex: null,
  height_cm: null,
  weight_kg: null,
  body_fat_percent: null,
  activity_level: null,
  formula: null,
  goal_type: null,
  protein_per_kg: null,
  fat_per_kg: null,
  last_calculated_at: null,
  created_at: "",
  updated_at: "",
};

describe("getTargetsForDate", () => {
  describe("with weekly override", () => {
    const weeklyOverride: WeeklyTargetsOverride = {
      weekStartDate: "2026-02-09", // Monday Feb 9, 2026
      schedule: {
        monday: 1717,
        tuesday: 1717,
        wednesday: 1717,
        thursday: 1717,
        friday: 1717,
        saturday: 2101,
        sunday: 2101,
      },
      protein: 160,
      carbs: 180,
      fat: 60,
    };

    it("should return weekly override calories for Monday with DERIVED fat", () => {
      const monday = new Date(2026, 1, 9); // Feb 9, 2026 (Monday)
      const targets = getTargetsForDate(monday, mockGlobalSettings, weeklyOverride);
      
      expect(targets.calories).toBe(1717);
      expect(targets.protein).toBe(160);
      expect(targets.carbs).toBe(180);
      // Fat is now DERIVED from remaining calories: (1717 - 160*4 - 180*4) / 9
      // = (1717 - 640 - 720) / 9 = 357 / 9 = 39.67 → 40
      expect(targets.fat).toBe(40);
    });

    it("should return weekly override calories for Saturday", () => {
      const saturday = new Date(2026, 1, 14); // Feb 14, 2026 (Saturday)
      const targets = getTargetsForDate(saturday, mockGlobalSettings, weeklyOverride);
      
      expect(targets.calories).toBe(2101);
      expect(targets.protein).toBe(160);
    });

    it("should return weekly override calories for Sunday", () => {
      const sunday = new Date(2026, 1, 15); // Feb 15, 2026 (Sunday)
      const targets = getTargetsForDate(sunday, mockGlobalSettings, weeklyOverride);
      
      expect(targets.calories).toBe(2101);
    });

    it("should return weekly override calories for Friday", () => {
      const friday = new Date(2026, 1, 13); // Feb 13, 2026 (Friday)
      const targets = getTargetsForDate(friday, mockGlobalSettings, weeklyOverride);
      
      expect(targets.calories).toBe(1717);
    });
  });

  describe("without weekly override (falls back to global settings)", () => {
    it("should return global weekday targets for Monday", () => {
      const monday = new Date(2026, 1, 9); // Feb 9, 2026 (Monday)
      const targets = getTargetsForDate(monday, mockGlobalSettings, null);
      
      expect(targets.calories).toBe(2000);
      expect(targets.protein).toBe(150);
    });

    it("should return global weekend targets for Saturday", () => {
      const saturday = new Date(2026, 1, 14); // Feb 14, 2026 (Saturday)
      const targets = getTargetsForDate(saturday, mockGlobalSettings, null);
      
      expect(targets.calories).toBe(2200);
      expect(targets.protein).toBe(140);
    });

    it("should return global weekend targets for Sunday", () => {
      const sunday = new Date(2026, 1, 15); // Feb 15, 2026 (Sunday)
      const targets = getTargetsForDate(sunday, mockGlobalSettings, null);
      
      expect(targets.calories).toBe(2200);
    });
  });

  describe("edge cases", () => {
    it("should fall back to global settings when date is outside override week", () => {
      const weeklyOverride: WeeklyTargetsOverride = {
        weekStartDate: "2026-02-09", // Feb 9-15
        schedule: {
          monday: 1717,
          tuesday: 1717,
          wednesday: 1717,
          thursday: 1717,
          friday: 1717,
          saturday: 2101,
          sunday: 2101,
        },
        protein: 160,
        carbs: 180,
        fat: 60,
      };

      // Feb 16 is the NEXT Monday (outside the override week)
      const nextMonday = new Date(2026, 1, 16);
      const targets = getTargetsForDate(nextMonday, mockGlobalSettings, weeklyOverride);
      
      expect(targets.calories).toBe(2000); // Falls back to global weekday
    });

    it("should use global settings when weeklyOverride is undefined", () => {
      const saturday = new Date(2026, 1, 14);
      const targets = getTargetsForDate(saturday, mockGlobalSettings);
      
      expect(targets.calories).toBe(2200); // Global weekend target
    });

    it("should derive fat from remaining calories even when override has null macros", () => {
      const weeklyOverride: WeeklyTargetsOverride = {
        weekStartDate: "2026-02-09",
        schedule: {
          monday: 1717,
          tuesday: 1717,
          wednesday: 1717,
          thursday: 1717,
          friday: 1717,
          saturday: 2101,
          sunday: 2101,
        },
        protein: null,
        carbs: null,
        fat: null, // This is ignored - fat is always derived
      };

      const monday = new Date(2026, 1, 9);
      const targets = getTargetsForDate(monday, mockGlobalSettings, weeklyOverride);
      
      expect(targets.calories).toBe(1717); // From override
      expect(targets.protein).toBe(150); // Falls back to global
      expect(targets.carbs).toBe(200); // Falls back to global
      // Fat is DERIVED: (1717 - 150*4 - 200*4) / 9 = (1717 - 600 - 800) / 9 = 317/9 = 35.2 → 35
      expect(targets.fat).toBe(35);
    });
  });
});
