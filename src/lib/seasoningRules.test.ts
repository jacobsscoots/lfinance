/**
 * Seasoning Rules - Test Suite
 * 
 * Tests for the post-solve seasoning normalization, hard caps, and name-based detection.
 */

import { describe, it, expect } from 'vitest';
import {
  isSeasoning,
  isSeasoningByName,
  shouldCapAsSeasoning,
  computeSeasoningGrams,
  normalizeSeasoningPortions,
  validateProductNutrition,
  DEFAULT_SEASONING_MAX_GRAMS,
  DEFAULT_SEASONING_FALLBACK_GRAMS,
} from './seasoningRules';

describe('isSeasoning', () => {
  it('returns true for "sauce"', () => {
    expect(isSeasoning('sauce')).toBe(true);
  });

  it('returns true for "seasoning"', () => {
    expect(isSeasoning('seasoning')).toBe(true);
  });

  it('returns true regardless of case', () => {
    expect(isSeasoning('Sauce')).toBe(true);
    expect(isSeasoning('SEASONING')).toBe(true);
  });

  it('returns false for protein', () => {
    expect(isSeasoning('protein')).toBe(false);
  });

  it('returns false for carb', () => {
    expect(isSeasoning('carb')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSeasoning(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isSeasoning(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSeasoning('')).toBe(false);
  });
});

describe('isSeasoningByName', () => {
  it('detects seasoning keywords', () => {
    expect(isSeasoningByName('Schwartz Paprika Seasoning')).toBe(true);
    expect(isSeasoningByName('Cajun Spice Rub')).toBe(true);
    expect(isSeasoningByName('Garlic Powder')).toBe(true);
    expect(isSeasoningByName('Mixed Herbs')).toBe(true);
  });

  it('detects sauce keywords', () => {
    expect(isSeasoningByName('Soy Sauce')).toBe(true);
    expect(isSeasoningByName('Teriyaki Marinade')).toBe(true);
    expect(isSeasoningByName('BBQ Sauce')).toBe(true);
    expect(isSeasoningByName('Caesar Dressing')).toBe(true);
  });

  it('returns false for regular foods', () => {
    expect(isSeasoningByName('Chicken Breast')).toBe(false);
    expect(isSeasoningByName('Basmati Rice')).toBe(false);
    expect(isSeasoningByName('Greek Yogurt')).toBe(false);
    expect(isSeasoningByName('Mixed Berries')).toBe(false);
  });

  it('handles null/undefined', () => {
    expect(isSeasoningByName(null)).toBe(false);
    expect(isSeasoningByName(undefined)).toBe(false);
  });
});

describe('shouldCapAsSeasoning', () => {
  it('returns true for category=seasoning', () => {
    expect(shouldCapAsSeasoning('seasoning', 'Random Name', 'other')).toBe(true);
  });

  it('returns true for foodType=sauce', () => {
    expect(shouldCapAsSeasoning('other', 'Random Name', 'sauce')).toBe(true);
  });

  it('returns true for seasoning-like name even with category=other', () => {
    expect(shouldCapAsSeasoning('other', 'Schwartz Paprika Seasoning', 'other')).toBe(true);
  });

  it('returns false for regular protein', () => {
    expect(shouldCapAsSeasoning('protein', 'Chicken Breast', 'protein')).toBe(false);
  });
});

describe('computeSeasoningGrams', () => {
  it('derives grams from protein correctly', () => {
    // 200g protein * 3g per 100g = 6g seasoning
    expect(computeSeasoningGrams(200, 3, 15)).toBe(6);
  });

  it('caps at maxGrams', () => {
    // 1000g protein * 3g per 100g = 30g, capped to 15g
    expect(computeSeasoningGrams(1000, 3, 15)).toBe(15);
  });

  it('handles zero protein grams', () => {
    expect(computeSeasoningGrams(0, 3, 15)).toBe(0);
  });

  it('handles zero rate', () => {
    expect(computeSeasoningGrams(200, 0, 15)).toBe(0);
  });

  it('rounds to nearest integer', () => {
    // 150g protein * 3g per 100g = 4.5g, rounded to 5g (JavaScript Math.round)
    expect(computeSeasoningGrams(150, 3, 15)).toBe(5);
  });

  it('uses default max when not specified', () => {
    // Should use DEFAULT_SEASONING_MAX_GRAMS (15)
    expect(computeSeasoningGrams(1000, 5)).toBe(15);
  });
});

describe('normalizeSeasoningPortions', () => {
  it('clamps oversized seasonings to hard cap', () => {
    const portions = new Map([['s1', 100]]);
    const items = [{ id: 's1', category: 'seasoning', maxPortionGrams: 50 }];
    
    const { portions: result, capped } = normalizeSeasoningPortions(portions, items, 15);
    
    expect(result.get('s1')).toBe(15);
    expect(capped).toContain('s1');
  });

  it('uses item maxPortionGrams if lower than hardCap', () => {
    const portions = new Map([['s1', 20]]);
    const items = [{ id: 's1', category: 'seasoning', maxPortionGrams: 10 }];
    
    const { portions: result, capped } = normalizeSeasoningPortions(portions, items, 15);
    
    // Item max is 10, which is lower than hard cap of 15
    expect(result.get('s1')).toBe(10);
    expect(capped).toContain('s1');
  });

  it('leaves seasonings under cap unchanged', () => {
    const portions = new Map([['s1', 8]]);
    const items = [{ id: 's1', category: 'seasoning', maxPortionGrams: 15 }];
    
    const { portions: result, capped } = normalizeSeasoningPortions(portions, items, 15);
    
    expect(result.get('s1')).toBe(8);
    expect(capped).toHaveLength(0);
  });

  it('ignores non-seasoning items', () => {
    const portions = new Map([
      ['chicken', 200],
      ['s1', 50],
    ]);
    const items = [
      { id: 'chicken', category: 'protein', maxPortionGrams: 300 },
      { id: 's1', category: 'seasoning', maxPortionGrams: 15 },
    ];
    
    const { portions: result, capped } = normalizeSeasoningPortions(portions, items, 15);
    
    // Chicken should remain unchanged
    expect(result.get('chicken')).toBe(200);
    // Seasoning should be capped
    expect(result.get('s1')).toBe(15);
    expect(capped).toEqual(['s1']);
  });

  it('handles multiple seasonings', () => {
    const portions = new Map([
      ['s1', 100],
      ['s2', 5],
      ['s3', 20],
    ]);
    const items = [
      { id: 's1', category: 'seasoning', maxPortionGrams: 15 },
      { id: 's2', category: 'seasoning', maxPortionGrams: 15 },
      { id: 's3', category: 'seasoning', maxPortionGrams: 10 },
    ];
    
    const { portions: result, capped } = normalizeSeasoningPortions(portions, items, 15);
    
    expect(result.get('s1')).toBe(15); // Capped to hard cap
    expect(result.get('s2')).toBe(5);  // Under cap, unchanged
    expect(result.get('s3')).toBe(10); // Capped to item max
    expect(capped).toEqual(['s1', 's3']);
  });

  it('handles empty portions', () => {
    const portions = new Map<string, number>();
    const items: Array<{ id: string; category: string; maxPortionGrams: number }> = [];
    
    const { portions: result, capped } = normalizeSeasoningPortions(portions, items, 15);
    
    expect(result.size).toBe(0);
    expect(capped).toHaveLength(0);
  });

  it('preserves portions for items not in items array', () => {
    const portions = new Map([
      ['orphan', 150],
      ['s1', 50],
    ]);
    const items = [{ id: 's1', category: 'seasoning', maxPortionGrams: 15 }];
    
    const { portions: result } = normalizeSeasoningPortions(portions, items, 15);
    
    // Orphan item should remain unchanged (no item config found)
    expect(result.get('orphan')).toBe(150);
  });

  it('uses DEFAULT_SEASONING_MAX_GRAMS when hardCap not specified', () => {
    const portions = new Map([['s1', 100]]);
    const items = [{ id: 's1', category: 'seasoning', maxPortionGrams: 50 }];
    
    const { portions: result } = normalizeSeasoningPortions(portions, items);
    
    // Should use default of 15
    expect(result.get('s1')).toBe(DEFAULT_SEASONING_MAX_GRAMS);
  });

  it('detects seasonings by name when category is other', () => {
    const portions = new Map([
      ['paprika', 100],
      ['chicken', 200],
    ]);
    const items = [
      { id: 'paprika', category: 'other', maxPortionGrams: 50, name: 'Schwartz Paprika Seasoning', foodType: 'other' },
      { id: 'chicken', category: 'protein', maxPortionGrams: 300, name: 'Chicken Breast', foodType: 'protein' },
    ];
    
    const { portions: result, capped } = normalizeSeasoningPortions(portions, items, 15);
    
    // Paprika should be capped due to name detection
    expect(result.get('paprika')).toBe(15);
    expect(capped).toContain('paprika');
    // Chicken should remain unchanged
    expect(result.get('chicken')).toBe(200);
  });

  it('detects seasonings by foodType=sauce', () => {
    const portions = new Map([['soy', 50]]);
    const items = [
      { id: 'soy', category: 'other', maxPortionGrams: 50, name: 'Soy Sauce', foodType: 'sauce' },
    ];
    
    const { portions: result, capped } = normalizeSeasoningPortions(portions, items, 15);
    
    expect(result.get('soy')).toBe(15);
    expect(capped).toContain('soy');
  });
});

describe('validateProductNutrition', () => {
  it('returns null for valid nutrition', () => {
    const result = validateProductNutrition({
      name: 'Chicken',
      calories_per_100g: 165,
      protein_per_100g: 31,
      carbs_per_100g: 0,
      fat_per_100g: 3.6,
    });
    expect(result).toBeNull();
  });

  it('catches protein exceeding 100g per 100g', () => {
    const result = validateProductNutrition({
      name: 'Bad Product',
      calories_per_100g: 165,
      protein_per_100g: 700, // Invalid: probably entered per pack instead of per 100g
      carbs_per_100g: 0,
      fat_per_100g: 3.6,
    });
    expect(result).toContain('protein_per_100g');
    expect(result).toContain('outside valid range');
  });

  it('catches total macros exceeding 100g', () => {
    const result = validateProductNutrition({
      name: 'Overpacked Product',
      calories_per_100g: 400,
      protein_per_100g: 50,
      carbs_per_100g: 40,
      fat_per_100g: 20, // Total = 110g > 100g
    });
    expect(result).toContain('total macros');
    expect(result).toContain('exceed');
  });

  it('catches unrealistic calories', () => {
    const result = validateProductNutrition({
      name: 'Super Dense Food',
      calories_per_100g: 1000, // Too high
      protein_per_100g: 20,
      carbs_per_100g: 30,
      fat_per_100g: 10,
    });
    expect(result).toContain('calories_per_100g');
    expect(result).toContain('outside valid range');
  });

  it('catches negative values', () => {
    const result = validateProductNutrition({
      name: 'Negative Product',
      calories_per_100g: 165,
      protein_per_100g: -5,
      carbs_per_100g: 10,
      fat_per_100g: 5,
    });
    expect(result).toContain('protein_per_100g');
    expect(result).toContain('outside valid range');
  });
});

describe('DEFAULT_SEASONING_FALLBACK_GRAMS', () => {
  it('is a sensible small value', () => {
    expect(DEFAULT_SEASONING_FALLBACK_GRAMS).toBe(5);
    expect(DEFAULT_SEASONING_FALLBACK_GRAMS).toBeLessThanOrEqual(DEFAULT_SEASONING_MAX_GRAMS);
  });
});
