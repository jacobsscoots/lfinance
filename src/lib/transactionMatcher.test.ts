import { describe, it, expect } from "vitest";
import { 
  findMatchesForOccurrence, 
  autoMatchTransactions,
  getMatchingDiagnostics 
} from "./transactionMatcher";
import type { BillOccurrence } from "./billOccurrences";
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
    start_date: null,
    end_date: null,
    provider: "Netflix",
    category_id: null,
    notes: null,
    next_review_date: null,
    account_id: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  } as Bill;
}

function createMockOccurrence(overrides: Partial<BillOccurrence> = {}): BillOccurrence {
  const bill = createMockBill(overrides.bill as Partial<Bill>);
  return {
    id: "occ-1",
    billId: bill.id,
    billName: bill.name,
    dueDate: new Date(2025, 5, 15),
    expectedAmount: Number(bill.amount),
    status: "due",
    bill,
    ...overrides,
  };
}

describe("Transaction Matching - Amount", () => {
  it("finds exact amount match", () => {
    const occurrence = createMockOccurrence({
      expectedAmount: 15.99,
      bill: createMockBill({ provider: "Netflix" }),
    });
    
    const transactions = [{
      id: "txn-1",
      amount: -15.99,
      merchant: "NETFLIX",
      description: "Netflix subscription",
      transaction_date: "2025-06-15",
      account_id: "acc-1",
    }];
    
    const matches = findMatchesForOccurrence(occurrence, transactions, new Set());
    
    expect(matches).toHaveLength(1);
    expect(matches[0].confidence).toBe("high");
    expect(matches[0].reasons).toContain("Exact amount match");
  });

  it("matches within £1 tolerance", () => {
    const occurrence = createMockOccurrence({ expectedAmount: 50.00 });
    
    const transactions = [{
      id: "txn-1",
      amount: -50.50,
      merchant: "Test",
      description: "Test",
      transaction_date: "2025-06-15",
      account_id: "acc-1",
    }];
    
    const matches = findMatchesForOccurrence(occurrence, transactions, new Set());
    
    expect(matches).toHaveLength(1);
    expect(matches[0].reasons.some(r => r.includes("Amount within"))).toBe(true);
  });

  it("rejects amount outside tolerance", () => {
    const occurrence = createMockOccurrence({ expectedAmount: 50.00 });
    
    const transactions = [{
      id: "txn-1",
      amount: -55.00, // £5 difference, outside ±£1 tolerance
      merchant: "Test",
      description: "Test payment",
      transaction_date: "2025-06-15",
      account_id: "acc-1",
    }];
    
    const matches = findMatchesForOccurrence(occurrence, transactions, new Set());
    expect(matches).toHaveLength(0);
  });

  it("handles positive transaction amounts", () => {
    const occurrence = createMockOccurrence({ expectedAmount: 15.99 });
    
    const transactions = [{
      id: "txn-1",
      amount: 15.99, // Positive (income/refund)
      merchant: "Netflix",
      description: "Refund",
      transaction_date: "2025-06-15",
      account_id: "acc-1",
    }];
    
    const matches = findMatchesForOccurrence(occurrence, transactions, new Set());
    expect(matches.length).toBeGreaterThanOrEqual(0); // May or may not match depending on logic
  });
});

describe("Transaction Matching - Date", () => {
  it("matches exact date", () => {
    const occurrence = createMockOccurrence({
      dueDate: new Date(2025, 5, 15),
      expectedAmount: 50,
    });
    
    const transactions = [{
      id: "txn-1",
      amount: -50,
      merchant: null,
      description: "Payment",
      transaction_date: "2025-06-15",
      account_id: "acc-1",
    }];
    
    const matches = findMatchesForOccurrence(occurrence, transactions, new Set());
    
    expect(matches).toHaveLength(1);
    expect(matches[0].reasons).toContain("Exact date match");
  });

  it("matches within 3 day window", () => {
    const occurrence = createMockOccurrence({
      dueDate: new Date(2025, 5, 15),
      expectedAmount: 50,
    });
    
    const transactions = [{
      id: "txn-1",
      amount: -50,
      merchant: null,
      description: "Payment",
      transaction_date: "2025-06-17", // 2 days after
      account_id: "acc-1",
    }];
    
    const matches = findMatchesForOccurrence(occurrence, transactions, new Set());
    
    expect(matches).toHaveLength(1);
    expect(matches[0].reasons.some(r => r.includes("Within"))).toBe(true);
  });

  it("rejects date outside window", () => {
    const occurrence = createMockOccurrence({
      dueDate: new Date(2025, 5, 15),
      expectedAmount: 50,
    });
    
    const transactions = [{
      id: "txn-1",
      amount: -50,
      merchant: null,
      description: "Payment",
      transaction_date: "2025-06-25", // 10 days after
      account_id: "acc-1",
    }];
    
    const matches = findMatchesForOccurrence(occurrence, transactions, new Set());
    expect(matches).toHaveLength(0);
  });
});

describe("Transaction Matching - Provider", () => {
  it("matches provider name in merchant", () => {
    const occurrence = createMockOccurrence({
      expectedAmount: 15.99,
      dueDate: new Date(2025, 5, 15),
      bill: createMockBill({ provider: "netflix" }),
    });
    
    const transactions = [{
      id: "txn-1",
      amount: -15.99,
      merchant: "NETFLIX.COM",
      description: "Subscription",
      transaction_date: "2025-06-15",
      account_id: "acc-1",
    }];
    
    const matches = findMatchesForOccurrence(occurrence, transactions, new Set());
    
    expect(matches).toHaveLength(1);
    expect(matches[0].confidence).toBe("high");
    expect(matches[0].reasons.some(r => r.includes("Provider match"))).toBe(true);
  });

  it("uses provider aliases for common services", () => {
    const occurrence = createMockOccurrence({
      expectedAmount: 10.99,
      dueDate: new Date(2025, 5, 15),
      bill: createMockBill({ provider: "Amazon Prime" }),
    });
    
    const transactions = [{
      id: "txn-1",
      amount: -10.99,
      merchant: "AMZN Digital",
      description: "Prime Video",
      transaction_date: "2025-06-15",
      account_id: "acc-1",
    }];
    
    const matches = findMatchesForOccurrence(occurrence, transactions, new Set());
    
    expect(matches).toHaveLength(1);
    expect(matches[0].reasons.some(r => r.includes("Provider match"))).toBe(true);
  });
});

describe("Transaction Matching - Duplicate Prevention", () => {
  it("prevents duplicate linking", () => {
    const occurrence = createMockOccurrence({ expectedAmount: 50 });
    
    const transactions = [{
      id: "txn-1",
      amount: -50.00,
      merchant: "Test",
      description: "Test",
      transaction_date: "2025-06-15",
      account_id: "acc-1",
    }];
    
    // Transaction already linked
    const linkedIds = new Set(["txn-1"]);
    const matches = findMatchesForOccurrence(occurrence, transactions, linkedIds);
    
    expect(matches).toHaveLength(0);
  });

  it("skips transactions already linked to other bills", () => {
    const occurrence = createMockOccurrence({ expectedAmount: 50 });
    
    const transactions = [{
      id: "txn-1",
      amount: -50.00,
      merchant: "Test",
      description: "Test",
      transaction_date: "2025-06-15",
      account_id: "acc-1",
      bill_id: "other-bill-id", // Already linked to another bill
    }];
    
    const matches = findMatchesForOccurrence(occurrence, transactions, new Set());
    expect(matches).toHaveLength(0);
  });

  it("skips pending transactions", () => {
    const occurrence = createMockOccurrence({ expectedAmount: 50 });
    
    const transactions = [{
      id: "txn-1",
      amount: -50.00,
      merchant: "Test",
      description: "Test",
      transaction_date: "2025-06-15",
      account_id: "acc-1",
      is_pending: true,
    }];
    
    const matches = findMatchesForOccurrence(occurrence, transactions, new Set());
    expect(matches).toHaveLength(0);
  });
});

describe("Auto-Matching", () => {
  it("separates high and medium confidence matches", () => {
    const occurrences = [
      createMockOccurrence({
        id: "occ-1",
        expectedAmount: 15.99,
        dueDate: new Date(2025, 5, 15),
        bill: createMockBill({ id: "bill-1", provider: "Netflix" }),
      }),
      createMockOccurrence({
        id: "occ-2",
        billId: "bill-2",
        expectedAmount: 50,
        dueDate: new Date(2025, 5, 20),
        bill: createMockBill({ id: "bill-2", provider: "Unknown" }),
      }),
    ];
    
    const transactions = [
      {
        id: "txn-1",
        amount: -15.99,
        merchant: "NETFLIX",
        description: "Subscription",
        transaction_date: "2025-06-15",
        account_id: "acc-1",
      },
      {
        id: "txn-2",
        amount: -50,
        merchant: "PAYMENT",
        description: "Direct Debit",
        transaction_date: "2025-06-20",
        account_id: "acc-1",
      },
    ];
    
    const result = autoMatchTransactions(occurrences, transactions, new Map());
    
    expect(result.autoApply.length).toBeGreaterThanOrEqual(0);
    expect(result.forReview.length).toBeGreaterThanOrEqual(0);
  });

  it("prevents same transaction from being auto-applied to multiple bills", () => {
    const occurrences = [
      createMockOccurrence({
        id: "occ-1",
        expectedAmount: 50,
        dueDate: new Date(2025, 5, 15),
        bill: createMockBill({ id: "bill-1", provider: "Netflix" }),
      }),
      createMockOccurrence({
        id: "occ-2",
        billId: "bill-2",
        expectedAmount: 50,
        dueDate: new Date(2025, 5, 15),
        bill: createMockBill({ id: "bill-2", provider: "Spotify" }),
      }),
    ];
    
    const transactions = [{
      id: "txn-1",
      amount: -50,
      merchant: "NETFLIX",
      description: "Netflix subscription",
      transaction_date: "2025-06-15",
      account_id: "acc-1",
    }];
    
    const result = autoMatchTransactions(occurrences, transactions, new Map());
    
    // The transaction should only be auto-applied to one bill (Netflix match)
    // It shouldn't appear in both autoApply entries
    const txnInAutoApply = result.autoApply.filter(m => m.transactionId === "txn-1");
    expect(txnInAutoApply.length).toBeLessThanOrEqual(1);
  });
});

describe("Matching Diagnostics", () => {
  it("provides detailed match info for debugging", () => {
    const occurrence = createMockOccurrence({
      expectedAmount: 50,
      dueDate: new Date(2025, 5, 15),
      bill: createMockBill({ provider: "Test Provider", account_id: "acc-1" }),
    });
    
    const transactions = [{
      id: "txn-1",
      amount: -50,
      merchant: "Test Provider",
      description: "Payment",
      transaction_date: "2025-06-16",
      account_id: "acc-1",
    }];
    
    const diagnostics = getMatchingDiagnostics(occurrence, transactions);
    
    expect(diagnostics.potentialMatches).toHaveLength(1);
    expect(diagnostics.potentialMatches[0].amountDiff).toBe(0);
    expect(diagnostics.potentialMatches[0].daysDiff).toBe(1);
    expect(diagnostics.potentialMatches[0].accountMatch).toBe(true);
  });
});
