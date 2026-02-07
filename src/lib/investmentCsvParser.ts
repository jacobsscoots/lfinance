/**
 * CSV Parser for Investment Contributions
 * Expected format: date,amount,type
 */

export interface ParsedContribution {
  date: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'fee' | 'dividend';
}

export interface ParseResult {
  success: boolean;
  contributions: ParsedContribution[];
  errors: string[];
}

const VALID_TYPES = ['deposit', 'withdrawal', 'fee', 'dividend'] as const;

function parseDate(dateStr: string): string | null {
  // Try various date formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let year: string, month: string, day: string;
      
      if (format === formats[0]) {
        [, year, month, day] = match;
      } else {
        [, day, month, year] = match;
      }
      
      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime())) {
        return `${year}-${month}-${day}`;
      }
    }
  }
  
  return null;
}

function parseAmount(amountStr: string): number | null {
  // Remove currency symbols and whitespace
  const cleaned = amountStr.replace(/[£$€,\s]/g, '').trim();
  const amount = parseFloat(cleaned);
  
  if (isNaN(amount)) {
    return null;
  }
  
  return Math.abs(amount);
}

function parseType(typeStr: string): 'deposit' | 'withdrawal' | 'fee' | 'dividend' | null {
  const normalized = typeStr.toLowerCase().trim();
  
  // Handle common aliases
  const typeMap: Record<string, typeof VALID_TYPES[number]> = {
    deposit: 'deposit',
    withdrawal: 'withdrawal',
    fee: 'fee',
    dividend: 'dividend',
    contribution: 'deposit',
    payment: 'deposit',
    income: 'deposit',
    invest: 'deposit',
    withdraw: 'withdrawal',
    payout: 'withdrawal',
    charge: 'fee',
    cost: 'fee',
    interest: 'dividend',
  };
  
  return typeMap[normalized] || null;
}

export function parseContributionsCsv(csvContent: string): ParseResult {
  const lines = csvContent.trim().split('\n');
  const contributions: ParsedContribution[] = [];
  const errors: string[] = [];
  
  if (lines.length === 0) {
    return { success: false, contributions: [], errors: ['Empty CSV file'] };
  }
  
  // Check for header row
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('date') || firstLine.includes('amount') || firstLine.includes('type');
  const dataLines = hasHeader ? lines.slice(1) : lines;
  
  for (let i = 0; i < dataLines.length; i++) {
    const lineNum = hasHeader ? i + 2 : i + 1;
    const line = dataLines[i].trim();
    
    if (!line) continue;
    
    const parts = line.split(',').map(p => p.trim());
    
    if (parts.length < 2) {
      errors.push(`Line ${lineNum}: Not enough columns (need at least date and amount)`);
      continue;
    }
    
    const date = parseDate(parts[0]);
    if (!date) {
      errors.push(`Line ${lineNum}: Invalid date format "${parts[0]}"`);
      continue;
    }
    
    const amount = parseAmount(parts[1]);
    if (amount === null) {
      errors.push(`Line ${lineNum}: Invalid amount "${parts[1]}"`);
      continue;
    }
    
    // Type is optional, default to 'deposit'
    let type: 'deposit' | 'withdrawal' | 'fee' | 'dividend' = 'deposit';
    if (parts[2]) {
      const parsedType = parseType(parts[2]);
      if (parsedType === null) {
        errors.push(`Line ${lineNum}: Invalid type "${parts[2]}", defaulting to deposit`);
      } else {
        type = parsedType;
      }
    }
    
    contributions.push({ date, amount, type });
  }
  
  return {
    success: errors.length === 0 && contributions.length > 0,
    contributions,
    errors,
  };
}

/**
 * Generate a sample CSV template
 */
export function generateCsvTemplate(): string {
  return `date,amount,type
2025-01-15,500.00,deposit
2025-02-15,500.00,deposit
2025-03-15,500.00,deposit
2025-04-01,50.00,withdrawal`;
}
