

# Plan: Fix UI Layout Issues & Mobile Optimization

## Issues Identified

### 1. NutritionImportDialog Layout Issues
From the screenshot you provided:
- The "X" close button is positioned too close to the dialog title/Import button
- The extracted data fields (Product Name, Brand, Image, Price, Pack Size) need better spacing and truncation for long URLs

**Current Problems in `src/components/settings/NutritionImportDialog.tsx`:**
- DialogHeader doesn't have enough right padding for the close button
- Image URL field shows full URL that overflows (needs truncation)
- Field cards could have better mobile spacing

### 2. Dialogs Not Using ResponsiveDialog (Mobile Optimization)
Several dialogs use the standard `Dialog` component instead of `ResponsiveDialog`, meaning they don't convert to bottom drawers on mobile:

| Dialog | Current | Should Be |
|--------|---------|-----------|
| NutritionImportDialog | Dialog | ResponsiveDialog |
| TransactionFormDialog | Dialog | ResponsiveDialog |
| MealItemDialog | Dialog | ResponsiveDialog |
| PriceComparisonDialog | Dialog | ResponsiveDialog |

### 3. Close Button Positioning
The standard Dialog close button uses `right-4 top-4` positioning which can conflict with header content. Need to add `pr-8` (right padding) to DialogHeader/DialogTitle to prevent overlap.

---

## Implementation Plan

### Step 1: Fix NutritionImportDialog Header Spacing
**File:** `src/components/settings/NutritionImportDialog.tsx`

- Add right padding to DialogHeader to prevent overlap with close button
- Truncate long Image URLs with `max-w-[200px]` and ellipsis
- Convert to ResponsiveDialog for mobile drawer experience

### Step 2: Fix Extracted Data Field Layout
**File:** `src/components/settings/NutritionImportDialog.tsx`

- Add proper truncation for long text values (especially URLs)
- Improve mobile spacing on field cards
- Ensure checkboxes are properly aligned

### Step 3: Convert TransactionFormDialog to ResponsiveDialog
**File:** `src/components/transactions/TransactionFormDialog.tsx`

- Replace Dialog imports with ResponsiveDialog
- Update component usage for mobile drawer support

### Step 4: Convert MealItemDialog to ResponsiveDialog
**File:** `src/components/mealplan/MealItemDialog.tsx`

- Replace Dialog imports with ResponsiveDialog
- Ensure proper drawer behavior on mobile

### Step 5: Convert PriceComparisonDialog to ResponsiveDialog  
**File:** `src/components/toiletries/PriceComparisonDialog.tsx`

- Replace Dialog with ResponsiveDialog
- Optimize table layout for mobile (may need card layout on small screens)

---

## Technical Details

### DialogHeader Padding Fix
```tsx
// Add pr-8 to prevent close button overlap
<DialogHeader className="pr-8">
  <DialogTitle>Import Nutrition Data</DialogTitle>
</DialogHeader>
```

### URL Truncation for Extracted Fields
```tsx
<p className="text-sm text-muted-foreground truncate max-w-[250px]">
  {formatValue(key, value)}
</p>
```

### ResponsiveDialog Conversion Pattern
```tsx
// Before
import { Dialog, DialogContent, ... } from "@/components/ui/dialog";

// After  
import { 
  ResponsiveDialog, 
  ResponsiveDialogContent, 
  ... 
} from "@/components/ui/responsive-dialog";
```

---

## Files to Modify

1. `src/components/settings/NutritionImportDialog.tsx` - Fix header spacing, URL truncation, convert to ResponsiveDialog
2. `src/components/transactions/TransactionFormDialog.tsx` - Convert to ResponsiveDialog
3. `src/components/mealplan/MealItemDialog.tsx` - Convert to ResponsiveDialog
4. `src/components/toiletries/PriceComparisonDialog.tsx` - Convert to ResponsiveDialog

---

## Testing Checklist

After implementation:
- [ ] Open NutritionImportDialog - verify X button is not overlapping
- [ ] Import a product from URL - verify extracted fields display properly
- [ ] Test on mobile viewport - dialogs should appear as bottom drawers
- [ ] Test all pages on mobile (Dashboard, Accounts, Transactions, Bills, Calendar, Groceries, Meal Plan, Toiletries, Settings)
- [ ] Verify dropdowns have proper backgrounds and z-index

