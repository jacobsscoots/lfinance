/**
 * Transaction to Bill matching
 * 
 * ASSUMPTIONS:
 * - Tolerance is ±£1
 * - Date window is ±3 days around due date
 * - One transaction can only match one bill (block duplicates)
 * - Only settled transactions mark bills as paid
 */

import { differenceInDays, parseISO } from "date-fns";
import type { BillOccurrence } from "./billOccurrences";
import type { Bill } from "@/hooks/useBills";

export interface MatchResult {
  occurrence: BillOccurrence;
  transactionId: string;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  score: number;
}

export interface Transaction {
  id: string;
  amount: number;
  merchant: string | null;
  description: string;
  transaction_date: string;
  account_id: string;
  bill_id?: string | null;
  is_pending?: boolean | null;
}

const AMOUNT_TOLERANCE = 1.00; // ±£1
const DATE_WINDOW_DAYS = 3;    // ±3 days

// Common provider name mappings for UK utilities and subscriptions
const PROVIDER_MAPPINGS: Record<string, string[]> = {
  "netflix": ["netflix", "nflx"],
  "spotify": ["spotify"],
  "amazon prime": ["amazon", "prime video", "amzn", "amazon prime"],
  "disney+": ["disney", "disney plus", "disneyplus"],
  "apple": ["apple.com", "apple music", "icloud"],
  "virgin media": ["virgin", "vm", "virgin media"],
  "british gas": ["british gas", "bg", "centrica"],
  "thames water": ["thames", "thames water"],
  "council tax": ["council", "local authority", "district council", "borough council"],
  "sky": ["sky uk", "sky digital", "sky.com"],
  "bt": ["bt group", "british telecom", "bt.com"],
  "ee": ["ee limited", "everything everywhere", "ee.co.uk"],
  "vodafone": ["vodafone", "voda"],
  "o2": ["o2", "telefonica"],
  "three": ["three", "three.co.uk", "hutchison"],
  "now tv": ["now tv", "nowtv"],
  "youtube": ["youtube", "google youtube"],
  "audible": ["audible"],
  "gym": ["puregym", "the gym", "gym group", "virgin active", "nuffield"],
  "insurance": ["aviva", "direct line", "admiral", "axa", "more than"],
};

/**
 * Check if provider name matches transaction merchant/description
 */
function matchProvider(bill: Bill, txn: Transaction): string | null {
  const provider = (bill.provider || bill.name || "").toLowerCase();
  const merchant = (txn.merchant || "").toLowerCase();
  const description = (txn.description || "").toLowerCase();
  
  // Direct contains check
  if (provider && (merchant.includes(provider) || description.includes(provider))) {
    return provider;
  }
  
  // Check mappings
  for (const [key, aliases] of Object.entries(PROVIDER_MAPPINGS)) {
    if (provider.includes(key) || key.includes(provider)) {
      for (const alias of aliases) {
        if (merchant.includes(alias) || description.includes(alias)) {
          return key;
        }
      }
    }
  }
  
  // Check if any alias matches both provider and transaction
  for (const [key, aliases] of Object.entries(PROVIDER_MAPPINGS)) {
    const providerMatches = aliases.some(a => provider.includes(a));
    const txnMatches = aliases.some(a => merchant.includes(a) || description.includes(a));
    if (providerMatches && txnMatches) {
      return key;
    }
  }
  
  return null;
}

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
    
    // Skip pending transactions (only settled mark as paid)
    if (txn.is_pending) continue;
    
    const reasons: string[] = [];
    let score = 0;
    
    // Amount match (use absolute value for expenses which are negative)
    const txnAmount = Math.abs(txn.amount);
    const amountDiff = Math.abs(txnAmount - occurrence.expectedAmount);
    
    if (amountDiff === 0) {
      score += 40;
      reasons.push("Exact amount match");
    } else if (amountDiff <= AMOUNT_TOLERANCE) {
      score += 25;
      reasons.push(`Amount within ±£${AMOUNT_TOLERANCE.toFixed(2)}`);
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
      score += Math.max(10, 25 - (daysDiff * 5));
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
        score,
      });
    }
  }
  
  // Sort by score (highest first)
  return matches.sort((a, b) => b.score - a.score);
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
  
  // Only process unpaid occurrences
  const unpaidOccurrences = occurrences.filter(o => o.status !== "paid");
  
  for (const occurrence of unpaidOccurrences) {
    const matches = findMatchesForOccurrence(occurrence, transactions, linkedTransactionIds);
    
    if (matches.length > 0) {
      const bestMatch = matches[0];
      
      if (bestMatch.confidence === "high" && !matchedOccurrences.has(occurrence.id)) {
        autoApply.push(bestMatch);
        matchedOccurrences.add(occurrence.id);
        linkedTransactionIds.add(bestMatch.transactionId);
      } else if (bestMatch.confidence === "medium" && !matchedOccurrences.has(occurrence.id)) {
        forReview.push(bestMatch);
        matchedOccurrences.add(occurrence.id);
      }
    }
  }
  
  return { autoApply, forReview };
}

/**
 * Debug: Get matching diagnostics for a single occurrence
 */
export function getMatchingDiagnostics(
  occurrence: BillOccurrence,
  transactions: Transaction[]
): {
  potentialMatches: Array<{
    transaction: Transaction;
    amountDiff: number;
    daysDiff: number;
    providerMatch: string | null;
    accountMatch: boolean;
  }>;
} {
  const potentialMatches: Array<{
    transaction: Transaction;
    amountDiff: number;
    daysDiff: number;
    providerMatch: string | null;
    accountMatch: boolean;
  }> = [];
  
  for (const txn of transactions) {
    const txnAmount = Math.abs(txn.amount);
    const amountDiff = Math.abs(txnAmount - occurrence.expectedAmount);
    const txnDate = parseISO(txn.transaction_date);
    const daysDiff = Math.abs(differenceInDays(txnDate, occurrence.dueDate));
    const providerMatch = matchProvider(occurrence.bill, txn);
    const accountMatch = occurrence.bill.account_id === txn.account_id;
    
    // Only include transactions within reasonable range
    if (amountDiff <= 10 && daysDiff <= 7) {
      potentialMatches.push({
        transaction: txn,
        amountDiff,
        daysDiff,
        providerMatch,
        accountMatch,
      });
    }
  }
  
  return { potentialMatches };
}
