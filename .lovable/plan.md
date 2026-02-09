# Excel Import Feature for Bills, Subscriptions, and Debts (Settings Tab)

Build a robust Excel import flow that lets me upload my existing spreadsheet and automatically populate the app by reading the workbook’s **Settings** sheet.

This must support **Bills**, **Subscriptions**, and **Debts** as separate import sections, with a user-confirmed mapping step, validation, duplicate handling, and an import history log.

---

## 1) Goal

When I upload an Excel file:

- The app finds a worksheet named **Settings** (case-insensitive; also accept: `Setting`, `SETTINGS`, `settings`, `Config`, `Configuration`).
- It detects data on that sheet and extracts rows for:
  - **Bills**
  - **Subscriptions**
  - **Debts**
- It shows a mapping/preview UI so I can confirm how columns map to app fields.
- It validates, de-dupes, and imports records in an idempotent way.
- It creates an **import log** entry showing what was added/updated/skipped.

---

## 2) Architecture / Approach

- Do parsing client-side using **SheetJS (`xlsx`)**.
- Use existing authenticated DB hooks/mutations for insert/update (RLS must still apply).
- If parsing large files becomes slow, move parsing into a web worker (optional).

---

## 3) New Dependency

| Package | Purpose |
|--------|---------|
| `xlsx` (SheetJS) | Parse `.xlsx` files in the browser |

**File support:**
- `.xlsx` required (fully supported).
- `.xls` optional / best-effort (if it fails, show a clear “Please save as .xlsx” message).

---

## 4) Database Changes

### 4.1 import_logs table
Track each import run.

Columns:
- `id` uuid PK
- `user_id` uuid (RLS scoped)
- `imported_at` timestamptz default now()
- `file_name` text
- `settings_sheet_name` text
- `layout_detected` text  (e.g. `CATEGORY_TABLE` / `SECTION_TABLES`)
- `mapping_signature` text (hash of headers + mapping)
- `bills_added` int
- `bills_updated` int
- `bills_skipped` int
- `subs_added` int
- `subs_updated` int
- `subs_skipped` int
- `debts_added` int
- `debts_updated` int
- `debts_skipped` int
- `details` jsonb (row-level results, errors, duplicate decisions, ids updated/created)

RLS:
- user can insert/read only their own rows.

### 4.2 (Optional but recommended) stable import key fields
To make idempotency reliable, add optional columns:

- Bills: `import_key` text unique per user (nullable)
- Debts: `import_key` text unique per user (nullable)

If you can’t alter existing tables, store a mapping in `import_logs.details`, but **stable import_key on the record is better**.

How to create `import_key`:
- Use a deterministic hash from “source identity” fields.
- Example for bills/subs: `lower(name) + provider + frequency + due_day`
- Example for debts: `lower(creditor_name) + debt_type + starting_balance` (plus optional account/reference if present)

Important: **Do NOT include amount/current_balance in the key** because those change.

---

## 5) Supported Excel Layouts

### Layout A — Single table with Category column
A table containing a `Category` / `Type` column that includes values like:
- Bills
- Subscriptions
- Debts

### Layout B — Separate tables under headings
The Settings sheet has sections separated by headings like:
- “Bills”
- “Subscriptions”
- “Debts”
…each followed by a header row + rows, with blank lines between sections.

### Must also handle messy real-world Settings tabs
- Notes rows above/below tables
- Blank columns
- Extra helper columns
- Multiple header candidates

Rule:
- A section/table is valid only if a header row is detected with at least **2 recognised fields**.

---

## 6) New Files

### 6.1 `src/lib/excelImportParser.ts`
Pure logic module.

Functions:

- `findSettingsSheet(workbook): { sheetName: string | null, availableSheets: string[] }`
  - Look for Settings variants.
- `sheetToGrid(sheet): string[][]`
  - Convert to a 2D grid for scanning headings and header rows.
- `detectLayout(grid): 'CATEGORY_TABLE' | 'SECTION_TABLES' | 'UNKNOWN'`
- `extractTables(grid): Array<{ sectionName: string, headers: string[], rows: Record<string, any>[] }>`
  - Returns tables with normalised headers.
- `assignSections(tables): { bills: Table | null, subscriptions: Table | null, debts: Table | null }`
  - Match section names and/or category values.

Normalisation helpers:
- `normaliseHeader(h: string): string` (trim, collapse spaces, lower)
- `normaliseAmount(v): number | null` (strip £, commas, spaces; handle negatives)
- `normaliseDate(v): string | null` (Excel serial, DD/MM/YYYY, ISO → return ISO date `YYYY-MM-DD`)
- `normaliseDueDay(v): number | null` (1–31)
- `normaliseFrequency(v): BillFrequency | null` (monthly/weekly/quarterly/annual etc.)
- `normaliseBoolean(v): boolean | null`

### 6.2 `src/lib/excelFieldMapping.ts`
Target field definitions + mapping + validation.

Target fields:

**Bills / Subscriptions target fields**
- required: `name`, `frequency`
- strongly recommended: `amount`, `due_day` (or `due_date`)
- optional: `provider`, `bill_type`, `notes`, `active`, `autopay`
- derived:
  - Bills: `is_subscription = false`
  - Subscriptions: `is_subscription = true`

**Debts target fields**
- required: `creditor_name`, `debt_type`
- recommended: `starting_balance` OR `current_balance`, `min_payment`, `apr`, `due_day`
- optional: `notes`, `interest_type`

Mapping:
- `autoDetectMapping(headers, targetFields)` using fuzzy matching + synonym lists:
  - e.g. “Bill Name”, “Name”, “Payee” → `name`
  - “Due Date”, “Payment Day”, “Due Day” → `due_day`/`due_date`
  - “APR”, “Interest” → `apr`
- Must include `IGNORE` option for irrelevant columns.

Validation:
- `validateRow(row, mapping, fields)` → `{ valid, errors[], data }`
- Block import if required fields missing.
- Soft warnings for missing recommended fields.

Stable key:
- `buildImportKey(entityType, data)` for bills/subs/debts.

Duplicate detection:
- Prefer matching by `import_key` (best).
- Fallback: match by (name/provider/frequency/due_day) for bills/subs; (creditor/debt_type) for debts.

### 6.3 `src/components/settings/ExcelImportDialog.tsx`
Multi-step UI (modal or inline).

**Step 1 — Upload**
- Drag/drop + file picker
- Accept `.xlsx` + best-effort `.xls`
- Parse workbook and list available sheets if Settings not found.

**Step 2 — Detection**
- Show detected sections:
  - Bills: X rows
  - Subscriptions: Y rows
  - Debts: Z rows
- If Subscriptions are present as a separate section OR Category values:
  - guarantee they are separated from Bills
- Allow manual reassignment:
  - “This table is: Bills / Subscriptions / Debts / Ignore”

**Step 3 — Column Mapping**
- For each section, show:
  - detected headers
  - dropdown per header mapping to target field or IGNORE
- Auto-fill mapping suggestions.
- Required fields highlighted.
- Save mapping to localStorage using a **header signature hash**:
  - key: `excel-import-mapping-v2:{signature}`

**Step 4 — Preview + Validation + Duplicates**
- Preview first 20 rows per section.
- Show row validation status.
- Duplicates:
  - show matched existing record (name + due day etc.)
  - choose per duplicate: Skip / Update / Import as New
- Provide “Apply to all duplicates” option.
- Show summary counts (to add/update/skip) per section.
- Block Import if required field errors exist.

**Step 5 — Import + Results**
- Import with progress:
  - bills then subs then debts (or parallel but keep UI stable)
- Use `import_key` strategy for idempotency.
- Write import_logs row with full details.
- Buttons:
  - Go to Bills
  - Go to Subscriptions (if page exists; otherwise Bills filtered)
  - Go to Debts

### 6.4 `src/components/settings/SampleTemplateDownload.tsx`
Generate a downloadable `.xlsx` template with:
- A `Settings` sheet
- Layout B:
  - “Bills” heading + headers + 2 sample rows
  - blank line
  - “Subscriptions” heading + headers + 2 sample rows
  - blank line
  - “Debts” heading + headers + 2 sample rows

### 6.5 `src/hooks/useImportLogs.ts`
Hook to fetch import history and insert import log entries.

### 6.6 Tests (recommended)
`src/lib/excelImportParser.test.ts` covering:
- settings sheet detection variants
- layout detection
- messy tables (notes/blank columns)
- UK date parsing DD/MM/YYYY
- amount parsing
- section extraction incl. Subscriptions
- import_key generation stability

---

## 7) Files to Modify

- `src/pages/Settings.tsx`
  - Add an “Import” tab/section
  - Render ExcelImportDialog + import history list

- `src/pages/Bills.tsx`
  - Add “Import Excel” button

- `src/pages/DebtTracker.tsx`
  - Add “Import Excel” button

- (Optional) `src/pages/Subscriptions.tsx`
  - If Subscriptions are a distinct page, add Import button too
  - Otherwise, show subscriptions via Bills with filter `is_subscription=true`

---

## 8) Import Logic Rules

### 8.1 Idempotency (must be real, not “best effort”)
- Generate `import_key` per row.
- If an existing record with same `import_key` exists:
  - default action = Update (unless user chooses otherwise)
- If no match:
  - Insert new.

### 8.2 Updates (safe merge)
When updating:
- Only overwrite fields provided by Excel mapping.
- Do not wipe fields that aren’t in the import (unless user toggles “overwrite missing with blank”).

### 8.3 Error handling
- Settings sheet not found:
  - show available sheet names.
- No valid tables found:
  - explain what qualifies as a table and offer the sample template.
- Parsing `.xls` fails:
  - instruct to save as `.xlsx`.

---

## 9) Implementation Order

1. Install `xlsx`
2. Add DB migration for `import_logs` (+ optional `import_key` columns)
3. Build parser + mapping libs
4. Add unit tests (parser + normalisers)
5. Build ExcelImportDialog UI
6. Add SampleTemplateDownload
7. Add useImportLogs hook + UI list in Settings
8. Add Import buttons to Bills/Debt pages
9. End-to-end test with:
   - Settings sheet Layout A
   - Settings sheet Layout B
   - UK dates and currency
   - Duplicate + update behavior
   - Re-import same file twice (should not duplicate)

---

## 10) Definition of Done (Acceptance Tests)

- Uploading a file with a valid Settings sheet imports:
  - Bills, Subscriptions, Debts correctly
- Mapping is user-confirmable and saved for next time
- Missing required fields blocks import with clear errors
- Re-importing the same file does **not** create duplicates
- Import log is saved and viewable
- Errors are user-friendly and actionable