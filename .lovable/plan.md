
# Mobile Optimization Plan

## Overview

This plan addresses mobile usability across the entire application, focusing on improving touch interactions, readability, and navigation patterns for smaller screens. The goal is to make the app feel native and intuitive on mobile devices while maintaining the existing desktop experience.

---

## Current State Analysis

### What's Already Working
- Basic responsive navigation (MobileNav with slide-out sheet)
- Tailwind responsive breakpoints in use (sm:, md:, lg:)
- Cards and grids adapt to screen sizes
- Most dialogs use `sm:max-w-[425px]` for proper mobile sizing

### Key Issues to Address

| Area | Problem | Impact |
|------|---------|--------|
| Tables | ToiletryTable uses desktop-focused data tables | Hard to read/interact on mobile |
| Calendar | 7-column grid too cramped on phones | Dates and bill pills unreadable |
| Transactions | Filter sidebar takes 300px on all screens | Filters compete with transaction list |
| Meal Planner | 7-day grid shows all days at once | Cards too narrow to be useful |
| Forms | Two-column form grids on mobile | Fields become cramped |
| Touch Targets | Action buttons use hover-only visibility | Can't access on touch devices |
| Page Headers | Button placement inconsistent on mobile | "Add" buttons sometimes get cut off |
| Bottom Navigation | No bottom nav option for quick switching | Extra taps to reach common actions |

---

## Implementation Plan

### 1. Mobile-First Table Component for Toiletries

Replace the complex table with a card-based mobile view:

**File: `src/components/toiletries/ToiletryTable.tsx`**

Changes:
- Use the `useIsMobile()` hook to detect screen size
- On mobile: render a stacked card layout instead of table rows
- Each card shows: item name, status badge, progress bar, days remaining
- Action menu (edit/delete/restock) always visible as an icon button
- On desktop: keep existing table layout

```text
Mobile Card Layout:
+----------------------------------+
| Shampoo                    [⋮]   |
| Body • 500ml • £6.50            |
| [████████░░░] 50% • 25 days     |
| [In Use]                         |
+----------------------------------+
```

### 2. Calendar Mobile Optimization

**File: `src/components/calendar/CalendarGrid.tsx`**

Changes:
- On mobile: reduce cell height from 100px to 70px
- Shorten weekday headers (M, T, W, T, F, S, S instead of Mon, Tue, etc.)
- Show maximum 2 bill pills per day (with "+N" indicator)
- Increase touch target for date cells
- Hide the "Run-out" column text, keep just the date

**File: `src/pages/Calendar.tsx`**

Changes:
- Stack the summary cards vertically on mobile (1 column instead of 3)
- Move the day detail panel above the calendar on mobile when a day is selected
- Make it a slide-up Drawer on mobile instead of a side panel

### 3. Transactions Page Mobile Layout

**File: `src/pages/Transactions.tsx`**

Changes:
- On mobile: replace sidebar layout with a collapsible filter section
- Filters collapse to a single "Filters" button that expands an accordion
- Move month navigation to a horizontal swipe-friendly row
- Full-width transaction list

**File: `src/components/transactions/TransactionFilters.tsx`**

Changes:
- Wrap in a Collapsible component on mobile
- Change from Card to a minimal expandable section
- Stack filter selects vertically (1 column)

**File: `src/components/transactions/TransactionList.tsx`**

Changes:
- Make the action dropdown always visible (remove `opacity-0 group-hover:opacity-100`)
- Ensure touch targets are at least 44x44px

### 4. Meal Planner Mobile View

**File: `src/components/mealplan/WeeklyMealPlanner.tsx`**

Changes:
- On mobile: show one day at a time with horizontal swipe navigation
- Add a day selector strip at the top (Mon | Tue | Wed | etc.)
- Current day highlighted, tap to switch
- "Copy Previous Week" button moves to a dropdown menu

**File: `src/components/mealplan/MealDayCard.tsx`**

Changes:
- On mobile: cards expand to full width
- Increase touch target size for "Add food" buttons
- Make dropdown menus larger for touch

### 5. Form Dialog Improvements

**Files affected:**
- `src/components/toiletries/ToiletryFormDialog.tsx`
- `src/components/bills/BillFormDialog.tsx`
- `src/components/transactions/TransactionFormDialog.tsx`
- `src/components/accounts/AccountFormDialog.tsx`

Changes for all forms:
- Use `Drawer` component on mobile instead of `Dialog`
- Create a responsive wrapper component that switches automatically
- Stack two-column grids into single columns on mobile
- Increase input heights for easier touch input
- Add proper keyboard handling (close on escape, focus management)

### 6. Touch-Friendly Action Buttons

**Pattern to apply across all pages:**

Current problem:
```tsx
<Button className="opacity-0 group-hover:opacity-100">
```

Fix:
```tsx
<Button className="sm:opacity-0 sm:group-hover:opacity-100">
```

Files to update:
- `src/components/transactions/TransactionList.tsx`
- `src/components/toiletries/ToiletryTable.tsx`
- `src/components/mealplan/MealDayCard.tsx`

### 7. Page Header Consistency

**All page files** (Dashboard, Accounts, Bills, Transactions, Calendar, etc.)

Changes:
- Ensure "flex-wrap gap-4" on all header rows
- On mobile: stack title and action button vertically
- Use `flex-col sm:flex-row` pattern consistently

Example:
```tsx
<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h1>Page Title</h1>
    <p>Description</p>
  </div>
  <Button>Add Item</Button>
</div>
```

### 8. Settings Page Tabs

**File: `src/pages/Settings.tsx`**

Changes:
- On mobile: change tabs to a scrollable horizontal list
- Or: convert to a vertical accordion layout
- Current `grid-cols-5` doesn't work well on narrow screens

### 9. Responsive Dialog/Drawer Wrapper

**New file: `src/components/ui/responsive-dialog.tsx`**

Create a component that:
- Renders as a `Dialog` on desktop (md: and up)
- Renders as a `Drawer` on mobile
- Accepts same props as Dialog
- Automatically handles the switch

This reduces repeated code across all form dialogs.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/ui/responsive-dialog.tsx` | Dialog on desktop, Drawer on mobile |
| `src/components/toiletries/ToiletryCard.tsx` | Mobile card view for toiletry items |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/toiletries/ToiletryTable.tsx` | Add mobile card view toggle |
| `src/components/calendar/CalendarGrid.tsx` | Compact mobile layout |
| `src/pages/Calendar.tsx` | Stack summary cards, drawer for day details |
| `src/pages/Transactions.tsx` | Collapsible filters, full-width list |
| `src/components/transactions/TransactionFilters.tsx` | Mobile-first layout |
| `src/components/transactions/TransactionList.tsx` | Visible action buttons on mobile |
| `src/components/mealplan/WeeklyMealPlanner.tsx` | Single-day mobile view |
| `src/components/mealplan/MealDayCard.tsx` | Larger touch targets |
| `src/pages/Settings.tsx` | Scrollable or accordion tabs |
| `src/pages/Bills.tsx` | Consistent header layout |
| `src/pages/Accounts.tsx` | Already good, minor tweaks |
| `src/pages/Toiletries.tsx` | Already good, uses improved table |
| `src/components/toiletries/ToiletryFormDialog.tsx` | Use responsive dialog |
| `src/components/bills/BillFormDialog.tsx` | Use responsive dialog |
| `src/components/accounts/AccountFormDialog.tsx` | Use responsive dialog |

---

## Technical Approach

### Detection Method
Use the existing `useIsMobile()` hook from `src/hooks/use-mobile.tsx` which checks for `max-width: 767px`.

### Component Pattern
```tsx
const isMobile = useIsMobile();

if (isMobile) {
  return <MobileView />;
}

return <DesktopView />;
```

### Drawer for Mobile Dialogs
The project already has the Drawer component from vaul. We'll create a wrapper that automatically chooses between Dialog and Drawer based on screen size.

---

## Priority Order

1. **Responsive Dialog wrapper** - Foundation for all form improvements
2. **ToiletryTable mobile cards** - Most recently added, users testing now
3. **Transaction page filters** - High-frequency page
4. **Calendar compact view** - Complex but important for daily use
5. **Meal planner single-day view** - Complex, lower priority
6. **Settings tabs** - Lower frequency, simpler fix
7. **Touch target fixes** - Quick wins across all pages

---

## Expected Outcome

After these changes:
- All tables display as readable cards on mobile
- Forms open as bottom drawers that feel native
- Action buttons are always visible and tappable
- Filters don't compete for screen space
- Calendar is usable on phone screens
- Meal planning works one day at a time on mobile
- Consistent look and feel across all pages
