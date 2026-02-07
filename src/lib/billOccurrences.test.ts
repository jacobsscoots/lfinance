import { describe, it, expect } from "vitest";
import { 
  generateBillOccurrences, 
  getBillOccurrencesForMonth,
  getBillOccurrencesInRange 
} from "./billOccurrences";
import type { Bill } from "@/hooks/useBills";

// Mock bill factory
function createMockBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: "bill-1",
    user_id: "user-1",
    name: "Netflix",
    amount: 15.99,
    due_day: 15,
    frequency: "monthly",
    is_active: true,
    start_date: "2024-01-01",
    end_date: null,
    provider: "Netflix",
    category_id: null,
    notes: null,
    next_review_date: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  } as Bill;
}

describe("Bill Occurrence Generation - Monthly", () => {
  it("generates one occurrence for monthly bill", () => {
    const bill = createMockBill({ frequency: "monthly", due_day: 15 });
    const occurrences = getBillOccurrencesForMonth([bill], 2025, 5); // June 2025
    
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].dueDate.getDate()).toBe(15);
    expect(occurrences[0].dueDate.getMonth()).toBe(5);
  });

  it("handles due day 31 in shorter months", () => {
    const bill = createMockBill({ frequency: "monthly", due_day: 31 });
    
    // February 2025 (28 days)
    const febOccurrences = getBillOccurrencesForMonth([bill], 2025, 1);
    expect(febOccurrences).toHaveLength(1);
    expect(febOccurrences[0].dueDate.getDate()).toBe(28);
    
    // April 2025 (30 days)
    const aprOccurrences = getBillOccurrencesForMonth([bill], 2025, 3);
    expect(aprOccurrences).toHaveLength(1);
    expect(aprOccurrences[0].dueDate.getDate()).toBe(30);
  });

  it("respects start_date", () => {
    const bill = createMockBill({ start_date: "2025-06-01" });
    
    // May 2025: before start date
    const mayOccurrences = getBillOccurrencesForMonth([bill], 2025, 4);
    expect(mayOccurrences).toHaveLength(0);
    
    // June 2025: on start date
    const juneOccurrences = getBillOccurrencesForMonth([bill], 2025, 5);
    expect(juneOccurrences).toHaveLength(1);
  });

  it("respects end_date", () => {
    const bill = createMockBill({ end_date: "2025-03-01" });
    
    // February 2025: before end date
    const febOccurrences = getBillOccurrencesForMonth([bill], 2025, 1);
    expect(febOccurrences).toHaveLength(1);
    
    // April 2025: after end date
    const aprOccurrences = getBillOccurrencesForMonth([bill], 2025, 3);
    expect(aprOccurrences).toHaveLength(0);
  });

  it("inactive bills generate no occurrences", () => {
    const bill = createMockBill({ is_active: false });
    const occurrences = getBillOccurrencesForMonth([bill], 2025, 5);
    expect(occurrences).toHaveLength(0);
  });
});

describe("Bill Occurrence Generation - Weekly", () => {
  it("generates multiple occurrences for weekly bill", () => {
    const bill = createMockBill({ 
      frequency: "weekly", 
      due_day: 1,
      start_date: "2025-06-01" // Start on June 1, 2025 (Sunday)
    });
    
    const occurrences = getBillOccurrencesForMonth([bill], 2025, 5); // June 2025
    
    // Should have 4-5 occurrences in June
    expect(occurrences.length).toBeGreaterThanOrEqual(4);
    expect(occurrences.length).toBeLessThanOrEqual(5);
  });

  it("generates correct number of fortnightly occurrences", () => {
    const bill = createMockBill({ 
      frequency: "fortnightly",
      start_date: "2025-06-01"
    });
    
    const occurrences = getBillOccurrencesForMonth([bill], 2025, 5); // June 2025
    
    // Should have 2-3 occurrences (every 2 weeks)
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
    expect(occurrences.length).toBeLessThanOrEqual(3);
  });
});

describe("Bill Occurrence Generation - Quarterly", () => {
  it("generates occurrence in quarter months", () => {
    const bill = createMockBill({ 
      frequency: "quarterly",
      start_date: "2025-01-15"
    });
    
    // Check January (quarter start)
    const janOccurrences = getBillOccurrencesForMonth([bill], 2025, 0);
    expect(janOccurrences).toHaveLength(1);
    
    // Check April (quarter start)
    const aprOccurrences = getBillOccurrencesForMonth([bill], 2025, 3);
    expect(aprOccurrences).toHaveLength(1);
  });
});

describe("Bill Occurrence Generation - Yearly", () => {
  it("generates one occurrence per year on due_day", () => {
    const bill = createMockBill({ 
      frequency: "yearly",
      due_day: 15,
      start_date: "2024-01-15" // Started Jan 15, 2024
    });
    
    // January 2025: should have occurrence on the 15th
    const janOccurrences = getBillOccurrencesForMonth([bill], 2025, 0);
    expect(janOccurrences).toHaveLength(1);
    expect(janOccurrences[0].dueDate.getDate()).toBe(15);
    expect(janOccurrences[0].dueDate.getMonth()).toBe(0);
    
    // January 2026: should also have occurrence
    const jan2026Occurrences = getBillOccurrencesForMonth([bill], 2026, 0);
    expect(jan2026Occurrences).toHaveLength(1);
  });
});

describe("Bill Occurrence Generation - Biannual", () => {
  it("generates occurrences every 6 months", () => {
    const bill = createMockBill({ 
      frequency: "biannual" as any,
      due_day: 15,
      start_date: "2025-01-15" // Started Jan 15, 2025
    });
    
    // Check full year range
    const rangeStart = new Date(2025, 0, 1); // Jan 1, 2025
    const rangeEnd = new Date(2025, 11, 31); // Dec 31, 2025
    
    const occurrences = getBillOccurrencesInRange([bill], rangeStart, rangeEnd);
    
    // Should have 2 occurrences: Jan 15 and Jul 15
    expect(occurrences).toHaveLength(2);
    expect(occurrences[0].dueDate.getMonth()).toBe(0); // January
    expect(occurrences[1].dueDate.getMonth()).toBe(6); // July
  });
});

describe("Bill Occurrence - Range Queries", () => {
  it("generates occurrences across multiple months", () => {
    const bill = createMockBill({ frequency: "monthly", due_day: 15 });
    
    const rangeStart = new Date(2025, 0, 1); // Jan 1
    const rangeEnd = new Date(2025, 2, 31); // Mar 31
    
    const occurrences = getBillOccurrencesInRange([bill], rangeStart, rangeEnd);
    
    expect(occurrences).toHaveLength(3);
    expect(occurrences[0].dueDate.getMonth()).toBe(0); // January
    expect(occurrences[1].dueDate.getMonth()).toBe(1); // February
    expect(occurrences[2].dueDate.getMonth()).toBe(2); // March
  });
});

describe("Bill Occurrence - Multiple Bills", () => {
  it("generates occurrences for multiple bills", () => {
    const bills = [
      createMockBill({ id: "bill-1", name: "Netflix", due_day: 5 }),
      createMockBill({ id: "bill-2", name: "Spotify", due_day: 15 }),
      createMockBill({ id: "bill-3", name: "Rent", due_day: 1 }),
    ];
    
    const occurrences = getBillOccurrencesForMonth(bills, 2025, 5);
    
    expect(occurrences).toHaveLength(3);
    expect(occurrences.map(o => o.billName).sort()).toEqual(["Netflix", "Rent", "Spotify"]);
  });
});

describe("Bill Occurrence - ID Generation", () => {
  it("generates unique IDs for each occurrence", () => {
    const bill = createMockBill({ frequency: "weekly", start_date: "2025-06-01" });
    const occurrences = getBillOccurrencesForMonth([bill], 2025, 5);
    
    const ids = occurrences.map(o => o.id);
    const uniqueIds = new Set(ids);
    
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("ID format includes bill ID and date", () => {
    const bill = createMockBill({ id: "test-bill-123", due_day: 15 });
    const occurrences = getBillOccurrencesForMonth([bill], 2025, 5);
    
    expect(occurrences[0].id).toBe("test-bill-123-2025-06-15");
  });
});
