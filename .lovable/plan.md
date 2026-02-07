
# Plan: Speed Up URL Extraction & Add Price Comparison Feature

## Part 1: Speed Up URL Extraction

### Current Situation
The extraction from Tesco/other websites is slow because:
1. Firecrawl makes multiple retry attempts (up to 3 attempts with 8-12 second waits each)
2. The edge function truncates 60,000 characters of HTML/markdown before sending to AI
3. The AI model (`google/gemini-3-flash-preview`) then processes this large content

### Optimization Strategy

**1. Reduce Firecrawl Wait Times**
- Lower `waitFor` from 8000ms to 3000ms on first attempt
- Reduce timeout from 45000ms to 25000ms
- Only increase wait time on retry if first attempt seems blocked

**2. Request Only Needed Formats**
- Currently requests `["markdown", "html", "rawHtml"]` (3 formats)
- Change to `["markdown"]` only - it's cleaner and sufficient for AI extraction
- Fall back to HTML only if markdown fails

**3. Reduce Content Size for AI**
- Reduce truncation from 60,000 to 25,000 characters
- Product data is typically in the first portion of the page

**4. Use Faster AI Model**
- Switch from `google/gemini-3-flash-preview` to `google/gemini-2.5-flash-lite` for URL extraction
- This model is optimized for speed and works well for structured extraction tasks

**Expected Speed Improvement**: From ~15-20 seconds down to ~5-8 seconds

---

## Part 2: Price Comparison Feature for Toiletries

### Feature Overview
Add a "Find Best Price" button to toiletry items that:
1. Searches multiple retailers for the product
2. Compares prices including delivery times
3. Factors delivery time into run-out date calculations
4. Shows the best option considering both price and timing

### Implementation Details

**New Database Table: `toiletry_price_checks`**
```sql
CREATE TABLE toiletry_price_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  toiletry_item_id uuid REFERENCES toiletry_items(id) ON DELETE CASCADE,
  retailer text NOT NULL,
  price numeric(10,2) NOT NULL,
  product_url text,
  dispatch_days integer,      -- Days to dispatch
  delivery_days integer,      -- Days after dispatch
  total_lead_time integer,    -- dispatch_days + delivery_days
  in_stock boolean DEFAULT true,
  checked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
```

**New Edge Function: `search-toiletry-prices`**
- Takes product name, brand, and size
- Uses Firecrawl search to find product across multiple retailers
- Extracts price, stock status, and delivery info from each result
- Uses Perplexity connector (if available) for faster search results
- Returns sorted results by effective price + urgency factor

**UI Changes**

1. **ToiletryTable.tsx**: Add "Find Prices" action in dropdown menu

2. **New Component: `PriceComparisonDialog.tsx`**
   - Shows loading state while searching
   - Displays results in a table with:
     - Retailer name/logo
     - Price (with offer price if available)
     - Delivery estimate (e.g., "2-3 days")
     - "Order by" date (if item runs out on X, you need to order by Y)
     - Link to product page

3. **Enhanced Forecast Logic**
   - `calculateForecast()` updated to show "Order by" date
   - Order by date = Run out date - Lead time - Buffer (2 days)
   - Visual warning if order-by date is today or past

**Retailer Coverage**
- Boots, Superdrug, Savers (UK health/beauty)
- Amazon UK
- Tesco, Sainsbury's, ASDA (supermarkets)
- eBay UK (for best prices)

### Integration with Run-Out Calculations

The price comparison will feed into the existing forecast:
```
Days until run-out: 14 days
Best price: £4.99 at Amazon (3-day delivery)
Order by: 11 Feb (3 days from now)
```

If the item is running low and the lead time means you need to order soon, the UI will highlight this urgency.

---

## Technical Summary

| Task | Files to Create/Modify |
|------|------------------------|
| Speed up extraction | `supabase/functions/extract-nutrition/index.ts` |
| Price checks table | New migration |
| Search prices function | `supabase/functions/search-toiletry-prices/index.ts` (new) |
| Price comparison hook | `src/hooks/useToiletryPriceChecks.ts` (new) |
| Price comparison UI | `src/components/toiletries/PriceComparisonDialog.tsx` (new) |
| Add menu action | `src/components/toiletries/ToiletryTable.tsx` |
| Update forecast logic | `src/lib/toiletryCalculations.ts` |
| Toiletries page integration | `src/pages/Toiletries.tsx` |

### Prerequisites
- Firecrawl connector is already linked (confirmed)
- May optionally add Perplexity connector for faster search results

---

## Sequence

1. Speed up the extraction function (quick win)
2. Create database table for price checks
3. Build the search edge function
4. Create the UI components
5. Integrate with forecast calculations
6. Test end-to-end with real products
