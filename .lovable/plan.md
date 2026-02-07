
# Plan: Add Multi-Select and Transfer to Next Day for Meal Items

## Overview
Add two new features to the "Add to Meal" dialog:
1. **Multi-select products** - Allow users to select multiple products at once to add to a meal
2. **Transfer items to next day** - Copy all items from the current day to the next day

## What I Checked
- Bank connections security: **VERIFIED** - The `bank_connections_safe` view correctly excludes sensitive tokens (access_token, refresh_token, token_expires_at) and RLS policies are working
- Current MealItemDialog: Uses single-select dropdown, adds one product at a time
- useMealPlanItems hook: Already has `addItem` mutation for inserting meal plan items
- Popover and Command components are available for building a multi-select combobox

---

## Implementation Details

### 1. Create Multi-Select Product Dialog

**New component: `MealItemMultiSelectDialog.tsx`**

Replace the single-select dropdown with a multi-select combobox that:
- Uses Popover + Command components for searchable list
- Shows checkboxes next to each product
- Displays selected count in the trigger button
- Keeps dialog open after selecting (toggle behavior)
- Filters/sorts products by meal eligibility (allowed first, disallowed grayed out)
- Shows "Not for [Meal]" badge for ineligible items
- In target mode: adds all items with 0g (to be calculated via Generate)
- In manual mode: adds all items with default 100g

**UI flow:**
```text
+-------------------------------------------+
| Add to Dinner              [Auto badge]   |
+-------------------------------------------+
| Products                                  |
| [Select products...              v ]      |
| +---------------------------------------+ |
| | Search products...                    | |
| +---------------------------------------+ |
| | [x] Chicken Breast (114 kcal/100g)    | |
| | [x] Brown Rice (163 kcal/100g)        | |
| | [ ] Broccoli (34 kcal/100g)           | |
| | [ ] Greek Yogurt (99 kcal) Not for Din| |
| +---------------------------------------+ |
| Selected: 2 products                      |
|                                           |
| [Cancel]              [Add 2 Items (0g)]  |
+-------------------------------------------+
```

### 2. Add "Transfer to Next Day" Action

**Location:** MealDayCard dropdown menu (header area) 

Add a new menu option in the day card header:
- "Copy to Next Day" - copies all items from this day to the next day
- Shows confirmation count of items transferred
- Preserves meal types (breakfast items stay breakfast, etc.)

**New mutation in useMealPlanItems hook:**

```typescript
const copyDayToNext = useMutation({
  mutationFn: async (sourcePlanId: string) => {
    // 1. Find source plan and its items
    // 2. Find target plan (next day)
    // 3. Insert copies of all items to target plan
    // Return count of items copied
  }
});
```

### 3. Update MealDayCard Header

Add a dropdown menu to the day card header with:
- View Details (existing)
- Copy All to Next Day (new)
- Clear All Items (optional - for convenience)

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/mealplan/MealItemMultiSelectDialog.tsx` | **Create** | New multi-select dialog component |
| `src/components/mealplan/MealDayCard.tsx` | Modify | Add "Copy to Next Day" menu option |
| `src/hooks/useMealPlanItems.ts` | Modify | Add `addMultipleItems` and `copyDayToNext` mutations |
| `src/components/mealplan/MealItemDialog.tsx` | Modify | Update to import toggle for single/multi mode OR replace entirely with multi-select |

---

## Technical Approach

### Multi-Select Implementation
- Use `Popover` + `Command` + `Checkbox` for the selection UI
- Maintain `Set<string>` of selected product IDs
- On submit, loop through and call `addItem` for each (or batch insert)
- For better UX: batch insert with single mutation to avoid N network requests

### Copy to Next Day Implementation
- Get current plan's items
- Find next day's plan ID (weekDates[currentDayIndex + 1])
- If next day is in different week, handle appropriately (error or skip)
- Insert items with same product_id, meal_type, quantity_grams
- Do not copy locked status (let user choose)

---

## Considerations

1. **Batch vs Individual Inserts**: Use batch insert (single query) for better performance
2. **Week Boundary**: If Saturday, "next day" is Sunday which should be in same week - should work. But if the week ends, show a message that they can't copy to next week from this view
3. **Fixed Products**: Fixed-portion products use their preset grams even in multi-select
4. **Duplicate Prevention**: Optionally check if product already exists in meal before adding (or allow duplicates)

---

## Bank Connections Test Result

**Status: VERIFIED** 

- The `/accounts` route correctly redirects to login for unauthenticated users
- The `bank_connections_safe` view exists and excludes sensitive columns
- The `useBankConnections` hook correctly queries the safe view
- RLS policies are properly configured (authenticated users can only see their own connections via the view)
