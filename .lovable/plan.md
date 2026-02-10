
## Fix: Upcoming Bills Showing Wrong Due Dates

### Root Cause

The `generateBillOccurrences` function in `src/lib/billOccurrences.ts` has a bug for non-monthly frequencies (quarterly, biannual, yearly). 

For these frequencies, it seeds the occurrence calculation by calling `getDueDateForMonth(bill, rangeStart.year, rangeStart.month)`, which returns `due_day` in the **current month** (e.g., Feb 11 for a bill with `due_day: 11`). It then checks if that date is before `rangeStart` and advances if so.

The problem: this seed date ignores the bill's frequency entirely. A **yearly** bill due on November 11 gets a seed date of February 11 — which falls within the range and gets output as a valid occurrence. The function never validates that the seed date is an actual scheduled occurrence based on the `start_date` and frequency.

### Affected Bills (from your data)

| Bill | Frequency | Start Date | Due Day | Bug Shows | Correct Next |
|------|-----------|------------|---------|-----------|-------------|
| Snapchat Premium | yearly | 2025-11-11 | 11 | Feb 11 | Nov 11, 2026 |
| Purpl Discount | yearly | 2025-10-12 | 12 | Feb 12 | Oct 12, 2026 |
| Plant with Willow | yearly | 2025-10-17 | 17 | Feb 17 | Oct 17, 2026 |
| Magnesium | bimonthly | 2025-10-18 | 18 | Depends | Needs validation |

### Fix

Rewrite the non-weekly/fortnightly path in `generateBillOccurrences` to use the same forward-walk approach used for weekly bills: start from `billStart`, advance by the correct frequency interval until reaching `rangeStart`, then collect occurrences within the range.

This guarantees that only dates that are valid multiples of the frequency from the start date appear as occurrences.

### File Changed

**`src/lib/billOccurrences.ts`** (lines 122-149)

Replace the current approach:
```
// Current (buggy): seeds from current month's due_day
let currentDate = getDueDateForMonth(bill, rangeStart.getFullYear(), rangeStart.getMonth());
if (isBefore(currentDate, rangeStart)) {
  currentDate = getNextOccurrence(bill, currentDate);
}
```

With the frequency-aware forward walk:
```
// Fixed: walk forward from bill start date using correct frequency
let currentDate = billStart;
while (isBefore(currentDate, rangeStart)) {
  currentDate = getNextOccurrence(bill, currentDate);
}
```

This is the same pattern already used for weekly/fortnightly bills (lines 95-100) and is correct for all frequencies. It ensures a yearly bill starting Nov 11, 2025 only generates occurrences on Nov 11, 2026, Nov 11, 2027, etc.

### Impact

This fix affects the Dashboard "Upcoming Bills" widget, the yearly planner bill rows, and any other component using `generateBillOccurrences` or `getBillOccurrencesInRange`. All will now correctly skip months where non-monthly bills are not actually due.
