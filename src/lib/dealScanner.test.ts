import { describe, it, expect } from "vitest";
import { hashDealSync, dealMatchesRule, detectPriceDrop } from "./dealScanner";

describe("dealScanner", () => {
  describe("hashDealSync", () => {
    it("should produce consistent hashes for the same input", () => {
      const hash1 = hashDealSync("Test Product", 19.99, "Amazon", "https://amazon.com/p/123");
      const hash2 = hashDealSync("Test Product", 19.99, "Amazon", "https://amazon.com/p/123");
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different inputs", () => {
      const hash1 = hashDealSync("Test Product", 19.99, "Amazon", "https://amazon.com/p/123");
      const hash2 = hashDealSync("Different Product", 19.99, "Amazon", "https://amazon.com/p/123");
      expect(hash1).not.toBe(hash2);
    });

    it("should be case-insensitive for title", () => {
      const hash1 = hashDealSync("TEST PRODUCT", 19.99, "Amazon", "https://amazon.com/p/123");
      const hash2 = hashDealSync("test product", 19.99, "Amazon", "https://amazon.com/p/123");
      expect(hash1).toBe(hash2);
    });

    it("should handle null store", () => {
      const hash = hashDealSync("Test Product", 19.99, null, "https://example.com");
      expect(hash).toBeTruthy();
    });
  });

  describe("dealMatchesRule", () => {
    const baseDeal = {
      title: "Energy Saving LED Bulbs 10 Pack",
      price: 15.99,
      discount_percent: 30,
      store: "Amazon",
      category: "Home",
    };

    it("should match when keywords_include matches title", () => {
      const rule = {
        keywords_include: ["energy", "led"],
        keywords_exclude: [],
        category: null,
        min_price: null,
        max_price: null,
        min_discount_percent: null,
        store_whitelist: [],
        store_blacklist: [],
      };
      expect(dealMatchesRule(baseDeal, rule)).toBe(true);
    });

    it("should not match when no keywords_include match", () => {
      const rule = {
        keywords_include: ["solar", "panel"],
        keywords_exclude: [],
        category: null,
        min_price: null,
        max_price: null,
        min_discount_percent: null,
        store_whitelist: [],
        store_blacklist: [],
      };
      expect(dealMatchesRule(baseDeal, rule)).toBe(false);
    });

    it("should not match when keywords_exclude matches", () => {
      const rule = {
        keywords_include: [],
        keywords_exclude: ["bulb"],
        category: null,
        min_price: null,
        max_price: null,
        min_discount_percent: null,
        store_whitelist: [],
        store_blacklist: [],
      };
      expect(dealMatchesRule(baseDeal, rule)).toBe(false);
    });

    it("should match when price is within range", () => {
      const rule = {
        keywords_include: [],
        keywords_exclude: [],
        category: null,
        min_price: 10,
        max_price: 20,
        min_discount_percent: null,
        store_whitelist: [],
        store_blacklist: [],
      };
      expect(dealMatchesRule(baseDeal, rule)).toBe(true);
    });

    it("should not match when price is below min_price", () => {
      const rule = {
        keywords_include: [],
        keywords_exclude: [],
        category: null,
        min_price: 20,
        max_price: null,
        min_discount_percent: null,
        store_whitelist: [],
        store_blacklist: [],
      };
      expect(dealMatchesRule(baseDeal, rule)).toBe(false);
    });

    it("should not match when price is above max_price", () => {
      const rule = {
        keywords_include: [],
        keywords_exclude: [],
        category: null,
        min_price: null,
        max_price: 10,
        min_discount_percent: null,
        store_whitelist: [],
        store_blacklist: [],
      };
      expect(dealMatchesRule(baseDeal, rule)).toBe(false);
    });

    it("should match when discount meets minimum", () => {
      const rule = {
        keywords_include: [],
        keywords_exclude: [],
        category: null,
        min_price: null,
        max_price: null,
        min_discount_percent: 25,
        store_whitelist: [],
        store_blacklist: [],
      };
      expect(dealMatchesRule(baseDeal, rule)).toBe(true);
    });

    it("should not match when discount is below minimum", () => {
      const rule = {
        keywords_include: [],
        keywords_exclude: [],
        category: null,
        min_price: null,
        max_price: null,
        min_discount_percent: 50,
        store_whitelist: [],
        store_blacklist: [],
      };
      expect(dealMatchesRule(baseDeal, rule)).toBe(false);
    });

    it("should match store whitelist", () => {
      const rule = {
        keywords_include: [],
        keywords_exclude: [],
        category: null,
        min_price: null,
        max_price: null,
        min_discount_percent: null,
        store_whitelist: ["Amazon", "eBay"],
        store_blacklist: [],
      };
      expect(dealMatchesRule(baseDeal, rule)).toBe(true);
    });

    it("should not match when store is blacklisted", () => {
      const rule = {
        keywords_include: [],
        keywords_exclude: [],
        category: null,
        min_price: null,
        max_price: null,
        min_discount_percent: null,
        store_whitelist: [],
        store_blacklist: ["Amazon"],
      };
      expect(dealMatchesRule(baseDeal, rule)).toBe(false);
    });
  });

  describe("detectPriceDrop", () => {
    it("should detect a significant price drop", () => {
      const result = detectPriceDrop(15, 20, 5);
      expect(result.dropped).toBe(true);
      expect(result.dropPercent).toBe(25);
    });

    it("should not detect drop when price increased", () => {
      const result = detectPriceDrop(25, 20, 5);
      expect(result.dropped).toBe(false);
      expect(result.dropPercent).toBe(0);
    });

    it("should not detect drop when below threshold", () => {
      const result = detectPriceDrop(19, 20, 10);
      expect(result.dropped).toBe(false);
      expect(result.dropPercent).toBe(5);
    });

    it("should detect drop at exactly threshold", () => {
      const result = detectPriceDrop(18, 20, 10);
      expect(result.dropped).toBe(true);
      expect(result.dropPercent).toBe(10);
    });
  });
});
