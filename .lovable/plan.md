# Toiletries Module – Enhanced Usage Tracking System (IMPLEMENTED)

## Overview

Extended the existing toiletries system with **weight-based usage tracking**, **automatic usage rate calculation**, **reorder forecasting**, **transaction/receipt linking**, and **loyalty discount calculations**.

This implementation is **strictly additive** and **does not modify** existing balances, transactions, forecasts, or other modules.

---

## Implementation Status: ✅ Complete

### Database Changes ✅
- Extended `toiletry_items` table with weight tracking columns:
  - `opened_at`, `finished_at`, `empty_weight_grams`, `full_weight_grams`
  - `current_weight_grams`, `calculated_usage_rate`, `last_weighed_at`
- Created `toiletry_purchases` junction table for transaction linking
- Created `toiletry_orders` table for online order tracking
- All tables have proper RLS policies

### Weight-Based Usage Logic ✅
```typescript
function calculateUsageRate(
  previousWeight: number,
  currentWeight: number,
  daysBetween: number
): number | null {
  if (daysBetween <= 0) return null;
  const used = previousWeight - currentWeight;
  if (used <= 0) return null;
  return used / daysBetween;
}
```

### Core Rules (Data Integrity) ✅
- `full_weight_grams` can only be set once per active item
- `empty_weight_grams` can only be logged after full is set
- Logging empty sets `finished_at` and locks further weight logs

### Discount Calculations ✅
```typescript
export function calculateLoyaltyDiscount(price: number, type: DiscountType) {
  const rates = { tesco_benefits: 0.04, easysaver: 0.07, clubcard: 0, none: 0 };
  const rounded = Math.ceil(price);
  const discount = rounded * (rates[type] ?? 0);
  return {
    originalPrice: price,
    roundedPrice: rounded,
    discountAmount: discount,
    finalPrice: Math.max(0, price - discount),
  };
}
```

### UI Components ✅
- **Items Tab**: Main table with Log Weight and Link Purchase actions
- **Orders Tab**: Online order tracking with delivery status
- **Summary Tab**: Forecasted vs actual spend, category breakdown, reorder alerts

### Files Created
- `src/lib/toiletryUsageCalculations.ts` - Weight and discount calculations
- `src/hooks/useToiletryPurchases.ts` - Purchase CRUD hook
- `src/hooks/useToiletryOrders.ts` - Orders CRUD hook
- `src/components/toiletries/LogWeightDialog.tsx` - Weight entry modal
- `src/components/toiletries/LinkPurchaseDialog.tsx` - Transaction linking modal
- `src/components/toiletries/OrderFormDialog.tsx` - Order entry modal
- `src/components/toiletries/OrdersTab.tsx` - Orders tab component
- `src/components/toiletries/ToiletrySummaryTab.tsx` - Summary tab component

### Files Modified
- `src/lib/toiletryCalculations.ts` - Extended ToiletryItem interface, weight-aware forecasting
- `src/hooks/useToiletries.ts` - Added logWeight mutation
- `src/components/toiletries/ToiletryTable.tsx` - Added weight and purchase actions
- `src/pages/Toiletries.tsx` - Integrated tabs and all new dialogs

---

## Safety Guarantees ✅
- No balances modified
- No transactions edited
- Linking only via junction tables
- Weight data optional
- Manual rates still supported
- Existing items unaffected
