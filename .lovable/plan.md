

# Fix Account Deletion - Delete Related Data

## Problem Summary
You're getting "new row violates row-level security policy for table 'bank_accounts'" when trying to delete an account. Additionally, you want related bills and transactions to be deleted along with the account.

---

## Root Cause Analysis

The RLS policies on `bank_accounts` have been updated and **should now work** for soft-delete. However, there may be a caching delay or the error you're seeing is from before the fix was applied.

Since you've indicated you want **related data deleted too**, I'll implement a different approach: **hard delete with cascade**.

---

## Current Database Relationships

| Table | Column | Foreign Key Rule |
|-------|--------|------------------|
| `transactions` | `account_id` | `ON DELETE CASCADE` (auto-deletes) |
| `bills` | `account_id` | No cascade (will cause error or orphan) |

---

## Solution

### Step 1: Update Foreign Key on Bills Table
Change the `bills.account_id` foreign key to `ON DELETE CASCADE` so bills are automatically deleted when their linked account is deleted.

```sql
-- Drop existing FK
ALTER TABLE public.bills 
DROP CONSTRAINT IF EXISTS bills_account_id_fkey;

-- Recreate with CASCADE
ALTER TABLE public.bills 
ADD CONSTRAINT bills_account_id_fkey 
FOREIGN KEY (account_id) 
REFERENCES public.bank_accounts(id) 
ON DELETE CASCADE;
```

### Step 2: Change Delete Strategy from Soft-Delete to Hard-Delete
Update `useAccounts.ts` to perform a real DELETE instead of setting `deleted_at`:

```typescript
const deleteAccount = useMutation({
  mutationFn: async (id: string) => {
    // Hard delete - cascades to transactions and bills
    const { error } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
  // ... rest stays the same
});
```

### Step 3: Update RLS for Hard Delete (if needed)
The existing DELETE policy should work:
```sql
-- Already exists:
-- USING (auth.uid() = user_id)
```

---

## Alternative: Keep Soft-Delete + Cascade Orphan Handling

If you'd prefer to keep soft-delete (marking accounts as deleted rather than removing them), I can instead:
1. Set `bills.account_id = NULL` when an account is soft-deleted
2. Filter out bills with no account from certain views

Let me know if you prefer this approach instead.

---

## Files to Modify

1. **Database migration** - Update `bills_account_id_fkey` to `ON DELETE CASCADE`
2. **`src/hooks/useAccounts.ts`** - Change from soft-delete to hard-delete

---

## What Gets Deleted

When you delete an account:
- The account record will be **permanently removed**
- All **transactions** linked to that account will be **automatically deleted**
- All **bills** linked to that account will be **automatically deleted**

---

## Verification Steps

After implementation:
1. Try deleting an account on the Accounts page
2. Check the Transactions page - transactions for that account should be gone
3. Check the Bills page - bills linked to that account should be gone

