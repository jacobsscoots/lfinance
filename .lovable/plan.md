# Fix Account Deduplication – Database as Source of Truth

## Current Problems

### 1. Column Name Inconsistency (Resolved)
- Database column: `external_id`
- Earlier plan referenced: `external_account_id`
- **Decision**: Use `external_id` consistently everywhere (confirmed existing column)

All references (DB, types, sync, UI) must use:
- `provider`
- `external_id`

No aliases, no fallbacks, no mixed naming.

---

### 2. Conflicting Unique Indexes
Two previous migrations caused confusion:
- One migration created a composite index `(provider, external_id)`
- A later migration dropped it and created a unique index on `external_id` only

**Current state (verified):**
- Only `external_id` unique index exists
- This allows duplicates when the same external_id appears across providers

This must be corrected.

---

### 3. TrueLayer Sync Not Using Composite Key
The TrueLayer sync currently checks existence using:

```ts
.eq('external_id', account.account_id)
.eq('user_id', userId)
This is insufficient and allows duplicate rows when:

provider differs

provider is NULL

multiple banks reuse similar account IDs

4. UI Deduplication Acting as Primary Fix
The UI currently deduplicates accounts in useAccounts.ts.

This must remain defensive only, not relied upon to correct data integrity issues.

Final Design Decision (Source of Truth)
Database is the source of truth.

Uniqueness is enforced by:

(provider, external_id) at the database level

TrueLayer sync using the same composite key

UI deduplication only as a safety net

Solution
1. Database Migration – Composite Unique Index
Replace the current external_id-only uniqueness with a composite key.

Important design choice:

We explicitly handle NULL providers using COALESCE

This prevents duplicates even if provider data is temporarily missing

-- Drop the existing single-column unique index
DROP INDEX IF EXISTS public.bank_accounts_external_id_unique;

-- Create composite unique index on (provider, external_id)
-- COALESCE ensures NULL providers are treated consistently
CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_provider_external_id_key
ON public.bank_accounts (COALESCE(provider, 'unknown'), external_id)
WHERE external_id IS NOT NULL;

COMMENT ON INDEX bank_accounts_provider_external_id_key IS
  'Source of truth for bank account uniqueness: (provider, external_id). UI deduplication is defensive only.';
This guarantees:

No duplicate bank accounts at DB level

Safe handling of NULL provider edge cases

Deterministic UPSERT behavior

2. TrueLayer Sync – Composite Lookup + UPSERT
Update the existing account lookup to fully match the unique key.

Before (insufficient)
.eq('external_id', account.account_id)
.eq('user_id', userId)
After (correct)
// Source of truth lookup: (provider, external_id)
const { data: existingAccount } = await supabase
  .from('bank_accounts')
  .select('id, display_name, provider')
  .eq('external_id', account.account_id)
  .eq('provider', accountProvider)
  .eq('user_id', userId)
  .maybeSingle();
Rules:

Inserts and updates must include provider

UPSERT must align with the composite unique index

No fallback matching by name or display label

3. useAccounts.ts – Mark UI Deduplication as Defensive
UI deduplication stays, but is explicitly documented as non-authoritative.

// DEFENSIVE ONLY:
// Database uniqueness on (provider, external_id) is the source of truth.
// This client-side deduplication is a safety net for rare edge cases
// and should not be relied upon to fix data integrity issues.
const uniqueAccounts = Array.from(
  new Map((data || []).map(a => [a.external_id || a.id, a])).values()
) as BankAccount[];
This avoids:

masking real sync bugs

future devs relying on UI dedup instead of DB constraints

Files to Modify
File	Action
supabase/migrations/xxx_fix_unique_index.sql	CREATE – Replace unique index with composite key
supabase/functions/truelayer-sync/index.ts	MODIFY – Use (provider, external_id) for lookup & UPSERT
src/hooks/useAccounts.ts	MODIFY – Mark deduplication as defensive only
Column Name Verification (Locked)
Location	Column	Status
bank_accounts table	external_id	Confirmed
bank_accounts table	provider	Confirmed
Type definitions	external_id	Matches
Type definitions	provider	Matches
TrueLayer sync	external_id	Uses account.account_id
TrueLayer sync	provider	Uses accountProvider
No other column names should be introduced.

Expected Behavior After Fix
Database is authoritative

Duplicate accounts cannot be created at DB level

TrueLayer sync is deterministic

Existing accounts are updated, not reinserted

UI dedup is defensive

Rare edge cases only, not a primary fix

No silent UPSERT failures

Column names and unique keys are consistent everywhere

Explicit Non-Goals
No data backfills

No account merging logic

No transaction refactors

No manual cleanup scripts

If duplicates already exist, they will be handled separately.