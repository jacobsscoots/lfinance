

# Meal Planner - Copy to Date Feature

This plan adds two new copy options to each day in the meal planner:
1. **Copy to Previous Day** - Quick action to copy meals backwards
2. **Copy to Date** - Pick any date within the current week to copy to

---

## Current State

Each day card (`MealDayCard.tsx`) currently has:
- "Copy to Next Day" in the dropdown menu (via `copyDayToNext` mutation)
- This is disabled on the last day of the week

The `useMealPlanItems` hook has:
- `copyDayToNext` mutation that copies items from one day to the next
- Logic to clamp seasonings during copy (max 15g)

---

## Implementation Summary

| Change | Description |
|--------|-------------|
| Add `copyDayToPrevious` mutation | New mutation in hook to copy to previous day |
| Add `copyDayToDate` mutation | New mutation to copy to any date in the week |
| Add "Copy to Previous Day" menu item | Quick action in the day dropdown |
| Add "Copy to Date..." menu item | Opens a date picker dialog |
| Create `CopyToDateDialog` component | Simple dialog with date selector |

---

## Files to Create

### `src/components/mealplan/CopyToDateDialog.tsx`

A simple dialog that:
- Shows the source date at the top
- Lists available dates in the current week as clickable buttons (excluding the source date)
- Confirms the copy action
- Shows warning if target already has items (will add to existing, not replace)

```text
┌────────────────────────────────────────┐
│ Copy Meals From                   [X]  │
│ Monday 10 Feb                          │
├────────────────────────────────────────┤
│ Select destination:                    │
│                                        │
│  ○ Sun 9 Feb                           │
│  ● Tue 11 Feb                          │
│  ○ Wed 12 Feb   ⚠️ Has 4 items         │
│  ○ Thu 13 Feb                          │
│  ○ Fri 14 Feb                          │
│  ...                                   │
├────────────────────────────────────────┤
│          [Cancel]   [Copy Meals]       │
└────────────────────────────────────────┘
```

---

## Files to Modify

### 1. `src/hooks/useMealPlanItems.ts`

Add two new mutations:

**`copyDayToPrevious`** - Similar to `copyDayToNext` but targets `weekDates[sourceIndex - 1]`

**`copyDayToDate`** - Accepts `sourcePlanId`, `sourcePlanDate`, and `targetDate` parameters:
- Validates target date is in the current week
- Finds target plan by date
- Copies items with seasoning clamping
- Does not clear existing items (additive copy)

```typescript
// Copy to previous day
const copyDayToPrevious = useMutation({
  mutationFn: async ({ sourcePlanId, sourcePlanDate }) => {
    // Similar logic to copyDayToNext but uses sourceIndex - 1
  }
});

// Copy to any date in the week
const copyDayToDate = useMutation({
  mutationFn: async ({ sourcePlanId, sourcePlanDate, targetDate }) => {
    // Find source plan
    // Find target plan by targetDate
    // Copy items with seasoning clamping
  }
});
```

Add to return object:
```typescript
return {
  // ... existing
  copyDayToPrevious,
  copyDayToDate,
};
```

### 2. `src/components/mealplan/MealDayCard.tsx`

**New imports:**
- Import `CopyToDateDialog`
- Add state for `copyToDateOpen`

**New handlers:**
```typescript
const handleCopyToPreviousDay = () => {
  copyDayToPrevious.mutate({ sourcePlanId: plan.id, sourcePlanDate: plan.meal_date });
};

const handleCopyToDate = (targetDate: string) => {
  copyDayToDate.mutate({ 
    sourcePlanId: plan.id, 
    sourcePlanDate: plan.meal_date, 
    targetDate 
  });
  setCopyToDateOpen(false);
};
```

**Updated dropdown menu:**
```tsx
<DropdownMenuContent align="end">
  <DropdownMenuItem onClick={handleCopyToNextDay} disabled={isLastDayOfWeek || ...}>
    <Copy className="h-4 w-4 mr-2" />
    Copy to Next Day
  </DropdownMenuItem>
  <DropdownMenuItem onClick={handleCopyToPreviousDay} disabled={isFirstDayOfWeek || ...}>
    <Copy className="h-4 w-4 mr-2" />
    Copy to Previous Day
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => setCopyToDateOpen(true)} disabled={items.length === 0}>
    <CalendarDays className="h-4 w-4 mr-2" />
    Copy to Date...
  </DropdownMenuItem>
  <DropdownMenuSeparator />
  <DropdownMenuItem onClick={handleClearDay} className="text-destructive">
    ...
  </DropdownMenuItem>
</DropdownMenuContent>
```

**Add dialog at bottom:**
```tsx
<CopyToDateDialog
  open={copyToDateOpen}
  onOpenChange={setCopyToDateOpen}
  sourcePlan={plan}
  weekDates={weekDates}
  mealPlans={mealPlans}
  onConfirm={handleCopyToDate}
  isPending={copyDayToDate.isPending}
/>
```

**Pass mealPlans to component:**
The parent `WeeklyMealPlanner` already passes `weekDates`. We need to also pass `mealPlans` so the dialog can show which dates have existing items.

### 3. `src/components/mealplan/WeeklyMealPlanner.tsx`

Pass `mealPlans` to `MealDayCard`:
```tsx
<MealDayCard
  plan={plan}
  mealPlans={mealPlans}  // NEW
  // ... rest
/>
```

---

## Technical Details

### Copy Logic (Seasoning Clamping)
Reuse the existing seasoning clamping logic from `copyDayToNext`:
```typescript
const isSeasoning = item.product && shouldCapAsSeasoning(
  item.product.food_type,
  item.product.name,
  item.product.food_type
);
if (isSeasoning && quantity > DEFAULT_SEASONING_MAX_GRAMS) {
  quantity = DEFAULT_SEASONING_MAX_GRAMS;
}
```

### First Day Detection
Add check for first day similar to last day:
```typescript
const isFirstDayOfWeek = weekDates 
  ? plan.meal_date === weekDates[0] 
  : date.getDay() === 0; // Sunday
```

### Target Date Validation
In `copyDayToDate`, validate that:
- `targetDate` is in `weekDates` array
- `targetDate !== sourcePlanDate`
- Target plan exists

---

## User Experience

1. **Quick Copy Actions**: "Copy to Next Day" and "Copy to Previous Day" are one-click actions in the dropdown.

2. **Flexible Copy**: "Copy to Date..." opens a dialog where the user can pick any day in the current shopping week.

3. **Visual Feedback**: 
   - Dates with existing items show a warning indicator
   - Toast confirms "Copied X items to [date]"

4. **Additive Behavior**: Copying adds items to the target day; it does not replace. Users can "Reset Day" first if they want to replace.

---

## Implementation Order

1. Add `copyDayToPrevious` and `copyDayToDate` mutations to `useMealPlanItems.ts`
2. Create `CopyToDateDialog.tsx` component
3. Update `MealDayCard.tsx` to add menu items and dialog
4. Update `WeeklyMealPlanner.tsx` to pass `mealPlans` prop
5. Test the feature end-to-end

