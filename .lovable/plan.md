Groceries Module Extension: Shop-Ready Grocery List (Additive, Safe)
Overview

Extend the existing Groceries module so that once meal planning is complete, the app produces a shop-ready grocery list that:

Subtracts stock on hand (using existing inventory fields) from required quantities

Groups items by retailer for efficient shopping

Applies Tesco Benefits on Tap (4%) and EasySaver (7%) discounts using the existing rounding rules

Allows transaction + receipt linking for accurate spend tracking (without changing transaction amounts)

Supports online order tracking (delivery price/times, dispatch, delivery status)

Calculates actual vs forecasted monthly grocery spend + savings

All changes are strictly additive and must not modify existing meal planning, macros, or transaction sync logic.

Questions (Answer in code comments if not configurable in UI yet)

Can the same product be bought from multiple retailers?

If yes, retailer cannot be a single products.retailer value long-term. (v1 can still store a default retailer on product, but allow overriding per shop list.)

When stock tracking is on, do we treat quantity_in_use as available stock or not available?

Discount rounding rules: confirm exact rule:

Option A: round total basket cost up to nearest £1, compute discount, subtract from original total

Option B: round each item line up to nearest £1, compute discount per line, sum discounts
(These can differ a lot.)

When linking a supermarket transaction to multiple groceries, do we want:

Allocate by line item costs (recommended), or

A simple manual “split amount” input?

If answers are unknown, implement safe defaults:

retailer defaults from product but can be overridden per shop list line

quantity_in_use counts as stock

apply discount at basket level (per retailer group)

allocation is manual split first (v1), with optional proportional allocation

Current State
Existing product inventory fields (already present)

quantity_on_hand

quantity_in_use

reorder_threshold

target_quantity

packaging_weight_grams

gross_pack_size_grams (total pack with packaging)

Existing grocery list generation

generateGroceryList() in mealCalculations.ts:

aggregates required grams

rounds to pack sizes

calculates costs

does not subtract stock

does not group by retailer

does not link purchases

Important safety rule: keep generateGroceryList() unchanged. New logic wraps it.

Documented Assumptions (v1)
Area	Assumption	Why
Stock subtraction	Uses product inventory fields; null means 0	Avoids breaking existing items
Net usable grams	netPackGrams = max(0, pack_size_grams - packaging_weight_grams)	Prevent negative pack sizes
In-use packs	Treat quantity_in_use as stock (counts toward available grams)	Matches “opened packs still usable”
Retailer grouping	v1 uses products.retailer as default but shop list can override per item	Avoids long-term limitation
Discounts	Reuse shared discount helper; apply at retailer basket level by default	Matches your “rounded basket” style
Purchase linking	Many-to-many via junction table	One shop = many items
Online orders	Mirrors toiletries orders model	Consistent UI/UX
Safety	No changes to macros, meal plans, transaction sync	Prevent regressions
Database Changes
1) Products: add default retailer + default discount (optional but helpful)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS retailer text,
ADD COLUMN IF NOT EXISTS default_discount_type text
  CHECK (default_discount_type IN ('none','tesco_benefits','easysaver','clubcard','other'));


Retailer dropdown values:

Tesco, Sainsbury's, ASDA, Morrisons, Aldi, Lidl, Iceland, MyProtein, Amazon, Other

2) Create grocery_orders (online orders)
CREATE TABLE IF NOT EXISTS public.grocery_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  order_date date NOT NULL,
  retailer text NOT NULL,
  order_reference text,

  subtotal numeric(10,2) NOT NULL,
  delivery_cost numeric(10,2) DEFAULT 0,
  total_amount numeric(10,2) NOT NULL,

  dispatch_date date,
  estimated_delivery date,
  actual_delivery date,

  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grocery_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own grocery orders"
  ON public.grocery_orders FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS grocery_orders_user_id_idx ON public.grocery_orders(user_id);
CREATE INDEX IF NOT EXISTS grocery_orders_transaction_id_idx ON public.grocery_orders(transaction_id);

3) Create grocery_purchases junction table (transactions ↔ products)
CREATE TABLE IF NOT EXISTS public.grocery_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  order_id uuid REFERENCES grocery_orders(id) ON DELETE SET NULL,

  purchase_date date NOT NULL,

  -- Quantity can be "packs" (integer) for v1
  quantity integer NOT NULL DEFAULT 1,

  -- Pricing fields are optional when allocating a big supermarket shop
  unit_price numeric(10,2),
  gross_cost numeric(10,2),
  discount_type text CHECK (discount_type IN ('none','tesco_benefits','easysaver','clubcard','other')),
  discount_amount numeric(10,2) DEFAULT 0,
  final_cost numeric(10,2),

  -- For correct stock updates:
  grams_purchased numeric, -- optional grams purchased if not 1:1 with packs

  -- Store retailer actually used (can override product default)
  retailer text,

  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grocery_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own grocery purchases"
  ON public.grocery_purchases FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS grocery_purchases_user_id_idx ON public.grocery_purchases(user_id);
CREATE INDEX IF NOT EXISTS grocery_purchases_transaction_id_idx ON public.grocery_purchases(transaction_id);
CREATE INDEX IF NOT EXISTS grocery_purchases_product_id_idx ON public.grocery_purchases(product_id);
CREATE INDEX IF NOT EXISTS grocery_purchases_order_id_idx ON public.grocery_purchases(order_id);


Why this change?
Supermarket receipts are often “one transaction covers many items”. If we force unit_price * quantity everywhere we’ll end up with totals that don’t match the transaction.

Shared Discount Utility (must-do)

If calculateLoyaltyDiscount() currently lives inside toiletries, move it to a shared file:

src/lib/discounts.ts (NEW)

Toiletries + groceries both import from here

Discount rule (explicit)

Implement both modes but default to basket-level:

Basket-level: sum retailer subtotal → apply rounding + discount once

Line-level: apply per line item then sum (optional later)

Core Logic: Shop-Ready List Generation
Key edge cases to handle

pack_size_grams or packaging_weight_grams missing → treat net pack grams as pack_size_grams or fallback to required grams

net pack grams <= 0 → fallback to pack_size_grams or 1 pack

stock subtraction should count:

(quantity_on_hand + quantity_in_use) * netPackGrams (default)

if required grams already covered → put item into “Already in stock”

retailer can be overridden at list time

New file: src/lib/groceryListCalculations.ts
export interface ShopReadyItem {
  product: Product;
  retailer: string;

  requiredGrams: number;
  stockOnHandGrams: number;
  netNeededGrams: number;

  purchasePacks: number;     // integer packs to buy
  packNetGrams: number;      // derived net grams per pack

  grossCost: number;         // pre-discount (packs * price)
  discountType: DiscountType;
  discountAmount: number;
  finalCost: number;
}

export interface ShopReadyList {
  byRetailer: Map<string, ShopReadyItem[]>;
  alreadyCovered: ShopReadyItem[];
  totals: {
    grossCost: number;
    totalDiscount: number;
    finalCost: number;
    itemCount: number;
  };
}


Important: do not modify mealCalculations.ts existing grocery generator. Instead:

call existing generateGroceryList(...) (unchanged)

wrap into generateShopReadyList(...)

UI: Groceries Page
Tabs

Shop List

Orders

Summary

Shop List tab

Week selector synced to meal planning

Grouped by retailer (collapsible sections)

Per retailer:

Subtotal

discount type selector (none / Tesco / EasySaver)

final total

Items show:

required grams

stock grams

packs to buy

price

“Already in stock” section

Purchase linking

“Link supermarket transaction” flow:

pick transaction (Tesco £X)

select which items were bought

choose allocation method:

manual per line (v1)

proportional by gross cost (optional)

saves rows to grocery_purchases without changing transactions

Stock update (optional)

After confirming purchases, update stock:

increment quantity_on_hand or set quantity_in_use based on your existing inventory rules

This should be a separate explicit action (button), not automatic, to avoid mistakes.

Online Orders

Mirror toiletries:

grocery_orders CRUD

grocery_purchases can reference order_id

Delivery cost + dates tracked

Link to transaction if available

Monthly Spend Analytics

Two numbers (keep them separate, don’t mix):

Actual monthly average (from grocery_purchases + grocery_orders totals)

Forecast monthly (from shop list totals)

Notes:

If the “shop list” is weekly, weekly * 4.33 is fine but label it as an estimate.

Actual should be computed from real purchases.

Files to Create
File	Purpose
src/lib/groceryListCalculations.ts	Shop-ready list generation with stock subtraction + grouping
src/lib/discounts.ts	Shared discount utility (used by groceries + toiletries)
src/hooks/useGroceryPurchases.ts	CRUD for grocery_purchases
src/hooks/useGroceryOrders.ts	CRUD for grocery_orders
src/components/groceries/ShopReadyList.tsx	Shop list grouped by retailer
src/components/groceries/RetailerSection.tsx	Collapsible retailer UI
src/components/groceries/LinkGroceryPurchaseDialog.tsx	Link transaction + allocate line items
src/components/groceries/GroceryOrdersTab.tsx	Online orders
src/components/groceries/GroceryOrderFormDialog.tsx	Order entry/edit
src/components/groceries/GrocerySummaryTab.tsx	Actual vs forecast spend + savings
Files to Modify
File	Changes
src/pages/Groceries.tsx	Rebuild with tabs
src/hooks/useProducts.ts	Add retailer + default_discount_type
src/components/settings/ProductSettings.tsx	Add retailer + default discount fields
src/lib/mealCalculations.ts	No behaviour changes; only export types if needed
Safety Guarantees (explicit)

No meal plan changes: existing generateGroceryList() is untouched

No macro changes: nutrition logic untouched

No transaction changes: we only link via junction tables

No balance changes: purchases are read-only analytics unless user manually updates stock

Additive schema: only adds columns/tables; no breaking migrations

Implementation Order

DB migrations

add retailer/default_discount_type to products

create grocery_orders, grocery_purchases + RLS + indexes

Shared discounts

create src/lib/discounts.ts

update toiletries to import shared helper (no behaviour change)

Core calculations

create groceryListCalculations.ts

Shop list UI

grouped retailer sections + already-covered bucket

Purchase linking

link transaction → allocate lines → save grocery_purchases

Orders tab

Summary analytics

Acceptance Checks

Shop list correctly subtracts stock (including quantity_in_use by default)

Discount totals match your rounding rule with test examples

Linking a transaction never changes the original transaction

Actual vs forecasted spend shows reasonable numbers and doesn’t double-count

No changes to meal plan macros or the portioning system