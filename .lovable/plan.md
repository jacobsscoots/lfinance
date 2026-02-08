
# Fix Bank Account Deletion

## Problem Summary
Bank accounts appear to not be deletable, but they ARE being soft-deleted correctly. The issue is that soft-deleted accounts continue to appear in the UI due to:
1. Conflicting RLS policies on the SELECT operation
2. Missing client-side filter for `deleted_at`

## Solution Overview
Update both the database RLS policies and the frontend query to properly exclude soft-deleted accounts from view while preserving the historical relationship with bills.

---

## Implementation Steps

### Step 1: Clean Up RLS Policies
Remove the permissive `Users can view own accounts` policy that's overriding the active-only policy.

```sql
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view own accounts" ON bank_accounts;

-- Keep only the policy that filters soft-deleted records
-- "Users can view their own active accounts" already exists with:
-- USING (auth.uid() = user_id AND deleted_at IS NULL)
```

### Step 2: Update Frontend Query (Safety Net)
Add a client-side filter as a defensive measure in `useAccounts.ts`:

```typescript
// In the query function
const { data, error } = await supabase
  .from('bank_accounts')
  .select('*')
  .is('deleted_at', null)  // Explicitly filter soft-deleted
  .order('is_primary', { ascending: false })
  .order('name');
```

### Step 3: Preserve Bills Relationship
The existing architecture already handles this correctly:
- Bills table has `account_id` as nullable
- Bills remain intact when accounts are soft-deleted
- Bills can display historical account names through the join

No changes needed for bills - the soft-delete strategy preserves the relationship.

### Step 4: Update Bill Form Dialog (Optional Enhancement)
Ensure the account dropdown in bill forms only shows active accounts by filtering the accounts list (this should already work once Step 1/2 are complete).

---

## Technical Details

### Why Soft Delete?
The project uses soft delete (`deleted_at` timestamp) instead of hard delete to:
- Preserve historical data integrity
- Keep bills linked to deleted accounts for reporting
- Allow potential account recovery

### RLS Policy Conflict Explained
PostgreSQL RLS combines permissive policies with OR logic:
- Policy A: `user_id = auth.uid()` (all user accounts)
- Policy B: `user_id = auth.uid() AND deleted_at IS NULL` (active only)

Result: A OR B = A (the broader policy wins)

### Files to Modify
1. `supabase/migrations/` - New migration to drop conflicting RLS policy
2. `src/hooks/useAccounts.ts` - Add `.is('deleted_at', null)` filter

---

## Verification Steps
1. Delete an account from the Accounts page
2. Confirm the account disappears from the UI
3. Verify bills linked to that account still display correctly
4. Confirm the historical account name is still visible on those bills
