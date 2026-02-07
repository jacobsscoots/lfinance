
# Comprehensive Product Management & Inventory Tracking Implementation Plan

## Summary

This plan addresses multiple feature requests to synchronize functionality between Groceries and Toiletries, fix the edit form prefilling issues, add import capabilities to Toiletries, and implement inventory tracking with packaging weight calculations.

---

## Part 1: Fix Edit Product Flow

### Problem Analysis

| Component | Current State | Issue |
|-----------|---------------|-------|
| `ProductFormDialog` | Uses `defaultValues` only | **No `useEffect` to reset form** when product changes - edit doesn't prefill |
| `ToiletryFormDialog` | Has `useEffect` with `form.reset()` | Should be working correctly |

### Solution for ProductFormDialog

Add a `useEffect` hook to reset the form when the `product` prop changes (similar to ToiletryFormDialog):

```typescript
// After line 100 in ProductFormDialog
useEffect(() => {
  if (product) {
    form.reset({
      name: product.name,
      brand: product.brand || "",
      energy_kj_per_100g: product.energy_kj_per_100g || null,
      calories_per_100g: product.calories_per_100g || 0,
      // ... all other fields
    });
  } else {
    form.reset({
      name: "",
      brand: "",
      // ... default values
    });
  }
}, [product, form]);
```

### Add Image Preview in Edit Forms

When editing a product with an existing `image_url`, display it in the form:

```tsx
{/* After Basic Info section */}
{isEditing && product?.image_url && (
  <div className="space-y-2">
    <Label>Current Image</Label>
    <img 
      src={product.image_url} 
      alt={product.name}
      className="max-h-32 rounded-lg border object-contain"
    />
  </div>
)}
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/settings/ProductSettings.tsx` | Add `useEffect` for form reset, add image preview section |

---

## Part 2: Add Import Tools for Toiletries

### New Component: ToiletryImportDialog

Create a new import dialog similar to `NutritionImportDialog` but optimized for toiletry products:

**Features:**
- Three import methods: Upload image, Paste text, Import from URL
- Supported sites: Boots, Superdrug, Savers, Amazon, etc.
- Fields to extract:
  - Product name + brand
  - Image URL
  - Price (standard + offer/member price + offer label)
  - Pack size (e.g., 500ml, 200g, 30 tablets)
  - Size unit (ml, g, units)

**Edge Function Update:**
Add a `productType` parameter to `extract-nutrition` function to support toiletry extraction with different prompts:

```typescript
// In extract-nutrition/index.ts
const { method, content, productType = "grocery" } = body;

// Different prompts for toiletry vs grocery
const toiletryPrompt = `Extract product information (name, brand, price, pack size, image URL) - no nutrition data needed`;
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/toiletries/ToiletryImportDialog.tsx` | Create | Import dialog for toiletries |
| `src/components/toiletries/ToiletryFormDialog.tsx` | Modify | Add "Import" button, integrate import dialog |
| `supabase/functions/extract-nutrition/index.ts` | Modify | Add `productType` parameter, toiletry extraction logic |

---

## Part 3: Add Inventory Tracking for Shopping Calculations

### Database Schema Changes

Add new columns to both `products` and `toiletry_items` tables:

```sql
-- For products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS quantity_on_hand integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_in_use integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS reorder_threshold integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_quantity integer DEFAULT 1;

-- For toiletry_items table
ALTER TABLE toiletry_items 
ADD COLUMN IF NOT EXISTS quantity_on_hand integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_in_use integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS reorder_threshold integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_quantity integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS brand text,
ADD COLUMN IF NOT EXISTS offer_price numeric,
ADD COLUMN IF NOT EXISTS offer_label text,
ADD COLUMN IF NOT EXISTS source_url text;
```

### Shopping Calculation Logic

```text
Needed to buy = max(0, target_quantity - quantity_on_hand)
```

If item is "in use" and below threshold, flag for shopping list.

### UI Changes

Add inventory fields to both product forms:

```text
+----------------------------------------------+
| Inventory                                     |
+----------------------------------------------+
| Quantity on hand    [  2  ] units            |
| In use             [  1  ] (optional)        |
| Reorder threshold  [  1  ] units             |
| Target quantity    [  3  ] units             |
+----------------------------------------------+
| Shopping need: 1 unit                        |
+----------------------------------------------+
```

---

## Part 4: Packaging Weight & Net Usable Amount

### Database Schema Changes

```sql
-- For products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS gross_pack_size_grams numeric,
ADD COLUMN IF NOT EXISTS packaging_weight_grams numeric DEFAULT 0;

-- For toiletry_items table  
ALTER TABLE toiletry_items 
ADD COLUMN IF NOT EXISTS gross_size numeric,
ADD COLUMN IF NOT EXISTS packaging_weight numeric DEFAULT 0;
```

### Net Usable Calculation

Since Supabase generated columns can be complex to manage, calculate net usable in the application layer:

```typescript
// In lib/calculations.ts
export function calculateNetUsable(
  grossSize: number | null,
  packSize: number | null,
  packagingWeight: number = 0
): number {
  const gross = grossSize ?? packSize ?? 0;
  return Math.max(0, gross - packagingWeight);
}
```

### Integration Points

| System | How to use net usable amount |
|--------|------------------------------|
| Meal planning | Use net usable for portion calculations and remaining stock |
| Shopping list | Use for accurate depletion and reorder calculations |
| Toiletry usage | Apply to usage tracking |

### UI Changes

Add packaging fields to forms:

```text
+----------------------------------------------+
| Pack Size & Packaging                         |
+----------------------------------------------+
| Gross pack size    [ 500 ] g                 |
| Packaging weight   [  15 ] g                 |
| Net usable amount:  485g (auto-calculated)   |
+----------------------------------------------+
```

### Edge Cases

| Case | Handling |
|------|----------|
| Packaging weight unknown | Default to 0, display warning badge |
| Unit-based items | Packaging weight optional, net = gross count |

---

## File Changes Summary

| File | Action | Changes |
|------|--------|---------|
| `src/components/settings/ProductSettings.tsx` | Modify | Add `useEffect` for form reset, image preview, inventory fields, packaging fields |
| `src/components/toiletries/ToiletryFormDialog.tsx` | Modify | Add "Import" button, inventory fields, packaging fields, image preview |
| `src/components/toiletries/ToiletryImportDialog.tsx` | Create | New import dialog for toiletries |
| `src/lib/toiletryCalculations.ts` | Modify | Update `ToiletryItem` interface, add net usable calculation |
| `src/hooks/useProducts.ts` | Modify | Update `Product` interface and `ProductFormData` |
| `src/hooks/useToiletries.ts` | Modify | Update types for new fields |
| `supabase/functions/extract-nutrition/index.ts` | Modify | Add `productType` parameter for toiletry extraction |

### Database Migration (Single Migration)

```sql
-- Add inventory and packaging columns to products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS quantity_on_hand integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_in_use integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS reorder_threshold integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_quantity integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS gross_pack_size_grams numeric,
ADD COLUMN IF NOT EXISTS packaging_weight_grams numeric DEFAULT 0;

-- Add inventory, packaging, and import fields to toiletry_items
ALTER TABLE toiletry_items 
ADD COLUMN IF NOT EXISTS quantity_on_hand integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_in_use integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS reorder_threshold integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_quantity integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS gross_size numeric,
ADD COLUMN IF NOT EXISTS packaging_weight numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS brand text,
ADD COLUMN IF NOT EXISTS offer_price numeric,
ADD COLUMN IF NOT EXISTS offer_label text,
ADD COLUMN IF NOT EXISTS source_url text;
```

---

## Implementation Order

1. **Phase 1 - Fix Edit Prefilling** (immediate impact)
   - Add `useEffect` to `ProductFormDialog` for form reset
   - Add image preview in edit forms
   - Verify toiletry edit already works

2. **Phase 2 - Database Migration**
   - Run migration to add all new columns to both tables

3. **Phase 3 - Toiletry Import**
   - Create `ToiletryImportDialog`
   - Update edge function for toiletry extraction
   - Integrate into `ToiletryFormDialog`

4. **Phase 4 - Inventory Fields**
   - Add inventory fields to both forms
   - Update TypeScript interfaces
   - Add shopping calculation display

5. **Phase 5 - Packaging Weight**
   - Add packaging fields to forms
   - Implement net usable calculation
   - Add warnings for missing data

---

## Testing Checklist

After implementation:

1. **Edit form prefill**: Open existing product, verify ALL fields are populated including image
2. **No duplicates**: Edit and save, verify only 1 record exists
3. **Toiletry import**: Test URL import from Boots/Superdrug
4. **Inventory calculation**: Set target_quantity > quantity_on_hand, verify shopping need displays
5. **Packaging weight**: Set gross and packaging, verify net_usable calculates correctly
6. **Last updated display**: Verify timestamp shows after save
