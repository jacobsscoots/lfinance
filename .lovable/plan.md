
# Full Audit, Optimization, and Refactoring Plan

This plan addresses all 5 tasks: navigation reorganization, Deal Scanner removal, security fixes, code optimization, and mobile responsiveness improvements.

---

## Task Summary

| Task | Status | Priority |
|------|--------|----------|
| 1. Reorganize Navigation | Ready | Medium |
| 2. Remove Deal Scanner | Ready | High (causing build error) |
| 3. Security Fixes | Ready | High |
| 4. Code Optimization | Ready | Medium |
| 5. Mobile Responsiveness | Ready | Medium |

---

## CRITICAL: Build Error Fix

There's currently a build error:
```
Could not find a matching package for 'npm:resend@2.0.0'
at supabase/functions/scan-deals/index.ts:3:24
```

This is caused by the Deal Scanner edge function. Removing it (Task 2) will fix this error immediately.

---

## Task 1: Reorganize Navigation Bar

**Current Order** (13 items, cluttered):
1. Dashboard
2. Accounts
3. Transactions
4. Bills
5. Cheaper Bills
6. Investments
7. Calendar
8. Groceries
9. Meal Plan
10. Toiletries
11. Deal Scanner (to be removed)
12. Debt Tracker
13. Settings

**Proposed New Order** (12 items, grouped logically):

**Money & Tracking Group:**
1. Dashboard
2. Accounts
3. Transactions
4. Debt Tracker

**Bills & Savings Group:**
5. Bills
6. Cheaper Bills

**Investments Group:**
7. Investments

**Planning & Lifestyle Group:**
8. Calendar
9. Groceries
10. Meal Plan
11. Toiletries

**System Group:**
12. Settings

### Files to Update:
- `src/components/layout/AppSidebar.tsx` - Reorder navigation array
- `src/components/layout/MobileNav.tsx` - Match the same order

---

## Task 2: Remove Deal Scanner

This will fix the build error and completely remove the feature.

### Files to DELETE:
1. `src/pages/Deals.tsx` - Main page component
2. `src/components/deals/DealCard.tsx`
3. `src/components/deals/RuleFormDialog.tsx`
4. `src/components/deals/SourceFormDialog.tsx`
5. `src/hooks/useDealSources.ts`
6. `src/hooks/useDealRules.ts`
7. `src/hooks/useDeals.ts`
8. `src/hooks/useDealScanLogs.ts`
9. `src/hooks/useDealNotifications.ts`
10. `supabase/functions/scan-deals/` (entire directory)

### Files to UPDATE:
- `src/App.tsx` - Remove `/deals` route and Deals import
- `src/components/layout/AppSidebar.tsx` - Remove Deal Scanner nav item, remove Tag icon import
- `src/components/layout/MobileNav.tsx` - Remove Deal Scanner nav item (already removed - verified)

---

## Task 3: Security Fixes

Based on the security scan results, there are 3 active findings to address:

### 3.1 HIGH: Bank Credentials Token Storage (EXPOSED_SENSITIVE_DATA)
**Issue:** `bank_connections` table stores `access_token` and `refresh_token` in plaintext
**Current Mitigation:** A secure view `bank_connections_safe` excludes these fields
**Status:** Already implemented correctly - the client only queries `bank_connections_safe`
**Action:** Mark as addressed with documentation

### 3.2 WARN: Safe View RLS Policy (MISSING_RLS_PROTECTION)
**Issue:** `bank_connections_safe` view has no explicit RLS policies
**Current State:** View uses `security_invoker = on`, so it inherits the base table's RLS
**Action:** Add explicit documentation comment and verify the view is working correctly

### 3.3 INFO: UK Bank Holidays Public Access (PUBLIC_USER_DATA)
**Issue:** `uk_bank_holidays` table allows public SELECT
**Current State:** This is acceptable - bank holidays are public reference data
**Action:** Mark as intentionally public with documentation

### Additional Security Hardening:
1. **Edge Function Error Masking** - Review `compare-energy-deals` and other functions to ensure internal errors aren't leaked to clients
2. **Input Validation** - Verify all forms have proper Zod validation (already present in most forms)

---

## Task 4: Code Optimization & Bug Fixes

### 4.1 Unused Code Removal
- `src/hooks/useGmailReceipts.ts` - Contains only placeholder/stub code, not connected to any UI
  - **Decision:** Keep for now as it documents the planned Gmail integration architecture

### 4.2 Unused Icon Imports
After removing Deal Scanner:
- `AppSidebar.tsx` - Remove `Tag` icon import

### 4.3 Performance Optimizations
1. **Investments Page** - The `portfolioSummary` useMemo recalculates `calculateDailyValues` for every investment on every render when transactions change. This is already properly memoized with dependency array.

2. **QueryClient Configuration** - Add staleTime to reduce unnecessary refetches:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});
```

### 4.4 Code Quality Improvements
1. Remove console.log statements in production code (if any exist)
2. Ensure all `any` types are replaced with proper types where possible

---

## Task 5: Mobile Responsiveness Improvements

### Current State Analysis:
Most pages already have good mobile support:
- Transactions: Collapsible filters on mobile
- CheaperBills: Tab icons hide text on mobile
- Investments: Responsive grid with `grid-cols-2` on small screens
- Dashboard: 2/3 + 1/3 grid stacks properly
- Groceries: Tab text hides on mobile

### Improvements Needed:

#### 5.1 DebtTracker Page
- TabsList: Change from `grid-cols-5` to responsive: `grid-cols-3 sm:grid-cols-5` with smaller text
- Consider hiding tab icons on mobile to save space

#### 5.2 Navigation Consistency
- Verify MobileNav sheet width works on small screens (currently 264px, acceptable)
- Add touch-friendly spacing to all clickable elements

#### 5.3 Table Responsiveness
- `ToiletryTable`: Add horizontal scroll wrapper for better mobile experience
- `DebtList`: Ensure card view works well on mobile

#### 5.4 Form Dialogs
- All dialogs using `ResponsiveDialog` should already switch to drawer on mobile
- Verify all form dialogs have proper mobile scrolling

### Files to Update:
- `src/pages/DebtTracker.tsx` - Improve tab responsiveness
- `src/components/toiletries/ToiletryTable.tsx` - Add overflow-x-auto wrapper
- `src/components/debt/TransactionList.tsx` - Verify mobile layout
- `src/components/debt/PaymentList.tsx` - Verify mobile layout

---

## Implementation Order

1. **Phase 1: Critical Fix** (Build Error)
   - Delete `supabase/functions/scan-deals/` directory
   - This fixes the immediate build error

2. **Phase 2: Deal Scanner Removal**
   - Remove all Deal Scanner files (pages, components, hooks)
   - Update App.tsx and navigation files

3. **Phase 3: Navigation Reorganization**
   - Reorder items in AppSidebar.tsx
   - Update MobileNav.tsx to match

4. **Phase 4: Security Documentation**
   - Update security finding statuses
   - Add clarifying comments where needed

5. **Phase 5: Code Optimization**
   - Add QueryClient staleTime configuration
   - Clean up unused imports

6. **Phase 6: Mobile Responsiveness**
   - Update DebtTracker tabs
   - Add table scroll wrappers
   - Verify all dialogs work on mobile

---

## Verification Checklist

After implementation:
- [ ] Build compiles without errors
- [ ] Navigation shows 12 items in correct order
- [ ] `/deals` route returns 404
- [ ] All pages load without console errors
- [ ] Mobile view works on all pages (test at 375px width)
- [ ] Tables are scrollable horizontally on mobile
- [ ] All dialogs open correctly on mobile
- [ ] Security scan shows no new issues

---

## Technical Summary

| Category | Files to Delete | Files to Update |
|----------|-----------------|-----------------|
| Deal Scanner | 10 files + 1 directory | 2 files |
| Navigation | 0 | 2 files |
| Security | 0 | Security findings only |
| Optimization | 0 | 1 file (App.tsx) |
| Mobile | 0 | 4 files |

**Total Changes:** 10 deletions, ~8 file updates
