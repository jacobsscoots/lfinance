
# Add Editable Monthly Contribution for Investments

## Summary
You want to set a £50/month contribution for your ChipX AI Fund and have the projections reflect this accurately. Currently, the monthly contribution is calculated from historical transactions rather than being a configurable value.

---

## Current Behavior

| Item | How It Works Now |
|------|------------------|
| Monthly contribution display | Calculated by averaging all deposits over time |
| Projection calculations | Uses the calculated average |
| Editing contribution | Not possible - read-only display |

This means if you made irregular deposits, the "monthly contribution" shown is just an estimate, not your actual planned contribution.

---

## Solution

### Step 1: Add Database Column
Add a `monthly_contribution` column to the `investment_accounts` table to store your configured contribution amount:

```sql
ALTER TABLE public.investment_accounts 
ADD COLUMN monthly_contribution numeric DEFAULT 0;
```

### Step 2: Update ProjectionCard to Be Editable
Modify the ProjectionCard component to:
- Accept an `onContributionChange` callback prop
- Display an editable input field for monthly contribution (defaulting to £50)
- Call the update function when the value changes

### Step 3: Update Investment Hook and Types
- Add `monthly_contribution` to the `InvestmentAccount` interface
- Allow updating the contribution via `updateInvestment`

### Step 4: Wire Up the Investments Page
- Pass the stored `monthly_contribution` to ProjectionCard instead of the calculated average
- Add a handler to save changes when the contribution is edited
- Fall back to £50 if no value is set

---

## Files to Modify

1. **Database migration** - Add `monthly_contribution` column
2. **`src/hooks/useInvestments.ts`** - Add type for new column
3. **`src/components/investments/ProjectionCard.tsx`** - Make contribution editable
4. **`src/pages/Investments.tsx`** - Use stored value, handle updates

---

## Result

After implementation:
- Your ChipX AI Fund will show £50/month as the monthly contribution
- You can edit this value directly in the projections card
- Projections (3m, 6m, 12m) will accurately reflect £50/month contributions
- The value persists in the database so it's remembered between sessions

---

## Technical Details

### ProjectionCard Changes
```text
Before: <span>£{monthlyContribution}/month</span> (read-only)
After:  <Input value={50} onChange={...} /> /month (editable)
```

### Projection Formula
The projection uses compound growth with monthly contributions:
```text
For each month:
  value = (value + monthlyContribution) * (1 + monthlyRate)
```

With £50/month at 8% annual return:
- 3 months: currentValue + £150 + growth
- 6 months: currentValue + £300 + growth  
- 12 months: currentValue + £600 + growth
