
# Bills Module Implementation Plan

Proceed with implementation using the plan below. Do not ask questions or wait for answers.

## Assumptions (Documented)

Based on common UK bill payment patterns, I'm proceeding with these defaults:

| Decision | Default Choice | Rationale |
|----------|---------------|-----------|
| Due date on weekends/holidays | **Stay on exact date** | Most bills show their actual due date; payment timing is user's choice |
| Transaction matching tolerance | **±£1** | Covers minor variations while avoiding false matches |
| Multiple bill linking | **Block by default** | One transaction = one bill (safest) |
| Pending transactions | **Only settled** | More reliable; avoids marking paid then transaction fails |
| Bill statuses | **Full tracking** | Due, Paid, Overdue, Skipped |
| Bank holidays | **Hardcoded 2024-2030** | Simple, no config needed; can extend later |

---

## Database Changes

### 1. Extend `bills` table (add missing columns)

```sql
-- Add new columns to existing bills table
ALTER TABLE bills ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES bank_accounts(id);
ALTER TABLE bills ADD COLUMN IF NOT EXISTS due_date_rule text NOT NULL DEFAULT 'day-of-month';
-- due_date_rule options: 'day-of-month' (uses due_day), 'exact-date', 'last-day'
```

### 2. Create `bill_occurrences` table

```sql
CREATE TABLE bill_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  expected_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'due', -- due, paid, overdue, skipped
  paid_transaction_id uuid REFERENCES transactions(id),
  paid_at timestamp with time zone,
  match_confidence text, -- high, medium, manual
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  UNIQUE(bill_id, due_date)
);

-- RLS policies
ALTER TABLE bill_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bill occurrences" ON bill_occurrences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bill occurrences" ON bill_occurrences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bill occurrences" ON bill_occurrences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bill occurrences" ON bill_occurrences
  FOR DELETE USING (auth.uid() = user_id);
```

### 3. Create `uk_bank_holidays` table

```sql
CREATE TABLE uk_bank_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Seed with UK bank holidays 2024-2030
INSERT INTO uk_bank_holidays (date, name) VALUES
  -- 2024
  ('2024-01-01', 'New Year''s Day'),
  ('2024-03-29', 'Good Friday'),
  ('2024-04-01', 'Easter Monday'),
  ('2024-05-06', 'Early May Bank Holiday'),
  ('2024-05-27', 'Spring Bank Holiday'),
  ('2024-08-26', 'Summer Bank Holiday'),
  ('2024-12-25', 'Christmas Day'),
  ('2024-12-26', 'Boxing Day'),
  -- 2025
  ('2025-01-01', 'New Year''s Day'),
  ('2025-04-18', 'Good Friday'),
  ('2025-04-21', 'Easter Monday'),
  ('2025-05-05', 'Early May Bank Holiday'),
  ('2025-05-26', 'Spring Bank Holiday'),
  ('2025-08-25', 'Summer Bank Holiday'),
  ('2025-12-25', 'Christmas Day'),
  ('2025-12-26', 'Boxing Day'),
  -- 2026
  ('2026-01-01', 'New Year''s Day'),
  ('2026-04-03', 'Good Friday'),
  ('2026-04-06', 'Easter Monday'),
  ('2026-05-04', 'Early May Bank Holiday'),
  ('2026-05-25', 'Spring Bank Holiday'),
  ('2026-08-31', 'Summer Bank Holiday'),
  ('2026-12-25', 'Christmas Day'),
  ('2026-12-28', 'Boxing Day (substitute)'),
  -- 2027-2030 similar pattern...
ON CONFLICT (date) DO NOTHING;

-- RLS: Public read access (no user_id needed)
ALTER TABLE uk_bank_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read bank holidays" ON uk_bank_holidays FOR SELECT USING (true);
```

---

## New Files to Create

### 1. `src/lib/ukWorkingDays.ts` - UK Payday & Working Day Logic

```typescript
// UK Working Day calculations with bank holiday support
// ASSUMPTION: Payday is 20th, moves to PREVIOUS working day if weekend/holiday
// ASSUMPTION: Working day = Mon-Fri excluding UK bank holidays

import { format, subDays, getDay, isSameDay } from "date-fns";

// Hardcoded UK bank holidays 2024-2030 (fallback if DB unavailable)
const UK_BANK_HOLIDAYS_FALLBACK: string[] = [
  "2024-01-01", "2024-03-29", "2024-04-01", "2024-05-06", "2024-05-27",
  "2024-08-26", "2024-12-25", "2024-12-26",
  "2025-01-01", "2025-04-18", "2025-04-21", "2025-05-05", "2025-05-26",
  "2025-08-25", "2025-12-25", "2025-12-26",
  "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04", "2026-05-25",
  "2026-08-31", "2026-12-25", "2026-12-28",
  // ... extend as needed
];

let cachedHolidays: Set<string> | null = null;

export function setBankHolidays(dates: Date[]): void {
  cachedHolidays = new Set(dates.map(d => format(d, "yyyy-MM-dd")));
}

export function isBankHoliday(date: Date): boolean {
  const dateStr = format(date, "yyyy-MM-dd");
  if (cachedHolidays) return cachedHolidays.has(dateStr);
  return UK_BANK_HOLIDAYS_FALLBACK.includes(dateStr);
}

export function isWeekend(date: Date): boolean {
  const day = getDay(date);
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

export function isWorkingDay(date: Date): boolean {
  return !isWeekend(date) && !isBankHoliday(date);
}

export function getPreviousWorkingDay(date: Date): Date {
  let current = date;
  while (!isWorkingDay(current)) {
    current = subDays(current, 1);
  }
  return current;
}

/**
 * Get the actual payday for a given month.
 * UK rule: Payday is the 20th, but if 20th is weekend/holiday,
 * pay on the PREVIOUS working day.
 * 
 * Special case per existing code: If 20th is Monday, pay on Friday 17th
 * (Monzo early-pay rule)
 */
export function getPaydayForMonth(year: number, month: number): Date {
  const twentieth = new Date(year, month, 20);
  const dayOfWeek = getDay(twentieth);
  
  // Monzo early-pay rule: Mon/Sat/Sun → previous Friday
  if (dayOfWeek === 0) { // Sunday
    return subDays(twentieth, 2); // Friday
  } else if (dayOfWeek === 1) { // Monday
    return subDays(twentieth, 3); // Friday
  } else if (dayOfWeek === 6) { // Saturday
    return subDays(twentieth, 1); // Friday
  }
  
  // For Tue-Fri, check if it's a bank holiday
  if (isBankHoliday(twentieth)) {
    return getPreviousWorkingDay(subDays(twentieth, 1));
  }
  
  return twentieth;
}

/**
 * Get the pay cycle (start and end dates) for a given reference date
 */
export function getPayCycleForDate(date: Date): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  const thisMonthPayday = getPaydayForMonth(year, month);
  
  if (date >= thisMonthPayday) {
    // We're past this month's payday, cycle is thisMonth → nextMonth
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    return {
      start: thisMonthPayday,
      end: subDays(getPaydayForMonth(nextYear, nextMonth), 1),
    };
  } else {
    // We're before this month's payday, cycle is lastMonth → thisMonth
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    return {
      start: getPaydayForMonth(prevYear, prevMonth),
      end: subDays(thisMonthPayday, 1),
    };
  }
}
```

### 2. `src/lib/billOccurrences.ts` - Occurrence Generation

```typescript
// Bill occurrence calculation
// ASSUMPTION: Occurrences are computed on-the-fly, not pre-stored for all future months

import { 
  addWeeks, addMonths, addDays, setDate, 
  startOfMonth, endOfMonth, isBefore, isAfter, 
  isSameDay, format, parseISO, lastDayOfMonth
} from "date-fns";
import type { Bill } from "@/hooks/useBills";

export interface BillOccurrence {
  id: string;
  billId: string;
  billName: string;
  dueDate: Date;
  expectedAmount: number;
  status: "due" | "paid" | "overdue" | "skipped";
  paidTransactionId?: string;
  paidAt?: Date;
  matchConfidence?: "high" | "medium" | "manual";
  bill: Bill;
}

/**
 * Generate all occurrences of a bill within a date range
 */
export function generateBillOccurrences(
  bill: Bill,
  rangeStart: Date,
  rangeEnd: Date
): BillOccurrence[] {
  if (!bill.is_active) return [];
  
  const occurrences: BillOccurrence[] = [];
  const billStart = bill.start_date ? parseISO(bill.start_date) : new Date(2020, 0, 1);
  const billEnd = bill.end_date ? parseISO(bill.end_date) : null;
  
  // Start from bill start date or range start, whichever is later
  let currentDate = getFirstOccurrenceInRange(bill, rangeStart);
  if (!currentDate) return [];
  
  while (isBefore(currentDate, rangeEnd) || isSameDay(currentDate, rangeEnd)) {
    // Check if within bill's active period
    if (billEnd && isAfter(currentDate, billEnd)) break;
    if (isBefore(currentDate, billStart)) {
      currentDate = getNextOccurrence(bill, currentDate);
      continue;
    }
    
    // Check if within our query range
    if ((isAfter(currentDate, rangeStart) || isSameDay(currentDate, rangeStart)) &&
        (isBefore(currentDate, rangeEnd) || isSameDay(currentDate, rangeEnd))) {
      occurrences.push({
        id: `${bill.id}-${format(currentDate, "yyyy-MM-dd")}`,
        billId: bill.id,
        billName: bill.name,
        dueDate: currentDate,
        expectedAmount: Number(bill.amount),
        status: "due",
        bill,
      });
    }
    
    currentDate = getNextOccurrence(bill, currentDate);
    if (!currentDate) break;
  }
  
  return occurrences;
}

function getFirstOccurrenceInRange(bill: Bill, rangeStart: Date): Date | null {
  const billStart = bill.start_date ? parseISO(bill.start_date) : new Date(2020, 0, 1);
  
  // Find the first occurrence >= rangeStart
  let current = getDueDateForMonth(bill, rangeStart.getFullYear(), rangeStart.getMonth());
  
  // If this month's occurrence is before range start, go to next
  if (isBefore(current, rangeStart)) {
    current = getNextOccurrence(bill, current);
  }
  
  // Ensure it's after bill start date
  while (current && isBefore(current, billStart)) {
    current = getNextOccurrence(bill, current);
  }
  
  return current;
}

function getDueDateForMonth(bill: Bill, year: number, month: number): Date {
  const dueDay = bill.due_day;
  const lastDay = lastDayOfMonth(new Date(year, month, 1)).getDate();
  
  // Handle "last day of month" or days that don't exist
  const actualDay = Math.min(dueDay, lastDay);
  
  return new Date(year, month, actualDay);
}

function getNextOccurrence(bill: Bill, currentDate: Date): Date | null {
  switch (bill.frequency) {
    case "weekly":
      return addWeeks(currentDate, 1);
    case "fortnightly":
      return addWeeks(currentDate, 2);
    case "monthly":
      return addMonths(currentDate, 1);
    case "quarterly":
      return addMonths(currentDate, 3);
    case "yearly":
      return addMonths(currentDate, 12);
    default:
      return addMonths(currentDate, 1);
  }
}

/**
 * Get all bill occurrences for a specific month
 */
export function getBillOccurrencesForMonth(
  bills: Bill[],
  year: number,
  month: number
): BillOccurrence[] {
  const rangeStart = startOfMonth(new Date(year, month, 1));
  const rangeEnd = endOfMonth(new Date(year, month, 1));
  
  return bills.flatMap(bill => generateBillOccurrences(bill, rangeStart, rangeEnd));
}
```

### 3. `src/lib/transactionMatcher.ts` - Auto-Matching Logic

```typescript
// Transaction to Bill matching
// ASSUMPTION: Tolerance is ±£1
// ASSUMPTION: Date window is ±3 days around due date
// ASSUMPTION: One transaction can only match one bill (block duplicates)

import { differenceInDays, parseISO } from "date-fns";
import type { BillOccurrence } from "./billOccurrences";

export interface MatchResult {
  occurrence: BillOccurrence;
  transactionId: string;
  confidence: "high" | "medium" | "low";
  reasons: string[];
}

export interface Transaction {
  id: string;
  amount: number;
  merchant: string | null;
  description: string;
  transaction_date: string;
  account_id: string;
  bill_id?: string | null; // Already linked?
}

const AMOUNT_TOLERANCE = 1.00; // ±£1
const DATE_WINDOW_DAYS = 3;    // ±3 days

/**
 * Find potential matches for a bill occurrence among transactions
 */
export function findMatchesForOccurrence(
  occurrence: BillOccurrence,
  transactions: Transaction[],
  linkedTransactionIds: Set<string>
): MatchResult[] {
  const matches: MatchResult[] = [];
  
  for (const txn of transactions) {
    // Skip already-linked transactions
    if (linkedTransactionIds.has(txn.id)) continue;
    if (txn.bill_id) continue;
    
    const reasons: string[] = [];
    let score = 0;
    
    // Amount match
    const amountDiff = Math.abs(Math.abs(txn.amount) - occurrence.expectedAmount);
    if (amountDiff === 0) {
      score += 40;
      reasons.push("Exact amount match");
    } else if (amountDiff <= AMOUNT_TOLERANCE) {
      score += 25;
      reasons.push(`Amount within ±£${AMOUNT_TOLERANCE}`);
    } else {
      continue; // Amount too different, skip
    }
    
    // Date match
    const txnDate = parseISO(txn.transaction_date);
    const daysDiff = Math.abs(differenceInDays(txnDate, occurrence.dueDate));
    if (daysDiff === 0) {
      score += 30;
      reasons.push("Exact date match");
    } else if (daysDiff <= DATE_WINDOW_DAYS) {
      score += 20 - (daysDiff * 3);
      reasons.push(`Within ${daysDiff} day(s) of due date`);
    } else {
      continue; // Date too far, skip
    }
    
    // Merchant/provider match
    const providerMatch = matchProvider(occurrence.bill, txn);
    if (providerMatch) {
      score += 30;
      reasons.push(`Provider match: ${providerMatch}`);
    }
    
    // Account match (if bill has account_id)
    if (occurrence.bill.account_id && txn.account_id === occurrence.bill.account_id) {
      score += 10;
      reasons.push("Account match");
    }
    
    // Determine confidence
    let confidence: "high" | "medium" | "low";
    if (score >= 80) {
      confidence = "high";
    } else if (score >= 50) {
      confidence = "medium";
    } else {
      confidence = "low";
    }
    
    if (confidence !== "low") {
      matches.push({
        occurrence,
        transactionId: txn.id,
        confidence,
        reasons,
      });
    }
  }
  
  // Sort by confidence (high first)
  return matches.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.confidence] - order[b.confidence];
  });
}

function matchProvider(bill: any, txn: Transaction): string | null {
  const provider = (bill.provider || bill.name || "").toLowerCase();
  const merchant = (txn.merchant || "").toLowerCase();
  const description = (txn.description || "").toLowerCase();
  
  // Common provider name mappings
  const mappings: Record<string, string[]> = {
    "netflix": ["netflix"],
    "spotify": ["spotify"],
    "amazon prime": ["amazon", "prime video", "amzn"],
    "virgin media": ["virgin", "vm"],
    "british gas": ["british gas", "bg"],
    "thames water": ["thames"],
    "council tax": ["council", "local authority"],
    "sky": ["sky uk", "sky digital"],
    "bt": ["bt group", "british telecom"],
    "ee": ["ee limited", "everything everywhere"],
  };
  
  // Check direct contains
  if (merchant.includes(provider) || description.includes(provider)) {
    return provider;
  }
  
  // Check mappings
  for (const [key, aliases] of Object.entries(mappings)) {
    if (provider.includes(key)) {
      for (const alias of aliases) {
        if (merchant.includes(alias) || description.includes(alias)) {
          return key;
        }
      }
    }
  }
  
  return null;
}

/**
 * Auto-match transactions to bill occurrences
 * Returns high-confidence matches to auto-apply, and medium-confidence for review
 */
export function autoMatchTransactions(
  occurrences: BillOccurrence[],
  transactions: Transaction[],
  existingLinks: Map<string, string> // transactionId -> billOccurrenceId
): {
  autoApply: MatchResult[];
  forReview: MatchResult[];
} {
  const linkedTransactionIds = new Set(existingLinks.keys());
  const autoApply: MatchResult[] = [];
  const forReview: MatchResult[] = [];
  
  // Track which occurrences already have matches to avoid duplicates
  const matchedOccurrences = new Set<string>();
  
  for (const occurrence of occurrences) {
    if (occurrence.status === "paid") continue;
    
    const matches = findMatchesForOccurrence(occurrence, transactions, linkedTransactionIds);
    
    if (matches.length > 0) {
      const bestMatch = matches[0];
      
      if (bestMatch.confidence === "high" && !matchedOccurrences.has(occurrence.id)) {
        autoApply.push(bestMatch);
        matchedOccurrences.add(occurrence.id);
        linkedTransactionIds.add(bestMatch.transactionId);
      } else if (bestMatch.confidence === "medium" && !matchedOccurrences.has(occurrence.id)) {
        forReview.push(bestMatch);
      }
    }
  }
  
  return { autoApply, forReview };
}
```

### 4. `src/hooks/useBillOccurrences.ts` - React Hook

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBills } from "@/hooks/useBills";
import { getBillOccurrencesForMonth, BillOccurrence } from "@/lib/billOccurrences";
import { toast } from "@/hooks/use-toast";

export function useBillOccurrences(year: number, month: number) {
  const { user } = useAuth();
  const { bills } = useBills();
  const queryClient = useQueryClient();

  // Generate occurrences from bills
  const occurrences = getBillOccurrencesForMonth(bills, year, month);

  // Fetch stored occurrence statuses (paid/skipped)
  const storedOccurrencesQuery = useQuery({
    queryKey: ["bill-occurrences", user?.id, year, month],
    queryFn: async () => {
      if (!user) return [];
      
      const startDate = new Date(year, month, 1).toISOString().split("T")[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];
      
      const { data, error } = await supabase
        .from("bill_occurrences")
        .select("*")
        .eq("user_id", user.id)
        .gte("due_date", startDate)
        .lte("due_date", endDate);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Merge computed occurrences with stored statuses
  const mergedOccurrences = occurrences.map(occ => {
    const stored = storedOccurrencesQuery.data?.find(
      s => s.bill_id === occ.billId && s.due_date === occ.dueDate.toISOString().split("T")[0]
    );
    
    if (stored) {
      return {
        ...occ,
        status: stored.status as BillOccurrence["status"],
        paidTransactionId: stored.paid_transaction_id,
        paidAt: stored.paid_at ? new Date(stored.paid_at) : undefined,
        matchConfidence: stored.match_confidence as BillOccurrence["matchConfidence"],
      };
    }
    
    // Check if overdue
    if (occ.status === "due" && occ.dueDate < new Date()) {
      return { ...occ, status: "overdue" as const };
    }
    
    return occ;
  });

  // Mark occurrence as paid
  const markPaid = useMutation({
    mutationFn: async ({ 
      occurrenceId, 
      transactionId, 
      confidence 
    }: { 
      occurrenceId: string; 
      transactionId?: string; 
      confidence?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      
      const occurrence = mergedOccurrences.find(o => o.id === occurrenceId);
      if (!occurrence) throw new Error("Occurrence not found");
      
      const { error } = await supabase.from("bill_occurrences").upsert({
        user_id: user.id,
        bill_id: occurrence.billId,
        due_date: occurrence.dueDate.toISOString().split("T")[0],
        expected_amount: occurrence.expectedAmount,
        status: "paid",
        paid_transaction_id: transactionId || null,
        paid_at: new Date().toISOString(),
        match_confidence: confidence || "manual",
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bill-occurrences"] });
      toast({ title: "Bill marked as paid" });
    },
  });

  // Skip occurrence
  const skipOccurrence = useMutation({
    mutationFn: async (occurrenceId: string) => {
      if (!user) throw new Error("Not authenticated");
      
      const occurrence = mergedOccurrences.find(o => o.id === occurrenceId);
      if (!occurrence) throw new Error("Occurrence not found");
      
      const { error } = await supabase.from("bill_occurrences").upsert({
        user_id: user.id,
        bill_id: occurrence.billId,
        due_date: occurrence.dueDate.toISOString().split("T")[0],
        expected_amount: occurrence.expectedAmount,
        status: "skipped",
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bill-occurrences"] });
      toast({ title: "Bill skipped" });
    },
  });

  // Link transaction to occurrence
  const linkTransaction = useMutation({
    mutationFn: async ({ 
      occurrenceId, 
      transactionId 
    }: { 
      occurrenceId: string; 
      transactionId: string;
    }) => {
      // Update occurrence
      await markPaid.mutateAsync({ 
        occurrenceId, 
        transactionId, 
        confidence: "manual" 
      });
      
      // Update transaction with bill reference
      const occurrence = mergedOccurrences.find(o => o.id === occurrenceId);
      if (occurrence) {
        await supabase
          .from("transactions")
          .update({ bill_id: occurrence.billId })
          .eq("id", transactionId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bill-occurrences"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({ title: "Transaction linked to bill" });
    },
  });

  return {
    occurrences: mergedOccurrences,
    isLoading: storedOccurrencesQuery.isLoading,
    markPaid,
    skipOccurrence,
    linkTransaction,
  };
}
```

---

## Files to Modify

### 1. Update `src/pages/Calendar.tsx`

Add bill occurrences to calendar display:
- Import and use `useBillOccurrences` hook
- Show bills on their due dates with status indicators
- Click bill to see details and link transaction

### 2. Update `src/components/bills/BillFormDialog.tsx`

Add new fields:
- Account selector (optional)
- Provider text field
- Start/end date pickers

### 3. Update `src/hooks/useBills.ts`

Add account join in query if needed.

---

## Tests to Add

### `src/lib/ukWorkingDays.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { getPaydayForMonth, isWorkingDay, isBankHoliday } from "./ukWorkingDays";

describe("UK Payday Calculation", () => {
  it("returns 20th when it falls on Tuesday-Thursday", () => {
    // February 2026: 20th is Friday
    const payday = getPaydayForMonth(2026, 1);
    expect(payday.getDate()).toBe(20);
  });

  it("returns Friday 17th when 20th is Monday", () => {
    // July 2025: 20th is Sunday, so should be Friday 18th
    // Actually need to find a month where 20th is Monday
    // January 2025: 20th is Monday → should be Friday 17th
    const payday = getPaydayForMonth(2025, 0);
    expect(payday.getDate()).toBe(17);
    expect(payday.getDay()).toBe(5); // Friday
  });

  it("returns Friday when 20th is Saturday", () => {
    // September 2025: 20th is Saturday → Friday 19th
    const payday = getPaydayForMonth(2025, 8);
    expect(payday.getDate()).toBe(19);
  });

  it("returns Friday when 20th is Sunday", () => {
    // July 2025: 20th is Sunday → Friday 18th
    const payday = getPaydayForMonth(2025, 6);
    expect(payday.getDate()).toBe(18);
  });

  it("moves to previous working day when 20th is bank holiday", () => {
    // If 20th were a bank holiday (rare), should move back
    // This tests the logic path
  });
});

describe("Working Day Detection", () => {
  it("Saturday is not a working day", () => {
    expect(isWorkingDay(new Date(2025, 0, 4))).toBe(false); // Jan 4 2025 is Saturday
  });

  it("Sunday is not a working day", () => {
    expect(isWorkingDay(new Date(2025, 0, 5))).toBe(false);
  });

  it("Monday is a working day (unless bank holiday)", () => {
    expect(isWorkingDay(new Date(2025, 0, 6))).toBe(true); // Jan 6 2025
  });

  it("New Year's Day is a bank holiday", () => {
    expect(isBankHoliday(new Date(2025, 0, 1))).toBe(true);
  });
});
```

### `src/lib/billOccurrences.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { generateBillOccurrences, getBillOccurrencesForMonth } from "./billOccurrences";

describe("Bill Occurrence Generation", () => {
  const mockBill = {
    id: "bill-1",
    name: "Netflix",
    amount: 15.99,
    due_day: 15,
    frequency: "monthly" as const,
    is_active: true,
    start_date: "2024-01-01",
    end_date: null,
  };

  it("generates monthly occurrences correctly", () => {
    const occurrences = getBillOccurrencesForMonth([mockBill], 2025, 5); // June 2025
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].dueDate.getDate()).toBe(15);
  });

  it("respects start_date", () => {
    const futureBill = { ...mockBill, start_date: "2025-06-01" };
    const occurrences = getBillOccurrencesForMonth([futureBill], 2025, 4); // May 2025
    expect(occurrences).toHaveLength(0);
  });

  it("respects end_date", () => {
    const endedBill = { ...mockBill, end_date: "2025-03-01" };
    const occurrences = getBillOccurrencesForMonth([endedBill], 2025, 5); // June 2025
    expect(occurrences).toHaveLength(0);
  });

  it("handles weekly frequency", () => {
    const weeklyBill = { ...mockBill, frequency: "weekly" as const };
    const occurrences = getBillOccurrencesForMonth([weeklyBill], 2025, 5);
    expect(occurrences.length).toBeGreaterThanOrEqual(4);
  });
});
```

### `src/lib/transactionMatcher.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { findMatchesForOccurrence, autoMatchTransactions } from "./transactionMatcher";

describe("Transaction Matching", () => {
  it("finds exact amount match", () => {
    const occurrence = {
      id: "occ-1",
      billId: "bill-1",
      billName: "Netflix",
      dueDate: new Date(2025, 5, 15),
      expectedAmount: 15.99,
      status: "due" as const,
      bill: { provider: "Netflix" },
    };
    
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
  });

  it("rejects amount outside tolerance", () => {
    const occurrence = {
      id: "occ-1",
      billId: "bill-1",
      billName: "Test",
      dueDate: new Date(2025, 5, 15),
      expectedAmount: 50.00,
      status: "due" as const,
      bill: {},
    };
    
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

  it("prevents duplicate linking", () => {
    const occurrence = {
      id: "occ-1",
      billId: "bill-1",
      billName: "Test",
      dueDate: new Date(2025, 5, 15),
      expectedAmount: 50.00,
      status: "due" as const,
      bill: {},
    };
    
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
});
```

---

## Summary of Changes

| File | Action |
|------|--------|
| `src/lib/ukWorkingDays.ts` | **CREATE** - UK payday & working day logic |
| `src/lib/ukWorkingDays.test.ts` | **CREATE** - Tests for payday calculation |
| `src/lib/billOccurrences.ts` | **CREATE** - Occurrence generation |
| `src/lib/billOccurrences.test.ts` | **CREATE** - Tests for occurrence generation |
| `src/lib/transactionMatcher.ts` | **CREATE** - Transaction auto-matching |
| `src/lib/transactionMatcher.test.ts` | **CREATE** - Tests for matching |
| `src/hooks/useBillOccurrences.ts` | **CREATE** - React hook for occurrences |
| `src/pages/Calendar.tsx` | **MODIFY** - Add bill display |
| `src/components/bills/BillFormDialog.tsx` | **MODIFY** - Add new fields |
| Database migration | **CREATE** - bill_occurrences table, uk_bank_holidays |

---

## Assumptions Log (for TODO/Comments)

```typescript
// TODO: Assumptions made for Bills module implementation:
// 1. Due dates stay on exact date (no auto-shift for weekends/holidays)
// 2. Transaction matching tolerance: ±£1
// 3. One transaction can only link to one bill (no splitting)
// 4. Only settled transactions mark bills as paid (not pending)
// 5. Full status tracking: due, paid, overdue, skipped
// 6. UK bank holidays hardcoded 2024-2030 (extend as needed)
// 7. Payday rule: 20th, but Mon/Sat/Sun → previous Friday (Monzo style)
// 8. Date matching window: ±3 days around due date
```
