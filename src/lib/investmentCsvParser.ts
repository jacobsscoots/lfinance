/**
 * CSV Parser for Investment Contributions
 * Supports both simple format (date,amount,type) and Chip statement format
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
  warnings: string[];
  format: 'simple' | 'chip_statement' | 'unknown';
}

const VALID_TYPES = ['deposit', 'withdrawal', 'fee', 'dividend'] as const;

/**
 * Quote-aware CSV line parser
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'; // Handle escaped quotes ""
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim()); // Add the last value
  return values;
}

/**
 * Parse UK date formats like "23rd December 2025" or "1st October 2025"
 */
function parseUKDate(dateStr: string): string | null {
  // Match patterns like "23rd December 2025", "1st October 2025"
  const ukDatePattern = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})$/i;
  const match = dateStr.trim().match(ukDatePattern);
  
  if (match) {
    const [, day, monthStr, year] = match;
    const months: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04',
      may: '05', june: '06', july: '07', august: '08',
      september: '09', october: '10', november: '11', december: '12'
    };
    const month = months[monthStr.toLowerCase()];
    if (month) {
      const paddedDay = day.padStart(2, '0');
      return `${year}-${month}-${paddedDay}`;
    }
  }
  return null;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  const cleanDate = dateStr.trim();
  
  // Try UK format first (e.g., "23rd December 2025")
  const ukDate = parseUKDate(cleanDate);
  if (ukDate) return ukDate;
  
  // Try standard formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
  ];
  
  for (const format of formats) {
    const match = cleanDate.match(format);
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

/**
 * Locale-aware number parsing (handles £1,234.56 or 1.234,56)
 */
function parseNumericValue(value: string | number | null): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;

  let cleaned = value.toString().replace(/\s/g, "").replace(/[£$€]/g, "");
  
  // Remove percentage and parenthetical suffixes like "(0.03%)" or "(-1.59%)"
  cleaned = cleaned.replace(/\(.*?\)/g, '').trim();

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");

  if (lastDot === -1 && lastComma === -1) {
    return parseFloat(cleaned) || null;
  }

  if (lastDot > lastComma) {
    // UK/US format: 1,234.56
    cleaned = cleaned.replace(/,/g, "");
  } else if (lastComma > lastDot) {
    // European format: 1.234,56
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseType(typeStr: string): 'deposit' | 'withdrawal' | 'fee' | 'dividend' | null {
  const normalized = typeStr.toLowerCase().trim();
  
  const typeMap: Record<string, typeof VALID_TYPES[number]> = {
    deposit: 'deposit',
    withdrawal: 'withdrawal',
    fee: 'fee',
    dividend: 'dividend',
    contribution: 'deposit',
    payment: 'deposit',
    income: 'dividend',
    invest: 'deposit',
    withdraw: 'withdrawal',
    payout: 'withdrawal',
    charge: 'fee',
    cost: 'fee',
    interest: 'dividend',
  };
  
  return typeMap[normalized] || null;
}

/**
 * Detect if this is a Chip statement by looking for key markers
 */
function detectChipStatement(lines: string[]): boolean {
  const text = lines.slice(0, 30).join('\n').toLowerCase();
  return text.includes('chip financial') || 
         text.includes('valuation statement') ||
         text.includes('period of statement') ||
         text.includes('accounts overview');
}

/**
 * Extract period end date from Chip statement
 */
function extractStatementPeriod(lines: string[]): string | null {
  for (const line of lines.slice(0, 30)) {
    // Look for patterns like "1st October 2025 (opening values) to 31st December 2025 (closing values)"
    const periodMatch = line.match(/to\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/i);
    if (periodMatch) {
      return parseUKDate(periodMatch[1]);
    }
  }
  return null;
}

/**
 * Parse Chip investment statement format
 */
function parseChipStatement(lines: string[]): ParseResult {
  const contributions: ParsedContribution[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const periodEndDate = extractStatementPeriod(lines);
  
  // Look for Accounts overview section to get Net payments (deposits)
  let inAccountsOverview = false;
  let accountsHeaderIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = parseCSVLine(line);
    
    // Detect accounts overview header
    if (parts.some(p => p.includes('Account ID')) && 
        parts.some(p => p.includes('Net payments'))) {
      inAccountsOverview = true;
      accountsHeaderIndex = i;
      continue;
    }
    
    // Parse account rows (look for account IDs like A05V714)
    if (inAccountsOverview && /^[A-Z]\d{2}[A-Z]\d{3}/.test(parts[0])) {
      // Find Net payments column (index 3 based on header)
      const netPayments = parseNumericValue(parts[3]);
      if (netPayments && netPayments > 0) {
        const date = periodEndDate || new Date().toISOString().split('T')[0];
        contributions.push({
          date,
          amount: Math.abs(netPayments),
          type: 'deposit'
        });
        warnings.push(`Extracted net payment of £${netPayments.toFixed(2)} from account ${parts[0]}`);
      }
      
      // Check for charges (negative values in Charges column, index 6)
      const charges = parseNumericValue(parts[6]);
      if (charges && charges < 0) {
        const date = periodEndDate || new Date().toISOString().split('T')[0];
        contributions.push({
          date,
          amount: Math.abs(charges),
          type: 'fee'
        });
      }
      
      inAccountsOverview = false;
    }
    
    // Look for Income statement section
    if (parts[0] === 'Date' && parts[1] === 'Description' && parts[2] === 'Type') {
      // Parse following rows as income
      for (let j = i + 1; j < lines.length && j < i + 20; j++) {
        const incomeParts = parseCSVLine(lines[j]);
        if (!incomeParts[0] || incomeParts[0].includes('Total') || incomeParts[0].includes('Chip Financial')) {
          break;
        }
        
        const incomeDate = parseDate(incomeParts[0]);
        const incomeAmount = parseNumericValue(incomeParts[3]);
        const incomeType = parseType(incomeParts[2] || 'income');
        
        if (incomeDate && incomeAmount) {
          contributions.push({
            date: incomeDate,
            amount: incomeAmount,
            type: incomeType || 'dividend'
          });
        }
      }
    }
  }
  
  if (contributions.length === 0) {
    errors.push('Could not find transaction data in Chip statement. The statement may only contain summary information.');
    warnings.push('Tip: This appears to be a Chip valuation statement. For best results, use the simple CSV format: date,amount,type');
  }
  
  return {
    success: contributions.length > 0,
    contributions,
    errors,
    warnings,
    format: 'chip_statement'
  };
}

/**
 * Parse simple CSV format: date,amount,type
 */
function parseSimpleCsv(lines: string[]): ParseResult {
  const contributions: ParsedContribution[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check for header row
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('date') || firstLine.includes('amount') || firstLine.includes('type');
  const dataLines = hasHeader ? lines.slice(1) : lines;
  
  for (let i = 0; i < dataLines.length; i++) {
    const lineNum = hasHeader ? i + 2 : i + 1;
    const line = dataLines[i].trim();
    
    if (!line) continue;
    
    const parts = parseCSVLine(line);
    
    if (parts.length < 2) {
      errors.push(`Line ${lineNum}: Not enough columns (need at least date and amount)`);
      continue;
    }
    
    const date = parseDate(parts[0]);
    if (!date) {
      errors.push(`Line ${lineNum}: Invalid date format "${parts[0]}"`);
      continue;
    }
    
    const amount = parseNumericValue(parts[1]);
    if (amount === null) {
      errors.push(`Line ${lineNum}: Invalid amount "${parts[1]}"`);
      continue;
    }
    
    // Type is optional, default to 'deposit'
    let type: 'deposit' | 'withdrawal' | 'fee' | 'dividend' = 'deposit';
    if (parts[2]) {
      const parsedType = parseType(parts[2]);
      if (parsedType === null) {
        warnings.push(`Line ${lineNum}: Unknown type "${parts[2]}", defaulting to deposit`);
      } else {
        type = parsedType;
      }
    }
    
    contributions.push({ date, amount: Math.abs(amount), type });
  }
  
  return {
    success: errors.length === 0 && contributions.length > 0,
    contributions,
    errors,
    warnings,
    format: 'simple'
  };
}

export function parseContributionsCsv(csvContent: string): ParseResult {
  const lines = csvContent.trim().split('\n');
  
  if (lines.length === 0) {
    return { 
      success: false, 
      contributions: [], 
      errors: ['Empty CSV file'],
      warnings: [],
      format: 'unknown'
    };
  }
  
  // Detect format
  if (detectChipStatement(lines)) {
    return parseChipStatement(lines);
  }
  
  // Try simple format
  return parseSimpleCsv(lines);
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
