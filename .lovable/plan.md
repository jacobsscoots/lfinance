
# Accounts Module - Bug Fixes & Enhancements

## Implementation Summary

I will now implement the following changes based on the approved plan:

### 1. Database Migration
- Add `display_name` (text, nullable) and `is_hidden` (boolean, default false) columns to `bank_accounts`
- Verify provider column exists in bank_accounts; reuse it if present, only add if missing to store the bank provider
- Create unique index on (provider, external_account_id) to prevent duplicate accounts

### 2. Create `src/lib/bankProviders.ts`
Provider name mapping utility to fix "Open banking" label bug

### 3. Update `src/hooks/useAccounts.ts`
- Add new fields to BankAccount interface (`display_name`, `is_hidden`, `provider`)
- Add 10-minute auto-refresh with `refetchInterval`
- Add `refetchOnWindowFocus: true`
- Update totalBalance to exclude hidden accounts
- Add deduplication logic
- Add `visibleAccounts` vs `allAccounts` exports

### 4. Update `src/components/accounts/AccountCard.tsx`
- Use `display_name` with provider label fallback
- Add hide/show toggle in dropdown menu
- Show provider label correctly

### 5. Update `src/components/accounts/AccountFormDialog.tsx`
- Add display name field for editing
- Update form to handle `display_name`

### 6. Update `src/pages/Accounts.tsx`
- Filter hidden accounts from display by default
- Add toggle to show/hide hidden accounts
- Deduplicate before rendering
- UI deduplication is defensive only; database uniqueness + UPSERT is the source of truth

### 7. Update `src/components/accounts/BankConnectionCard.tsx`
- Display actual bank provider name instead of "Open Banking"

### 8. Update `supabase/functions/truelayer-sync/index.ts`
- Store provider in bank_accounts
- Use UPSERT by `(provider, external_id)` instead of just `external_id`

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/xxx_accounts_enhancements.sql` | CREATE - Add new columns and index |
| `src/lib/bankProviders.ts` | CREATE - Provider mapping utility |
| `src/hooks/useAccounts.ts` | MODIFY - Add auto-refresh, dedup, hidden filtering |
| `src/components/accounts/AccountCard.tsx` | MODIFY - Display name, hide toggle, provider label |
| `src/components/accounts/AccountFormDialog.tsx` | MODIFY - Add display_name field |
| `src/pages/Accounts.tsx` | MODIFY - Hidden account toggle, dedup |
| `src/components/accounts/BankConnectionCard.tsx` | MODIFY - Show correct provider name |
| `supabase/functions/truelayer-sync/index.ts` | MODIFY - UPSERT logic + provider |
