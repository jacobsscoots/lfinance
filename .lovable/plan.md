
# Fix Bank Sync Not Re-Creating Deleted Accounts

## Problem Summary
Your Monzo current account exists in the database but is marked as **soft-deleted** (has a `deleted_at` timestamp). When you sync:
1. The sync function tries to find an existing account - but the SELECT RLS policy filters out soft-deleted rows
2. It thinks the account is new and tries to INSERT
3. The INSERT fails because the unique constraint on `(provider, external_id)` still includes the soft-deleted row
4. The sync logs the error but continues, only syncing your savings pots

| Account | Status | Why Not Showing |
|---------|--------|-----------------|
| Monzo Current (Jacob Lawrence Martin Lane) | Soft-deleted (deleted_at set) | Unique constraint blocks re-insert |
| Starling Current | Soft-deleted | Same issue |
| Groceries Pot | Active | Shows correctly |
| Clothing Pot | Active | Shows correctly |
| Saving Challenge Pot | Active | Shows correctly |

---

## Solution Options

Since you chose **hard delete** for accounts earlier, the cleanest fix is to:

**Option A (Recommended):** Remove the soft-deleted rows so sync can recreate them
- Run a database migration to hard-delete rows where `deleted_at IS NOT NULL`
- The next sync will recreate the accounts fresh

**Option B:** Update the unique constraint to exclude soft-deleted rows
- Modify the unique index to include `WHERE deleted_at IS NULL`
- This allows re-inserting accounts with the same external_id if the original was soft-deleted

I recommend **Option A** since you've already switched to hard-delete strategy.

---

## Implementation

### Step 1: Clean Up Soft-Deleted Rows

Run a migration to permanently remove rows that were previously soft-deleted:

```sql
-- Remove orphaned soft-deleted accounts so sync can recreate them
DELETE FROM public.bank_accounts 
WHERE deleted_at IS NOT NULL;
```

This is safe because:
- These accounts were already "deleted" by the user
- Related transactions/bills were already cascade-deleted
- The sync will recreate them with fresh data from TrueLayer

### Step 2: Update Unique Index (Belt-and-Suspenders)

Also update the unique constraint to only apply to active accounts, preventing this issue in the future if any soft-deleted rows remain:

```sql
-- Drop existing partial unique indexes
DROP INDEX IF EXISTS bank_accounts_provider_external_id_unique;
DROP INDEX IF EXISTS bank_accounts_provider_external_id_key;

-- Recreate with deleted_at IS NULL condition
CREATE UNIQUE INDEX bank_accounts_provider_external_id_unique 
ON public.bank_accounts (provider, external_id) 
WHERE provider IS NOT NULL 
  AND external_id IS NOT NULL 
  AND deleted_at IS NULL;
```

### Step 3: Remove deleted_at Column (Optional)

Since you're now using hard-delete, the `deleted_at` column is no longer needed. However, this is optional and can be done later.

---

## Files to Modify

1. **Database migration** - Delete soft-deleted rows and update unique index

---

## Verification Steps

After the migration:
1. Press the **sync button** on Bank Connections card
2. Your Monzo current account should now appear
3. All transactions from your current account should sync
