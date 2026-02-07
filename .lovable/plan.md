
# Toiletries & Consumables Tracking System

## Overview

This plan creates a dedicated Toiletries section that replaces your Excel workbook entirely. The system will track inventory, monitor usage, forecast run-out dates, and calculate costs - all updating in real-time as you make changes.

---

## What You'll Get

### Main Features
- **Inventory Table**: A comprehensive view of all your toiletries with inline-editable fields
- **Live Forecasting**: Automatic calculation of days remaining and run-out dates based on usage rates
- **Cost Tracking**: Monthly and yearly spend projections, both per-item and by category
- **Smart Status Indicators**: Visual badges showing "In Use", "Low", "Empty", and "Out of Stock"
- **Category Filtering**: Group items by Body, Hair, Oral, Household, etc.
- **Summary Dashboard**: Total spend breakdowns and items needing attention

### Key Behaviours (Matching Your Excel)
- Quantities always round **up** for purchases (never down)
- Partial usage supported (not just "full or empty")
- All forecasts update instantly when you change usage rates or remaining amounts
- No auto-deletion of items - discontinued items remain visible

---

## User Interface Design

### Navigation
A new "Toiletries" link will be added to the sidebar navigation between "Groceries" and "Meal Plan".

### Page Layout

```text
+----------------------------------------------------------+
|  Toiletries                                    [+ Add Item] |
|  Track and forecast your consumables                       |
+----------------------------------------------------------+
|                                                            |
|  +------------------+  +------------------+  +-----------+ |
|  | Monthly Spend    |  | Yearly Spend     |  | Low Stock | |
|  | £42.50           |  | £510.00          |  | 3 items   | |
|  +------------------+  +------------------+  +-----------+ |
|                                                            |
|  [All] [Body] [Hair] [Oral] [Household] [Cleaning]         |
|                                                            |
|  +------------------------------------------------------+  |
|  | Item          | Size  | Remaining | Days  | Run-out  |  |
|  |               |       |           | Left  | Date     |  |
|  +------------------------------------------------------+  |
|  | Shampoo       | 500ml | 250ml     | 25    | Mar 4    |  |
|  | [Body]        | £6.50 | 50%       |       |          |  |
|  +------------------------------------------------------+  |
|  | Toothpaste    | 100ml | 15ml      | 5     | Feb 12   |  |
|  | [Oral] [LOW]  | £2.00 |           |       |          |  |
|  +------------------------------------------------------+  |
+----------------------------------------------------------+
```

### Status Indicators
- **In Use** (green): Active item with adequate stock
- **Low** (amber): Less than 14 days of supply remaining  
- **Empty** (red): Item has run out, needs reorder
- **Out of Stock**: Temporarily unavailable (user-set)
- **Discontinued**: No longer purchasing (user-set)

### Add/Edit Item Form
A dialog form with fields for:
- Item name
- Category (dropdown)
- Total size (with unit: ml, g, or units)
- Cost per item
- Optional: Pack quantity (for multi-buy)
- Usage rate (amount per day)
- Current remaining amount
- Status

---

## Technical Implementation

### Database Schema

A new `toiletry_items` table will store all item data:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Owner (for RLS) |
| name | text | Item name |
| category | text | body, hair, oral, household, cleaning, other |
| total_size | numeric | Full container size |
| size_unit | text | ml, g, or units |
| cost_per_item | numeric | Price for one unit |
| pack_size | integer | Multi-buy quantity (default 1) |
| usage_rate_per_day | numeric | How much used daily |
| current_remaining | numeric | Current amount left |
| status | text | active, out_of_stock, discontinued |
| notes | text | Optional notes |
| last_restocked_at | timestamp | When last refilled |
| created_at | timestamp | Auto-set |
| updated_at | timestamp | Auto-updated |

Row-Level Security policies will ensure users can only access their own data.

### Calculation Logic

All forecasting is computed client-side for instant updates:

```text
Days Remaining = current_remaining / usage_rate_per_day

Run-out Date = today + Days Remaining

Monthly Cost = (usage_rate_per_day * 30 / total_size) * cost_per_item

Yearly Cost = Monthly Cost * 12

Purchase Quantity = CEILING(required_amount / pack_size)
```

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/Toiletries.tsx` | Main page component |
| `src/hooks/useToiletries.ts` | Data fetching and mutations |
| `src/lib/toiletryCalculations.ts` | Forecasting and cost calculations |
| `src/components/toiletries/ToiletryTable.tsx` | Main inventory table |
| `src/components/toiletries/ToiletryFormDialog.tsx` | Add/Edit item form |
| `src/components/toiletries/ToiletrySummaryCards.tsx` | Summary statistics |
| `src/components/toiletries/DeleteToiletryDialog.tsx` | Delete confirmation |
| Database migration | Create `toiletry_items` table with RLS |

### Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add /toiletries route |
| `src/components/layout/AppSidebar.tsx` | Add Toiletries nav link |
| `src/components/layout/MobileNav.tsx` | Add Toiletries to mobile nav |

---

## Data Integrity Rules

These rules will be enforced:
- No negative quantities (validation rejects values below 0)
- Explicit rounding display (show both "need 1.3" and "buy 2")
- No silent rounding (all calculations visible and explainable)
- Items are never auto-deleted (discontinued status instead)
- Usage rate changes trigger immediate forecast recalculation

---

## Implementation Phases

### Phase 1 (This Build)
- Database table with RLS
- Full CRUD for toiletry items
- Table view with all fields visible
- Forecasting calculations (days remaining, run-out date)
- Cost projections (monthly/yearly per item and totals)
- Status badges and category filtering
- Summary cards

### Phase 2 (Future)
- Usage history tracking (when items were restocked)
- Charts showing spend over time
- Low-stock reminders/notifications
- Automatic reorder suggestions
- Integration with shopping lists

---

## Validation & Input Rules

Using Zod schema validation:
- Name: Required, max 100 characters
- Total size: Required, must be positive number
- Cost: Required, must be non-negative
- Usage rate: Required, must be positive (prevents division by zero)
- Remaining: Must be between 0 and total_size
- Category: Must be one of predefined options

---

## Summary

This Toiletries section will fully replace your Excel by:

1. Automatically calculating days remaining and run-out dates
2. Projecting monthly and yearly costs without manual formulas
3. Showing clear visual indicators for items needing attention
4. Allowing quick edits without modal overload
5. Maintaining data integrity with proper validation
6. Being future-ready for automation and reminders

The design follows the existing patterns in your app (similar to Bills and Products), ensuring consistency and maintainability.
