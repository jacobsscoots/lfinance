# Toiletries Module – Enhanced Usage Tracking System (Revised & Locked)

## Overview

Extend the existing toiletries system with **weight-based usage tracking**, **automatic usage rate calculation**, **reorder forecasting**, **transaction/receipt linking**, and **loyalty discount calculations**.

This implementation is **strictly additive** and **must not modify** existing balances, transactions, forecasts, or other modules.

---

## Documented Assumptions (Locked)

| Area | Assumption | Rationale |
|------|------------|-----------|
| Active products | Each toiletry has one active instance at a time | Prevents overlapping usage data |
| Weight tracking | Grams used for all scale readings | Matches kitchen scales |
| Usage rate | Calculated from weight deltas over time | More accurate than date-only tracking |
| Reorder threshold | Default = 14 days remaining | Matches existing stock logic |
| Purchase linking | Many-to-many | One shop can include multiple items |
| Discounts | Rounded up before discount | Matches Tesco & EasySaver rules |
| Delivery data | Manually entered (v1) | Auto-import deferred |
| Safety | Additive only | No balance or transaction mutation |

---

## Database Changes

### Extend `toiletry_items`

```sql
ALTER TABLE toiletry_items
ADD COLUMN IF NOT EXISTS opened_at date,
ADD COLUMN IF NOT EXISTS finished_at date,
ADD COLUMN IF NOT EXISTS empty_weight_grams numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS full_weight_grams numeric,
ADD COLUMN IF NOT EXISTS current_weight_grams numeric,
ADD COLUMN IF NOT EXISTS calculated_usage_rate numeric,
ADD COLUMN IF NOT EXISTS last_weighed_at timestamptz;
Core Rules (Data Integrity – IMPORTANT)
full_weight_grams can only be set once per active item

empty_weight_grams can only be logged after full

Logging empty:

Sets finished_at

Locks further weight logs

Usage rate is calculated using:

Previous weigh-in → current weigh-in

Falls back to opened_at → now only if no prior reading exists

Weight-Based Usage Logic
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
Fallback logic:

If no previous reading → use full weight vs current

If no weight data → use manual rate

Discount Calculations (Explicit & Intentional)
Important:
Discount is calculated on the rounded price, but subtracted from the original price.
This matches Tesco Benefits on Tap & EasySaver behaviour and is intentional.

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
Forecast Logic
remaining = current_weight_grams - empty_weight_grams
daysRemaining = remaining / effectiveUsageRate
Reorder alert triggers when daysRemaining <= threshold.

Safety Guarantees
No balances modified

No transactions edited

Linking only via junction tables

Weight data optional

Manual rates still supported

Existing items unaffected

Implementation Order
Database migrations

Weight logging UI + rules

Usage rate calculations

Purchase & receipt linking

Orders + delivery tracking

Summary & savings insights

Summary
This system:

Uses real-world weighing

Prevents corrupted usage data

Accurately forecasts reorders

Tracks real spend vs forecast

Applies loyalty discounts correctly

Does not risk existing logic

Proceed with implementation exactly as defined above.