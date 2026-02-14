import ExcelJS from "exceljs";

// --- Sheet Detection ---

const SETTINGS_VARIANTS = [
  "settings", "setting", "config", "configuration",
];

export function findSettingsSheet(workbook: ExcelJS.Workbook): {
  sheetName: string | null;
  availableSheets: string[];
} {
  const availableSheets = workbook.worksheets.map((ws) => ws.name);
  const match = availableSheets.find((name) =>
    SETTINGS_VARIANTS.includes(name.trim().toLowerCase())
  );
  return { sheetName: match ?? null, availableSheets };
}

// --- Grid Conversion ---

export function sheetToGrid(sheet: ExcelJS.Worksheet): string[][] {
  const grid: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, _rowNumber) => {
    const cells: string[] = [];
    const colCount = sheet.columnCount;
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      const val = cell.value;
      cells.push(val != null ? String(val).trim() : "");
    }
    grid.push(cells);
  });
  return grid;
}

// --- Layout Detection ---

export type LayoutType = "CATEGORY_TABLE" | "SECTION_TABLES" | "UNKNOWN";

const SECTION_KEYWORDS = ["bills", "subscriptions", "debts", "bill", "subscription", "debt"];
const CATEGORY_KEYWORDS = ["category", "type", "section"];

export function detectLayout(grid: string[][]): LayoutType {
  // Check for a Category column in the first potential header row
  for (let r = 0; r < Math.min(5, grid.length); r++) {
    const row = grid[r];
    const hasCategory = row.some((cell) =>
      CATEGORY_KEYWORDS.includes(cell.toLowerCase())
    );
    const hasMultipleHeaders = row.filter((c) => c.length > 0).length >= 3;
    if (hasCategory && hasMultipleHeaders) return "CATEGORY_TABLE";
  }

  // Check for section headings
  for (const row of grid) {
    const nonEmpty = row.filter((c) => c.length > 0);
    if (
      nonEmpty.length <= 2 &&
      nonEmpty.some((c) => SECTION_KEYWORDS.includes(c.toLowerCase()))
    ) {
      return "SECTION_TABLES";
    }
  }

  return "UNKNOWN";
}

// --- Table Extraction ---

export interface ExtractedTable {
  sectionName: string;
  headers: string[];
  rows: Record<string, string>[];
}

function isBlankRow(row: string[]): boolean {
  return row.every((c) => c.length === 0);
}

function isSectionHeading(row: string[]): string | null {
  const nonEmpty = row.filter((c) => c.length > 0);
  if (nonEmpty.length > 2) return null;
  const val = nonEmpty[0]?.toLowerCase();
  if (val && SECTION_KEYWORDS.includes(val)) {
    return nonEmpty[0];
  }
  return null;
}

function looksLikeHeader(row: string[]): boolean {
  const nonEmpty = row.filter((c) => c.length > 0);
  return nonEmpty.length >= 2;
}

export function extractTables(grid: string[][]): ExtractedTable[] {
  const layout = detectLayout(grid);

  if (layout === "CATEGORY_TABLE") {
    return extractCategoryTable(grid);
  }
  return extractSectionTables(grid);
}

function extractCategoryTable(grid: string[][]): ExtractedTable[] {
  // Find the header row
  let headerIdx = -1;
  for (let r = 0; r < Math.min(10, grid.length); r++) {
    if (grid[r].some((c) => CATEGORY_KEYWORDS.includes(c.toLowerCase()))) {
      headerIdx = r;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const headers = grid[headerIdx].map(normaliseHeader);
  const catIdx = headers.findIndex((h) =>
    CATEGORY_KEYWORDS.includes(h)
  );

  const grouped: Record<string, Record<string, string>[]> = {};

  for (let r = headerIdx + 1; r < grid.length; r++) {
    if (isBlankRow(grid[r])) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h && grid[r][i]) row[h] = grid[r][i];
    });
    const category = grid[r][catIdx]?.trim() || "Other";
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(row);
  }

  return Object.entries(grouped).map(([sectionName, rows]) => ({
    sectionName,
    headers: headers.filter((h) => h && !CATEGORY_KEYWORDS.includes(h)),
    rows,
  }));
}

function extractSectionTables(grid: string[][]): ExtractedTable[] {
  const tables: ExtractedTable[] = [];
  let currentSection: string | null = null;
  let currentHeaders: string[] = [];
  let currentRows: Record<string, string>[] = [];

  const flushTable = () => {
    if (currentSection && currentHeaders.length > 0 && currentRows.length > 0) {
      tables.push({
        sectionName: currentSection,
        headers: currentHeaders,
        rows: currentRows,
      });
    }
    currentHeaders = [];
    currentRows = [];
  };

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];

    if (isBlankRow(row)) continue;

    const heading = isSectionHeading(row);
    if (heading) {
      flushTable();
      currentSection = heading;
      continue;
    }

    if (currentSection && currentHeaders.length === 0 && looksLikeHeader(row)) {
      currentHeaders = row.map(normaliseHeader);
      continue;
    }

    if (currentSection && currentHeaders.length > 0) {
      const record: Record<string, string> = {};
      currentHeaders.forEach((h, i) => {
        if (h && row[i]) record[h] = row[i];
      });
      if (Object.keys(record).length > 0) {
        currentRows.push(record);
      }
    }
  }

  flushTable();
  return tables;
}

// --- Section Assignment ---

export interface AssignedSections {
  bills: ExtractedTable | null;
  subscriptions: ExtractedTable | null;
  debts: ExtractedTable | null;
}

export function assignSections(tables: ExtractedTable[]): AssignedSections {
  const result: AssignedSections = { bills: null, subscriptions: null, debts: null };

  for (const t of tables) {
    const name = t.sectionName.toLowerCase().trim();
    if (name.includes("subscription")) {
      result.subscriptions = t;
    } else if (name.includes("bill")) {
      result.bills = t;
    } else if (name.includes("debt") || name.includes("loan") || name.includes("credit")) {
      result.debts = t;
    }
  }

  return result;
}

// --- Normalisation Helpers ---

export function normaliseHeader(h: string): string {
  return h.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normaliseAmount(value: any): number | null {
  if (value == null || value === "") return null;
  const str = String(value).replace(/[£$€,\s]/g, "").trim();
  const num = parseFloat(str);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

export function normaliseDate(value: any): string | null {
  if (value == null || value === "") return null;

  // Date object (ExcelJS returns Date objects for date cells)
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : formatISODate(value);
  }

  // Excel serial date (number)
  if (typeof value === "number") {
    const date = excelSerialToDate(value);
    return date ? formatISODate(date) : null;
  }

  const str = String(value).trim();

  // ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : formatISODate(d);
  }

  // UK format DD/MM/YYYY
  const ukMatch = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (ukMatch) {
    const day = parseInt(ukMatch[1]);
    const month = parseInt(ukMatch[2]) - 1;
    let year = parseInt(ukMatch[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : formatISODate(d);
  }

  return null;
}

function excelSerialToDate(serial: number): Date | null {
  if (serial < 1) return null;
  // Excel epoch is 1900-01-01, but has the 1900 leap year bug
  const epoch = new Date(1899, 11, 30);
  const ms = epoch.getTime() + serial * 86400000;
  return new Date(ms);
}

function formatISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function normaliseDueDay(value: any): number | null {
  if (value == null || value === "") return null;

  // If it's a date string, extract day
  const dateStr = normaliseDate(value);
  if (dateStr) {
    return parseInt(dateStr.split("-")[2]);
  }

  const num = parseInt(String(value));
  if (!isNaN(num) && num >= 1 && num <= 31) return num;
  return null;
}

const FREQUENCY_MAP: Record<string, string> = {
  weekly: "weekly",
  "every week": "weekly",
  fortnightly: "fortnightly",
  "bi-weekly": "fortnightly",
  "every 2 weeks": "fortnightly",
  monthly: "monthly",
  "every month": "monthly",
  quarterly: "quarterly",
  "every 3 months": "quarterly",
  "every quarter": "quarterly",
  biannual: "biannual",
  "bi-annual": "biannual",
  "every 6 months": "biannual",
  "half yearly": "biannual",
  "half-yearly": "biannual",
  yearly: "yearly",
  annual: "yearly",
  annually: "yearly",
  "every year": "yearly",
};

export function normaliseFrequency(value: any): string | null {
  if (value == null || value === "") return null;
  const key = String(value).trim().toLowerCase();
  return FREQUENCY_MAP[key] ?? null;
}

const DEBT_TYPE_MAP: Record<string, string> = {
  "credit card": "credit_card",
  "credit-card": "credit_card",
  creditcard: "credit_card",
  credit: "credit_card",
  loan: "loan",
  "personal loan": "loan",
  overdraft: "overdraft",
  bnpl: "bnpl",
  "buy now pay later": "bnpl",
  klarna: "bnpl",
  clearpay: "bnpl",
  other: "other",
};

export function normaliseDebtType(value: any): string | null {
  if (value == null || value === "") return null;
  const key = String(value).trim().toLowerCase();
  return DEBT_TYPE_MAP[key] ?? "other";
}

export function normaliseBoolean(value: any): boolean | null {
  if (value == null || value === "") return null;
  const s = String(value).trim().toLowerCase();
  if (["yes", "y", "true", "1", "active"].includes(s)) return true;
  if (["no", "n", "false", "0", "inactive", "cancelled"].includes(s)) return false;
  return null;
}

// --- Workbook Reading Helper ---

export async function readWorkbook(data: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  return workbook;
}

// --- Sheet to JSON Helper (replaces XLSX.utils.sheet_to_json) ---

export function sheetToJson<T = Record<string, any>>(sheet: ExcelJS.Worksheet): T[] {
  const rows: T[] = [];
  const headers: string[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // First row is headers
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = cell.value != null ? resolveCellValue(cell.value) : `Column${colNumber}`;
      });
      return;
    }

    const record: Record<string, any> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        // Preserve Date objects and booleans; resolve rich-text / formulas
        const raw = cell.value;
        if (raw instanceof Date || typeof raw === "boolean" || typeof raw === "number") {
          record[header] = raw;
        } else {
          record[header] = raw != null ? resolveCellValue(raw) : null;
        }
      }
    });

    // Only add non-empty rows
    if (Object.values(record).some((v) => v != null && String(v).trim() !== "")) {
      rows.push(record as T);
    }
  });

  return rows;
}

/** Extract a plain string from any ExcelJS cell value type */
function resolveCellValue(val: any): string {
  if (val == null) return "";
  // Rich text: { richText: [{ text: "..." }, ...] }
  if (typeof val === "object" && val.richText && Array.isArray(val.richText)) {
    return val.richText.map((seg: any) => seg.text ?? "").join("").trim();
  }
  // Formula: { result: ..., formula: "..." }
  if (typeof val === "object" && "result" in val) {
    return val.result != null ? String(val.result).trim() : "";
  }
  // Hyperlink: { text: "...", hyperlink: "..." }
  if (typeof val === "object" && "text" in val) {
    return String(val.text).trim();
  }
  return String(val).trim();
}
