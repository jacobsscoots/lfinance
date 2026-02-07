/**
 * Receipt Matching Algorithm
 * Matches Gmail receipts to transactions based on multiple criteria
 */

export interface ReceiptData {
  id: string;
  merchant_name: string | null;
  amount: number | null;
  received_at: string;
  subject: string | null;
  from_email: string | null;
}

export interface TransactionData {
  id: string;
  description: string;
  merchant: string | null;
  amount: number;
  transaction_date: string;
  type: 'income' | 'expense';
}

export interface MatchResult {
  receiptId: string;
  transactionId: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Simple word overlap
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  const intersection = [...words1].filter(w => words2.has(w));
  const union = new Set([...words1, ...words2]);
  
  return intersection.length / union.size;
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.abs(Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Match a single receipt against a list of transactions
 */
export function matchReceiptToTransactions(
  receipt: ReceiptData,
  transactions: TransactionData[]
): MatchResult | null {
  let bestMatch: MatchResult | null = null;
  
  for (const transaction of transactions) {
    // Only match expenses (receipts are typically for purchases)
    if (transaction.type === 'income') continue;
    
    let score = 0;
    const reasons: string[] = [];
    
    // Amount matching (highest weight)
    if (receipt.amount !== null) {
      const amountDiff = Math.abs(receipt.amount - transaction.amount);
      
      if (amountDiff === 0) {
        score += 40;
        reasons.push('Exact amount match');
      } else if (amountDiff <= 0.50) {
        score += 25;
        reasons.push('Amount within £0.50');
      } else if (amountDiff <= 2.00) {
        score += 10;
        reasons.push('Amount within £2.00');
      }
    }
    
    // Date matching
    const receiptDate = receipt.received_at.split('T')[0];
    const txDate = transaction.transaction_date;
    const daysDiff = daysBetween(receiptDate, txDate);
    
    if (daysDiff === 0) {
      score += 30;
      reasons.push('Same day');
    } else if (daysDiff === 1) {
      score += 25;
      reasons.push('Within 1 day');
    } else if (daysDiff <= 3) {
      score += 15;
      reasons.push(`Within ${daysDiff} days`);
    } else if (daysDiff <= 7) {
      score += 5;
      reasons.push('Within a week');
    }
    
    // Merchant name matching
    const merchantName = receipt.merchant_name || '';
    const txMerchant = transaction.merchant || transaction.description;
    
    if (merchantName && txMerchant) {
      const similarity = calculateSimilarity(merchantName, txMerchant);
      
      if (similarity >= 0.8) {
        score += 30;
        reasons.push('Strong merchant match');
      } else if (similarity >= 0.5) {
        score += 15;
        reasons.push('Partial merchant match');
      } else if (similarity >= 0.3) {
        score += 5;
        reasons.push('Weak merchant match');
      }
    }
    
    // Check email sender domain against merchant
    if (receipt.from_email && txMerchant) {
      const emailDomain = receipt.from_email.split('@')[1]?.split('.')[0] || '';
      if (txMerchant.toLowerCase().includes(emailDomain.toLowerCase())) {
        score += 10;
        reasons.push('Email domain matches merchant');
      }
    }
    
    // Determine confidence
    let confidence: 'high' | 'medium' | 'low';
    if (score >= 80) {
      confidence = 'high';
    } else if (score >= 50) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }
    
    // Update best match if this is better
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        receiptId: receipt.id,
        transactionId: transaction.id,
        score,
        confidence,
        reasons,
      };
    }
  }
  
  // Only return matches with at least some confidence
  if (bestMatch && bestMatch.score >= 30) {
    return bestMatch;
  }
  
  return null;
}

/**
 * Check for potential duplicate matches
 */
export function checkForDuplicateMatches(
  receipt: ReceiptData,
  transactions: TransactionData[]
): TransactionData[] {
  // Find all transactions with the exact same amount on the same day
  if (receipt.amount === null) return [];
  
  const receiptDate = receipt.received_at.split('T')[0];
  
  return transactions.filter(tx => {
    if (tx.type === 'income') return false;
    
    const amountMatch = Math.abs(tx.amount - receipt.amount!) < 0.01;
    const daysDiff = daysBetween(receiptDate, tx.transaction_date);
    
    return amountMatch && daysDiff <= 1;
  });
}

/**
 * Extract merchant name from email data
 */
export function extractMerchantFromEmail(fromEmail: string, subject: string): string | null {
  // Common receipt sender patterns
  const merchantPatterns: Record<string, string> = {
    'amazon': 'Amazon',
    'tesco': 'Tesco',
    'sainsburys': 'Sainsbury\'s',
    'asda': 'ASDA',
    'waitrose': 'Waitrose',
    'ocado': 'Ocado',
    'morrisons': 'Morrisons',
    'paypal': 'PayPal',
    'ebay': 'eBay',
    'deliveroo': 'Deliveroo',
    'ubereats': 'Uber Eats',
    'justeat': 'Just Eat',
    'netflix': 'Netflix',
    'spotify': 'Spotify',
    'apple': 'Apple',
    'google': 'Google',
    'steam': 'Steam',
  };
  
  const emailLower = fromEmail.toLowerCase();
  
  for (const [pattern, merchant] of Object.entries(merchantPatterns)) {
    if (emailLower.includes(pattern)) {
      return merchant;
    }
  }
  
  // Try to extract from email domain
  const domain = fromEmail.split('@')[1]?.split('.')[0];
  if (domain && domain.length > 2) {
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  }
  
  return null;
}

/**
 * Extract amount from email subject or body
 */
export function extractAmountFromText(text: string): number | null {
  // Match common price patterns
  const patterns = [
    /£\s*([\d,]+\.?\d*)/,
    /GBP\s*([\d,]+\.?\d*)/i,
    /\$\s*([\d,]+\.?\d*)/,
    /([\d,]+\.?\d*)\s*GBP/i,
    /total[:\s]*([\d,]+\.?\d*)/i,
    /amount[:\s]*£?\s*([\d,]+\.?\d*)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(',', ''));
      if (!isNaN(amount) && amount > 0) {
        return amount;
      }
    }
  }
  
  return null;
}
