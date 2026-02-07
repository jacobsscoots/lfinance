
# Accounts Page - Fix Display Issues and Deduplicate

## Problems Identified

### 1. Database Duplicates (Root Cause)
The database contains **actual duplicate rows** with the same `external_id` but different `id` values:
- "Clothing" savings account: 5 duplicate rows
- "Groceries" savings account: 5 duplicate rows

The unique index on `(provider, external_id)` wasn't preventing this because `provider` is NULL for all accounts - NULL values don't match in unique constraints.

### 2. Provider is NULL
All bank accounts have `provider: NULL`. The sync function tries to extract the provider from TrueLayer's response (`account.provider?.provider_id`), but this data may not be reliably returned.

### 3. "Connected Bank" Label
The `bankProviders.ts` maps "truelayer" to "Connected Bank". Since `bank_connections` stores `provider: truelayer`, this is technically correct but unhelpful. The actual bank name (Monzo, Starling, etc.) isn't being stored.

---

## Solution

### Step 1: Clean Up Duplicate Accounts (Database Migration)
Delete duplicate account rows, keeping only the oldest record for each `external_id`:

```sql
-- Delete duplicate bank accounts, keeping the oldest by created_at
DELETE FROM bank_accounts
WHERE id NOT IN (
  SELECT DISTINCT ON (external_id) id
  FROM bank_accounts
  WHERE external_id IS NOT NULL
  ORDER BY external_id, created_at ASC
);
```

### Step 2: Create Unique Index on `external_id`
Since `provider` is NULL and may remain so, create a unique index just on `external_id` (which is the TrueLayer account ID):

```sql
-- Drop the old index if exists and create new one
DROP INDEX IF EXISTS bank_accounts_provider_external_id;
CREATE UNIQUE INDEX bank_accounts_external_id_unique 
ON bank_accounts(external_id) WHERE external_id IS NOT NULL;
```

### Step 3: Update Truelayer Sync - Extract Bank Provider
Modify the sync function to extract the actual bank provider from TrueLayer's API response. TrueLayer returns `provider.provider_id` (e.g., "ob-monzo", "ob-starling"):

```typescript
// In truelayer-sync/index.ts
const accountProvider = account.provider?.provider_id?.replace('ob-', '') || 
                        account.provider?.display_name ||
                        connectionProvider;
```

### Step 4: Update Provider Label Mapping
Extend `bankProviders.ts` to handle more variations and add a status indicator color function:

```typescript
// Add status indicator function
export function getConnectionStatusColor(status?: string): {
  color: string;
  label: string;
} {
  switch (status) {
    case 'connected':
      return { color: 'text-green-500', label: 'Connected' };
    case 'expired':
    case 'pending':
      return { color: 'text-amber-500', label: 'Needs Attention' };
    case 'error':
    case 'failed':
      return { color: 'text-red-500', label: 'Error' };
    default:
      return { color: 'text-muted-foreground', label: 'Unknown' };
  }
}

// Extend BANK_PROVIDER_LABELS for TrueLayer prefixes
"ob-monzo": "Monzo",
"ob-starling": "Starling Bank",
// etc.
```

### Step 5: Update AccountCard UI
Add a connection status indicator dot next to the bank name:
- Green dot: Connected and syncing normally
- Amber dot: Connection needs attention (expired/pending)
- Red dot: Error requiring fix

```tsx
// In AccountCard.tsx
// Add status indicator based on connection status or last_synced_at
<span className="h-2 w-2 rounded-full bg-green-500" />
```

### Step 6: Update useAccounts Hook
Add deduplication by `external_id` (not just by `id`) to handle any remaining edge cases:

```typescript
// Deduplicate by external_id, keeping first occurrence
const deduped = Array.from(
  new Map((data || []).map(a => [a.external_id || a.id, a])).values()
);
```

---

## Files to Modify

| File | Action |
|------|--------|
| `supabase/migrations/xxx.sql` | CREATE - Cleanup duplicates + fix unique index |
| `src/lib/bankProviders.ts` | MODIFY - Add TrueLayer prefixes + status color function |
| `src/components/accounts/AccountCard.tsx` | MODIFY - Add status indicator dot |
| `src/hooks/useAccounts.ts` | MODIFY - Dedupe by external_id |
| `supabase/functions/truelayer-sync/index.ts` | MODIFY - Extract bank name from provider data |

---

## Expected Results

1. Duplicate accounts removed from database (from ~14 to ~5 unique accounts)
2. Future syncs cannot create duplicates
3. Bank name displayed correctly (Monzo, Starling, etc. instead of "Connected Bank")
4. Green/amber/red status indicator shows connection health
5. UI shows each account exactly once

---

## Technical Details

### Status Indicator Logic
- **Green**: `last_synced_at` within last 24 hours OR connection status is "connected"
- **Amber**: `last_synced_at` > 24 hours OR connection status is "pending"/"expired"
- **Red**: Connection status is "error" OR no connection found

### Deduplication Strategy
1. Database level: Unique index prevents new duplicates
2. Hook level: Dedupe by `external_id` as defensive measure
3. UI level: React key by `id` (already done)
