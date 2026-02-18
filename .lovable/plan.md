
## Fix Plan: 11 Build Errors Across 6 Files

All errors are straightforward TypeScript strictness failures — either `undefined` not narrowed before use, or a `Record<string, any>` being passed where a typed object is expected. No logic changes are required; only targeted type guards and casts.

---

### Error Breakdown & Fixes

**1. `supabase/functions/analyze-usage-ai/index.ts` — Line 266**

- **Error**: `tariff.standing_charge_daily` is possibly `undefined`
- **Fix**: Add a nullish coalesce fallback: `(tariff.standing_charge_daily ?? 0)`

```typescript
// Before
const currentAnnual = tariff ? (tariff.unit_rate_kwh * 2900 / 100) + (tariff.standing_charge_daily * 365 / 100) : null;

// After
const currentAnnual = tariff
  ? (tariff.unit_rate_kwh * 2900 / 100) + ((tariff.standing_charge_daily ?? 0) * 365 / 100)
  : null;
```

---

**2. `supabase/functions/compare-energy-deals/index.ts` — Lines 522, 525, 532–535**

- **Root Cause**: `currentMonthlyCost` is typed as `number | undefined` by the Zod schema (it is `.optional()`). It is passed directly to functions expecting `number`, and used in arithmetic in the `default` case without a guard.
- **Fix**: Add an early guard at the top of the `switch` block for non-energy service types, defaulting to `0` if not provided:

```typescript
// Before switch statement, add:
const monthlyCost = currentMonthlyCost ?? 0;

// Then replace all uses of currentMonthlyCost in the switch cases with monthlyCost
comparisons = scanBroadbandDeals(monthlyCost, ...);
comparisons = scanMobileDeals(monthlyCost, ...);
// and in the default case:
monthlyCost * 0.9, monthlyCost * 0.1 * 12, etc.
```

---

**3. `supabase/functions/gmail-oauth/index.ts` — Line 222**

- **Error**: `code` is `string | undefined` (Zod `.optional()`) but `URLSearchParams` expects `string`
- **Fix**: Provide a fallback: `code: code ?? ""`

```typescript
body: new URLSearchParams({
  client_id: GOOGLE_CLIENT_ID,
  client_secret: GOOGLE_CLIENT_SECRET,
  code: code ?? "",
  grant_type: 'authorization_code',
  redirect_uri: redirect_uri || `${SUPABASE_URL}/functions/v1/gmail-oauth`,
}),
```

---

**4. `supabase/functions/gmail-sync-receipts/index.ts` — Line 422**

- **Error**: Arrow function parameters `w` and `d` implicitly have `any` type in a `.filter()` / `.some()` chain
- **Fix**: Add explicit `string` type annotations:

```typescript
const overlap = mWords.filter((w: string) => w.length >= 3 && dWords.some((d: string) => d.includes(w) || w.includes(d)));
```

---

**5. `supabase/functions/tracking-webhook/index.ts` — Line 98**

- **Error**: `rawStatus` is `string | undefined` (Zod `.optional()`), but `mapStatus` accepts `string`
- **Fix**: Pass a fallback: `mapStatus(rawStatus ?? "")`
  - Note: `mapStatus` already handles empty string gracefully (`tmStatus || ""` on line 44), so `""` is the correct safe default.

```typescript
const mappedStatus = mapStatus(rawStatus ?? "");
```

---

**6. `src/components/settings/ExcelImportDialog.tsx` — Lines 474, 521**

- **Error**: `pickValidCols(...)` returns `Record<string, any>`, which is not assignable to the strict Supabase insert type for `bills` and `debts`. TypeScript cannot verify the required fields (`amount`, `due_day`, `name`, `user_id` for bills; `creditor_name`, `current_balance`, `debt_type`, `starting_balance`, `user_id` for debts) are present at compile time.
- **Fix**: Add a type assertion `as any` on the array being inserted, since `pickValidCols` is a runtime whitelist function that already guarantees only valid column names are passed. This is the minimal and least-risky change — the runtime behaviour is correct, this is purely a TypeScript inference limitation.

```typescript
// Line 474 — bills insert
.insert([insertData] as any);

// Line 521 — debts insert
.insert([debtInsertData] as any);
```

This is appropriate here because:
- `pickValidCols` already strips any columns not in the whitelist at runtime
- The Supabase client will return a typed error response if anything is wrong
- Changing `ProcessedRow.normalised` to a full typed union would require a large refactor of the entire import pipeline and carries significant regression risk

---

### Files to Edit (6 total)

| File | Lines Changed | Change Type |
|---|---|---|
| `supabase/functions/analyze-usage-ai/index.ts` | 266 | Add `?? 0` nullish coalesce |
| `supabase/functions/compare-energy-deals/index.ts` | 507, 522, 525, 532–535 | Extract `monthlyCost` variable with `?? 0` |
| `supabase/functions/gmail-oauth/index.ts` | 222 | Add `?? ""` fallback for `code` |
| `supabase/functions/gmail-sync-receipts/index.ts` | 422 | Add `: string` type annotation to filter params |
| `supabase/functions/tracking-webhook/index.ts` | 98 | Add `?? ""` fallback for `rawStatus` |
| `src/components/settings/ExcelImportDialog.tsx` | 474, 521 | Add `as any` to `.insert()` arrays |

No database changes, no new files, no dependency changes. All fixes are minimal and non-breaking.
