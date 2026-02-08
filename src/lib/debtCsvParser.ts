import { DebtTransactionInsert } from "@/hooks/useDebtTransactions";
import { parse, isValid, parseISO } from "date-fns";

export interface CsvParseResult {
  success: boolean;
  transactions: DebtTransactionInsert[];
  errors: string[];
  warnings: string[];
}

export interface CsvColumnMapping {
  date: string;
  amount: string;
  description: string;
  reference?: string;
  account?: string;
}

/**
 * Parse CSV content into transactions
 */
export function parseTransactionCsv(
  csvContent: string,
  mapping: CsvColumnMapping
): CsvParseResult {
  const lines = csvContent.trim().split('\n');
  const transactions: DebtTransactionInsert[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (lines.length < 2) {
    return {
      success: false,
      transactions: [],
      errors: ['CSV must have at least a header row and one data row'],
      warnings: [],
    };
  }

  // Parse header
  const header = parseCSVLine(lines[0]);
  const columnIndices = {
    date: header.findIndex(h => h.toLowerCase().trim() === mapping.date.toLowerCase()),
    amount: header.findIndex(h => h.toLowerCase().trim() === mapping.amount.toLowerCase()),
    description: header.findIndex(h => h.toLowerCase().trim() === mapping.description.toLowerCase()),
    reference: mapping.reference 
      ? header.findIndex(h => h.toLowerCase().trim() === mapping.reference?.toLowerCase())
      : -1,
    account: mapping.account
      ? header.findIndex(h => h.toLowerCase().trim() === mapping.account?.toLowerCase())
      : -1,
  };

  if (columnIndices.date === -1) {
    errors.push(`Date column "${mapping.date}" not found in CSV`);
  }
  if (columnIndices.amount === -1) {
    errors.push(`Amount column "${mapping.amount}" not found in CSV`);
  }
  if (columnIndices.description === -1) {
    errors.push(`Description column "${mapping.description}" not found in CSV`);
  }

  if (errors.length > 0) {
    return { success: false, transactions: [], errors, warnings };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const rowNum = i + 1;

    try {
      // Parse date
      const dateStr = values[columnIndices.date]?.trim();
      const parsedDate = parseFlexibleDate(dateStr);
      if (!parsedDate) {
        warnings.push(`Row ${rowNum}: Invalid date "${dateStr}", skipping`);
        continue;
      }

      // Parse amount
      const amountStr = values[columnIndices.amount]?.trim();
      const amount = parseAmount(amountStr);
      if (amount === null || isNaN(amount)) {
        warnings.push(`Row ${rowNum}: Invalid amount "${amountStr}", skipping`);
        continue;
      }

      // Get description
      const description = values[columnIndices.description]?.trim();
      if (!description) {
        warnings.push(`Row ${rowNum}: Empty description, skipping`);
        continue;
      }

      // Optional fields
      const reference = columnIndices.reference >= 0 
        ? values[columnIndices.reference]?.trim() || null
        : null;
      const account_name = columnIndices.account >= 0
        ? values[columnIndices.account]?.trim() || null
        : null;

      transactions.push({
        transaction_date: parsedDate,
        amount: Math.abs(amount), // Store as positive
        description,
        reference,
        account_name,
      });
    } catch (e) {
      warnings.push(`Row ${rowNum}: Error parsing row - ${e}`);
    }
  }

  return {
    success: true,
    transactions,
    errors: [],
    warnings,
  };
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current);
  return values;
}

/**
 * Parse various date formats
 */
function parseFlexibleDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Try ISO format first
  const isoDate = parseISO(dateStr);
  if (isValid(isoDate)) {
    return dateStr.split('T')[0];
  }

  // Common formats
  const formats = [
    'dd/MM/yyyy',
    'dd-MM-yyyy',
    'MM/dd/yyyy',
    'yyyy/MM/dd',
    'dd MMM yyyy',
    'd MMM yyyy',
    'dd MMMM yyyy',
  ];

  for (const fmt of formats) {
    try {
      const parsed = parse(dateStr, fmt, new Date());
      if (isValid(parsed)) {
        return parsed.toISOString().split('T')[0];
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Parse amount string to number
 */
function parseAmount(amountStr: string): number | null {
  if (!amountStr) return null;

  // Remove currency symbols and whitespace
  let cleaned = amountStr
    .replace(/[£$€¥]/g, '')
    .replace(/\s/g, '')
    .trim();

  // Handle parentheses for negative
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }

  // Handle comma as thousand separator or decimal
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Both present - comma is thousand separator
    cleaned = cleaned.replace(/,/g, '');
  } else if (cleaned.includes(',')) {
    // Only comma - check if it's decimal (last comma with 2 digits after)
    const lastComma = cleaned.lastIndexOf(',');
    if (cleaned.length - lastComma === 3) {
      // Likely decimal separator (European format)
      cleaned = cleaned.slice(0, lastComma) + '.' + cleaned.slice(lastComma + 1);
    } else {
      // Likely thousand separator
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  const amount = parseFloat(cleaned);
  return isNaN(amount) ? null : amount;
}

/**
 * Detect likely column mappings from header
 */
export function detectColumnMappings(headers: string[]): CsvColumnMapping | null {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  
  // Common column name patterns
  const datePatterns = ['date', 'transaction date', 'trans date', 'posted'];
  const amountPatterns = ['amount', 'value', 'debit', 'credit', 'sum'];
  const descPatterns = ['description', 'desc', 'details', 'narrative', 'memo', 'reference'];
  const refPatterns = ['reference', 'ref', 'transaction id', 'id'];
  const accountPatterns = ['account', 'account name', 'source'];

  const findMatch = (patterns: string[]): string | undefined => {
    for (const pattern of patterns) {
      const index = lowerHeaders.findIndex(h => h.includes(pattern));
      if (index >= 0) return headers[index];
    }
    return undefined;
  };

  const date = findMatch(datePatterns);
  const amount = findMatch(amountPatterns);
  const description = findMatch(descPatterns);

  if (!date || !amount || !description) {
    return null;
  }

  return {
    date,
    amount,
    description,
    reference: findMatch(refPatterns),
    account: findMatch(accountPatterns),
  };
}

/**
 * Export transactions to CSV format
 */
export function exportTransactionsCsv(
  transactions: Array<{
    transaction_date: string;
    amount: number;
    description: string;
    reference?: string | null;
    account_name?: string | null;
  }>
): string {
  const headers = ['Date', 'Amount', 'Description', 'Reference', 'Account'];
  const rows = transactions.map(t => [
    t.transaction_date,
    t.amount.toFixed(2),
    `"${(t.description || '').replace(/"/g, '""')}"`,
    t.reference || '',
    t.account_name || '',
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Export payments to CSV format
 */
export function exportPaymentsCsv(
  payments: Array<{
    payment_date: string;
    amount: number;
    category: string;
    creditor_name?: string;
    notes?: string | null;
    principal_amount?: number | null;
    interest_amount?: number | null;
    fee_amount?: number | null;
    matched?: boolean;
  }>
): string {
  const headers = ['Date', 'Creditor', 'Amount', 'Category', 'Principal', 'Interest', 'Fees', 'Notes', 'Matched'];
  const rows = payments.map(p => [
    p.payment_date,
    `"${(p.creditor_name || '').replace(/"/g, '""')}"`,
    p.amount.toFixed(2),
    p.category,
    p.principal_amount?.toFixed(2) || '',
    p.interest_amount?.toFixed(2) || '',
    p.fee_amount?.toFixed(2) || '',
    `"${(p.notes || '').replace(/"/g, '""')}"`,
    p.matched ? 'Yes' : 'No',
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
