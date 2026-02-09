import {
  normaliseAmount,
  normaliseDate,
  normaliseDueDay,
  normaliseFrequency,
  normaliseDebtType,
  normaliseBoolean,
} from "./excelImportParser";

// --- Target Field Definitions ---

export interface TargetField {
  key: string;
  label: string;
  required: boolean;
  recommended?: boolean;
}

export const BILL_FIELDS: TargetField[] = [
  { key: "name", label: "Name", required: true },
  { key: "amount", label: "Amount", required: false, recommended: true },
  { key: "frequency", label: "Frequency", required: true },
  { key: "due_day", label: "Due Day", required: false, recommended: true },
  { key: "provider", label: "Provider", required: false },
  { key: "bill_type", label: "Bill Type", required: false },
  { key: "notes", label: "Notes", required: false },
  { key: "is_active", label: "Active", required: false },
];

export const DEBT_FIELDS: TargetField[] = [
  { key: "creditor_name", label: "Creditor Name", required: true },
  { key: "debt_type", label: "Debt Type", required: true },
  { key: "starting_balance", label: "Starting Balance", required: false, recommended: true },
  { key: "current_balance", label: "Current Balance", required: false, recommended: true },
  { key: "apr", label: "APR (%)", required: false },
  { key: "interest_type", label: "Interest Type", required: false },
  { key: "min_payment", label: "Min Payment", required: false },
  { key: "due_day", label: "Due Day", required: false },
  { key: "notes", label: "Notes", required: false },
];

// --- Synonym Map for Auto-Detection ---

const HEADER_SYNONYMS: Record<string, string[]> = {
  name: ["name", "bill name", "bill", "payee", "description", "title", "service"],
  amount: ["amount", "cost", "price", "monthly cost", "monthly amount", "payment", "value", "charge"],
  frequency: ["frequency", "billing cycle", "cycle", "period", "recurrence", "how often", "schedule"],
  due_day: ["due day", "due date", "payment day", "payment date", "day", "date due", "dd"],
  provider: ["provider", "company", "supplier", "vendor", "from"],
  bill_type: ["bill type", "type", "category"],
  notes: ["notes", "note", "comments", "memo", "details"],
  is_active: ["active", "status", "enabled", "is active"],
  creditor_name: ["creditor", "creditor name", "lender", "bank", "company", "provider", "name"],
  debt_type: ["debt type", "type", "account type", "kind"],
  starting_balance: ["starting balance", "original balance", "initial balance", "original amount", "borrowed"],
  current_balance: ["current balance", "balance", "outstanding", "remaining", "owed"],
  apr: ["apr", "interest rate", "rate", "interest %", "annual rate"],
  interest_type: ["interest type", "rate type"],
  min_payment: ["min payment", "minimum payment", "min", "minimum"],
};

export type FieldMapping = Record<string, string>; // header -> target field key or "IGNORE"

export function autoDetectMapping(
  headers: string[],
  targetFields: TargetField[]
): FieldMapping {
  const mapping: FieldMapping = {};
  const usedTargets = new Set<string>();
  const validKeys = new Set(targetFields.map((f) => f.key));

  for (const header of headers) {
    if (!header) {
      mapping[header] = "IGNORE";
      continue;
    }

    const normalised = header.toLowerCase().trim();
    let bestMatch: string | null = null;

    for (const [key, synonyms] of Object.entries(HEADER_SYNONYMS)) {
      if (!validKeys.has(key) || usedTargets.has(key)) continue;
      if (synonyms.includes(normalised)) {
        bestMatch = key;
        break;
      }
    }

    // Partial match fallback
    if (!bestMatch) {
      for (const [key, synonyms] of Object.entries(HEADER_SYNONYMS)) {
        if (!validKeys.has(key) || usedTargets.has(key)) continue;
        if (synonyms.some((s) => normalised.includes(s) || s.includes(normalised))) {
          bestMatch = key;
          break;
        }
      }
    }

    if (bestMatch) {
      mapping[header] = bestMatch;
      usedTargets.add(bestMatch);
    } else {
      mapping[header] = "IGNORE";
    }
  }

  return mapping;
}

// --- Row Validation ---

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  data: Record<string, any>;
}

export function validateRow(
  row: Record<string, string>,
  mapping: FieldMapping,
  targetFields: TargetField[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const data: Record<string, any> = {};

  // Map raw values to target fields
  for (const [header, targetKey] of Object.entries(mapping)) {
    if (targetKey === "IGNORE" || !row[header]) continue;
    data[targetKey] = row[header];
  }

  // Check required fields
  for (const field of targetFields) {
    if (field.required && (data[field.key] == null || data[field.key] === "")) {
      errors.push(`Missing required field: ${field.label}`);
    }
    if (field.recommended && (data[field.key] == null || data[field.key] === "")) {
      warnings.push(`Recommended field missing: ${field.label}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings, data };
}

// --- Normalise a mapped row into DB-ready shape ---

export function normaliseBillRow(data: Record<string, any>): Record<string, any> {
  return {
    name: String(data.name || "").trim(),
    amount: normaliseAmount(data.amount) ?? 0,
    frequency: normaliseFrequency(data.frequency) ?? "monthly",
    due_day: normaliseDueDay(data.due_day) ?? 1,
    provider: data.provider ? String(data.provider).trim() : null,
    bill_type: data.bill_type ? String(data.bill_type).trim() : null,
    notes: data.notes ? String(data.notes).trim() : null,
    is_active: normaliseBoolean(data.is_active) ?? true,
    due_date_rule: "exact",
  };
}

export function normaliseDebtRow(data: Record<string, any>): Record<string, any> {
  const startBal = normaliseAmount(data.starting_balance);
  const curBal = normaliseAmount(data.current_balance);
  return {
    creditor_name: String(data.creditor_name || "").trim(),
    debt_type: normaliseDebtType(data.debt_type) ?? "other",
    starting_balance: startBal ?? curBal ?? 0,
    current_balance: curBal ?? startBal ?? 0,
    apr: normaliseAmount(data.apr) ?? null,
    interest_type: data.interest_type ? String(data.interest_type).trim().toLowerCase() : "none",
    min_payment: normaliseAmount(data.min_payment) ?? null,
    due_day: normaliseDueDay(data.due_day) ?? null,
    notes: data.notes ? String(data.notes).trim() : null,
    status: "open",
  };
}

// --- Import Key Generation ---

export function buildBillImportKey(data: Record<string, any>): string {
  const parts = [
    (data.name || "").toLowerCase().trim(),
    (data.provider || "").toLowerCase().trim(),
    (data.frequency || "").toLowerCase().trim(),
    String(data.due_day || ""),
  ];
  return parts.join("|");
}

export function buildDebtImportKey(data: Record<string, any>): string {
  const parts = [
    (data.creditor_name || "").toLowerCase().trim(),
    (data.debt_type || "").toLowerCase().trim(),
  ];
  return parts.join("|");
}

// --- Duplicate Detection ---

export interface DuplicateMatch {
  rowIndex: number;
  existingId: string;
  existingName: string;
  matchType: "import_key" | "fuzzy";
}

export function findBillDuplicates(
  newRows: Array<{ importKey: string; data: Record<string, any> }>,
  existingBills: Array<{ id: string; name: string; import_key?: string | null; amount: number; due_day: number; provider?: string | null; frequency: string }>
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  newRows.forEach((row, idx) => {
    // First try import_key match
    const keyMatch = existingBills.find(
      (b) => b.import_key && b.import_key === row.importKey
    );
    if (keyMatch) {
      matches.push({ rowIndex: idx, existingId: keyMatch.id, existingName: keyMatch.name, matchType: "import_key" });
      return;
    }

    // Fuzzy fallback: name + due_day + frequency
    const fuzzyMatch = existingBills.find(
      (b) =>
        b.name.toLowerCase().trim() === (row.data.name || "").toLowerCase().trim() &&
        b.due_day === row.data.due_day &&
        b.frequency === row.data.frequency
    );
    if (fuzzyMatch) {
      matches.push({ rowIndex: idx, existingId: fuzzyMatch.id, existingName: fuzzyMatch.name, matchType: "fuzzy" });
    }
  });

  return matches;
}

export function findDebtDuplicates(
  newRows: Array<{ importKey: string; data: Record<string, any> }>,
  existingDebts: Array<{ id: string; creditor_name: string; import_key?: string | null; debt_type: string }>
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  newRows.forEach((row, idx) => {
    const keyMatch = existingDebts.find(
      (d) => d.import_key && d.import_key === row.importKey
    );
    if (keyMatch) {
      matches.push({ rowIndex: idx, existingId: keyMatch.id, existingName: keyMatch.creditor_name, matchType: "import_key" });
      return;
    }

    const fuzzyMatch = existingDebts.find(
      (d) =>
        d.creditor_name.toLowerCase().trim() === (row.data.creditor_name || "").toLowerCase().trim() &&
        d.debt_type === row.data.debt_type
    );
    if (fuzzyMatch) {
      matches.push({ rowIndex: idx, existingId: fuzzyMatch.id, existingName: fuzzyMatch.creditor_name, matchType: "fuzzy" });
    }
  });

  return matches;
}

// --- Mapping Signature ---

export function buildMappingSignature(headers: string[], mapping: FieldMapping): string {
  return headers.map((h) => `${h}:${mapping[h] || "IGNORE"}`).join(",");
}
