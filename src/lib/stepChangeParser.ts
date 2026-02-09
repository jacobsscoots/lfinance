/**
 * StepChange DMP Statement PDF Parser
 *
 * Parses StepChange "My Statements" PDFs into structured data.
 * The statement format is:
 *   - Header block with next payment amount, estimated total balance,
 *     estimated debt free date, statement date
 *   - Table of creditors with: creditor name, account number,
 *     payment this month, payments to date, estimated balance
 *   - Each creditor row followed by "Original Creditor: <name>"
 *   - Totals row at bottom
 */

import * as pdfjsLib from "pdfjs-dist";

// Configure the worker — use CDN for the matching version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface StepChangeCreditor {
  creditorName: string;
  accountNumber: string;
  originalCreditor: string;
  paymentThisMonth: number;
  paymentsToDate: number;
  estimatedBalance: number;
}

export interface StepChangeStatement {
  statementDate: string; // YYYY-MM-DD
  nextPaymentAmount: number;
  estimatedTotalBalance: number;
  estimatedDebtFreeDate: string; // "May 2044" etc.
  creditors: StepChangeCreditor[];
  totalPaymentThisMonth: number;
  totalPaymentsToDate: number;
  totalEstimatedBalance: number;
}

export interface StepChangeParseResult {
  success: boolean;
  statement: StepChangeStatement | null;
  errors: string[];
  warnings: string[];
}

/**
 * Parse a UK currency string like "£1,821.76" or "£0.00" to a number.
 */
function parseCurrency(str: string): number {
  const cleaned = str.replace(/[£,\s]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/**
 * Parse a date string like "27/01/2026" to "2026-01-27".
 */
function parseDateDDMMYYYY(str: string): string {
  const match = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return "";
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Extract text from a PDF file (ArrayBuffer) using pdf.js.
 */
async function extractPdfText(pdfBuffer: ArrayBuffer): Promise<string[]> {
  const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group text items by Y position to reconstruct lines
    const itemsByY = new Map<number, Array<{ x: number; str: string }>>();
    for (const item of textContent.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      // Round Y to nearest 2 to group items on same visual line
      const y = Math.round(item.transform[5] / 2) * 2;
      if (!itemsByY.has(y)) itemsByY.set(y, []);
      itemsByY.get(y)!.push({ x: item.transform[4], str: item.str.trim() });
    }

    // Sort by Y descending (PDF coordinates start from bottom)
    const sortedYs = [...itemsByY.keys()].sort((a, b) => b - a);
    for (const y of sortedYs) {
      const items = itemsByY.get(y)!;
      items.sort((a, b) => a.x - b.x);
      const line = items.map((i) => i.str).join("  ");
      allLines.push(line);
    }
  }

  return allLines;
}

/**
 * Parse a StepChange DMP statement PDF.
 */
export async function parseStepChangeStatement(
  pdfBuffer: ArrayBuffer
): Promise<StepChangeParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let lines: string[];
  try {
    lines = await extractPdfText(pdfBuffer);
  } catch (e) {
    return {
      success: false,
      statement: null,
      errors: [`Failed to read PDF: ${e instanceof Error ? e.message : String(e)}`],
      warnings: [],
    };
  }

  if (lines.length === 0) {
    return {
      success: false,
      statement: null,
      errors: ["PDF appears to be empty or could not be read"],
      warnings: [],
    };
  }

  // Join all text for regex-based header extraction
  const fullText = lines.join("\n");

  // ─── Extract header metadata ───
  let nextPaymentAmount = 0;
  let estimatedTotalBalance = 0;
  let estimatedDebtFreeDate = "";
  let statementDate = "";

  const nextPaymentMatch = fullText.match(
    /Next\s+payment\s+amount[:\s]*£([\d,.]+)/i
  );
  if (nextPaymentMatch) {
    nextPaymentAmount = parseCurrency("£" + nextPaymentMatch[1]);
  } else {
    warnings.push("Could not find next payment amount in header");
  }

  const totalBalanceMatch = fullText.match(
    /Estimated\s+total\s+balance[:\s]*£([\d,.]+)/i
  );
  if (totalBalanceMatch) {
    estimatedTotalBalance = parseCurrency("£" + totalBalanceMatch[1]);
  }

  const debtFreeDateMatch = fullText.match(
    /Estimated\s+debt\s+free\s+date[:\s]*([A-Za-z]+\s+\d{4})/i
  );
  if (debtFreeDateMatch) {
    estimatedDebtFreeDate = debtFreeDateMatch[1];
  }

  const statementDateMatch = fullText.match(
    /Statement\s+date[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  if (statementDateMatch) {
    statementDate = parseDateDDMMYYYY(statementDateMatch[1]);
  } else {
    warnings.push("Could not find statement date — using today");
    const now = new Date();
    statementDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  // ─── Extract creditor rows ───
  // The table has: Creditor name | Account number | Payment this month | Payments to date | Estimated balance
  // Followed by: "Original Creditor: <name>"
  //
  // Strategy: look for lines containing £ amounts that match the creditor row pattern.
  // A creditor line typically looks like:
  //   "PRA GROUP (UK) LTD CAP ONE, ...  BBK193342  £33.02  £1,821.76  £6,476.76"
  // or the name and numbers may be on separate lines depending on PDF extraction.

  const creditors: StepChangeCreditor[] = [];

  // Build a single-pass parser: find lines with currency amounts
  // Pattern: we look for sequences of 3 £-amounts on a line (payment, to-date, balance)
  const currencyPattern = /£[\d,.]+/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const amounts = line.match(currencyPattern);

    // A creditor data line has exactly 3 £ values
    if (amounts && amounts.length === 3) {
      // Skip the totals line
      const lineUpper = line.toUpperCase();
      if (lineUpper.includes("TOTAL")) continue;
      // Skip header metadata lines
      if (
        lineUpper.includes("NEXT PAYMENT") ||
        lineUpper.includes("ESTIMATED TOTAL") ||
        lineUpper.includes("ESTIMATED DEBT FREE") ||
        lineUpper.includes("STATEMENT DATE")
      ) {
        continue;
      }

      const paymentThisMonth = parseCurrency(amounts[0]);
      const paymentsToDate = parseCurrency(amounts[1]);
      const estimatedBalance = parseCurrency(amounts[2]);

      // Extract creditor name and account number from the part before the £ amounts
      const firstAmountIdx = line.indexOf(amounts[0]);
      const prefix = line.substring(0, firstAmountIdx).trim();

      // The prefix usually contains: "CREDITOR NAME  ACCOUNT_NUMBER"
      // Account numbers are typically alphanumeric sequences at the end
      let creditorName = prefix;
      let accountNumber = "";

      // Try to split off an account number (last token if it looks like one)
      const tokens = prefix.split(/\s{2,}/);
      if (tokens.length >= 2) {
        const lastToken = tokens[tokens.length - 1].trim();
        // Account numbers are typically alphanumeric, 6+ chars
        if (/^[A-Za-z0-9]{5,}$/.test(lastToken)) {
          accountNumber = lastToken;
          creditorName = tokens.slice(0, -1).join(" ").trim();
        }
      }

      // Look for "Original Creditor:" on subsequent lines
      let originalCreditor = "";
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const origMatch = lines[j].match(
          /Original\s+Creditor[:\s]+(.+)/i
        );
        if (origMatch) {
          originalCreditor = origMatch[1].trim();
          break;
        }
      }

      creditors.push({
        creditorName: creditorName || originalCreditor || "Unknown Creditor",
        accountNumber,
        originalCreditor,
        paymentThisMonth,
        paymentsToDate,
        estimatedBalance,
      });
    }
  }

  if (creditors.length === 0) {
    errors.push(
      "Could not find any creditor rows in the statement. The PDF format may not be recognized."
    );
    return { success: false, statement: null, errors, warnings };
  }

  // Calculate totals from parsed data
  const totalPaymentThisMonth = creditors.reduce(
    (sum, c) => sum + c.paymentThisMonth,
    0
  );
  const totalPaymentsToDate = creditors.reduce(
    (sum, c) => sum + c.paymentsToDate,
    0
  );
  const totalEstimatedBalance = creditors.reduce(
    (sum, c) => sum + c.estimatedBalance,
    0
  );

  // Validate totals against header if available
  if (
    estimatedTotalBalance > 0 &&
    Math.abs(totalEstimatedBalance - estimatedTotalBalance) > 1
  ) {
    warnings.push(
      `Parsed total balance (£${totalEstimatedBalance.toFixed(2)}) differs from header (£${estimatedTotalBalance.toFixed(2)})`
    );
  }

  return {
    success: true,
    statement: {
      statementDate,
      nextPaymentAmount,
      estimatedTotalBalance,
      estimatedDebtFreeDate,
      creditors,
      totalPaymentThisMonth,
      totalPaymentsToDate,
      totalEstimatedBalance,
    },
    errors,
    warnings,
  };
}
