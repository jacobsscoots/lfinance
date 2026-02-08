

# Fix Accounts Tab Errors

## Problem Summary
You're experiencing two distinct errors on the Accounts tab:

1. **"Connection failed: truelayer-auth: Edge Function returned a non-2xx status code"**
2. **"Failed to delete account: new row violates row-level security policy for table 'bank_accounts'"**

---

## Error 1: TrueLayer Connection Failed

### Root Cause
Looking at the edge function logs, I can see this error:
```
[exchange-code] Failed to exchange code for tokens { error: "invalid_grant" }
```

The `invalid_grant` error occurs when:
- The authorization code has already been used (codes are single-use)
- The code has expired (typically valid for only 30-60 seconds)
- The redirect URI doesn't match exactly between auth and token exchange

**What's happening:** When you return from TrueLayer's bank selection, sometimes the callback fires twice (common with React's StrictMode or browser navigation quirks), and the second attempt fails because the code was already used.

### Solution
Add duplicate call protection to the OAuth callback handler:
1. Store a "processing" flag to prevent double-processing
2. Clear the localStorage connection ID immediately after reading it
3. Add error handling for already-used codes

---

## Error 2: Failed to Delete Account (RLS Violation)

### Root Cause
The database has **conflicting RLS UPDATE policies** on the `bank_accounts` table:

Current policies found:
| Policy Name | Command | Condition |
|-------------|---------|-----------|
| `Users can update own accounts` | UPDATE | `user_id = auth.uid()` |
| `Users can update their own accounts` | UPDATE | `user_id = auth.uid() AND deleted_at IS NULL` |
| `Users can soft delete their own accounts` | UPDATE | `user_id = auth.uid()` (USING + WITH CHECK) |

The problem:
- Policy "Users can update their own accounts" has a **WITH CHECK** that requires `deleted_at IS NULL`
- When you soft-delete (set `deleted_at`), the **NEW row** has `deleted_at = timestamp`
- This fails the WITH CHECK condition `deleted_at IS NULL`

In PostgreSQL, for UPDATE operations with multiple policies:
- **USING** = "Can you see/access this row to update it?"
- **WITH CHECK** = "Is the new row (after update) allowed?"

The "Users can update their own accounts" policy only has USING but inherits a restrictive WITH CHECK that blocks setting `deleted_at`.

### Solution
Clean up the duplicate UPDATE policies and ensure soft-delete works properly:
1. Drop the duplicate "Users can update own accounts" policy (from initial migration)
2. Modify "Users can soft delete their own accounts" to allow setting the `deleted_at` timestamp

---

## Implementation Steps

### Step 1: Fix Database RLS Policies
Run a migration to clean up the conflicting policies:

```sql
-- Drop the duplicate update policy from the initial migration
DROP POLICY IF EXISTS "Users can update own accounts" ON bank_accounts;

-- The "Users can update their own accounts" policy restricts to deleted_at IS NULL
-- which is correct for normal updates but blocks soft-delete.
-- The "Users can soft delete their own accounts" should handle the soft-delete case.
-- But we need to ensure WITH CHECK allows setting deleted_at.

-- Drop and recreate the soft-delete policy with proper WITH CHECK
DROP POLICY IF EXISTS "Users can soft delete their own accounts" ON bank_accounts;

CREATE POLICY "Users can soft delete their own accounts"
ON public.bank_accounts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND (deleted_at IS NOT NULL OR deleted_at IS NULL)
);
```

### Step 2: Fix TrueLayer Double-Processing
Update `Accounts.tsx` to prevent the OAuth callback from being processed twice:

```typescript
// Add a ref to track if we're already processing
const processedRef = useRef(false);

useEffect(() => {
  const isCallback = searchParams.get('truelayer_callback');
  const code = searchParams.get('code');
  const connectionId = localStorage.getItem('pending_bank_connection_id');

  // Prevent double-processing
  if (isCallback && code && connectionId && !isProcessingCallback && !processedRef.current) {
    processedRef.current = true;
    setIsProcessingCallback(true);
    
    // Clear localStorage immediately to prevent re-processing
    localStorage.removeItem('pending_bank_connection_id');
    
    // Clear URL params
    setSearchParams({});
    
    // Complete the connection
    completeConnection.mutate(
      { code, connectionId },
      {
        onSettled: () => {
          setIsProcessingCallback(false);
        },
      }
    );
  }
}, [searchParams, setSearchParams, completeConnection, isProcessingCallback]);
```

### Step 3: Improve Error Messages
Update the error handling to provide clearer messages for the "invalid_grant" error:

In `useBankConnections.ts`, enhance the `normalizeError` function to detect and explain common OAuth errors.

---

## Technical Details

### Why Multiple UPDATE Policies Conflict
PostgreSQL RLS combines multiple **permissive** policies with OR for access:
- If ANY policy allows the operation, it proceeds (for USING)
- But ALL policies' WITH CHECK conditions must pass (they're AND-ed)

The issue:
- "Users can update their own accounts" uses `USING (deleted_at IS NULL)` 
- This means when `deleted_at IS NULL`, the row is visible for update
- But when you SET `deleted_at = now()`, if any other policy has a restrictive WITH CHECK, it can fail

### Files to Modify
1. `supabase/migrations/` - New migration for RLS policy cleanup
2. `src/pages/Accounts.tsx` - Add ref-based double-processing prevention
3. `src/hooks/useBankConnections.ts` - Improve error messages for OAuth errors

---

## Verification Steps
1. After migration: Try deleting an account - should work without RLS error
2. For TrueLayer: Try connecting a bank again - should only process once
3. Check that normal account updates still work (editing name, balance, etc.)

