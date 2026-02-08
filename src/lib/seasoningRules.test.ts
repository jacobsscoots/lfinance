/**
 * Seasoning Rules - Test Suite
 * 
 * Tests for the post-solve seasoning normalization and hard caps.
 */

import { describe, it, expect } from 'vitest';
import {
  isSeasoning,
  computeSeasoningGrams,
  normalizeSeasoningPortions,
  DEFAULT_SEASONING_MAX_GRAMS,
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
});
