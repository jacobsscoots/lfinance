

# Nutrition Settings & Product Management Upgrade

## Overview

This plan upgrades the Nutrition settings page with two major enhancements:

1. **Enhanced Targets System** - Separate targets for Mon-Fri vs Sat-Sun, for both System Automated and Manual modes
2. **Extended Product Form** - Full UK nutrition label fields (Energy kJ/kcal, Saturates, Sugars, Fibre, Salt), serving basis options, and AI-powered import features

---

## What You'll Get

### 1. Targets Section

**Two Planning Modes (already exists, but extended):**
- **System Automated**: System auto-adjusts editable portions to meet your targets
- **Manual**: You control portions; system calculates totals only

**New: Day-Type Specific Targets:**
- **Mon-Fri targets**: Apply to weekday meal planning
- **Sat-Sun targets**: Apply to weekend meal planning
- **Default behaviour**: If Sat-Sun not set, it inherits Mon-Fri values
- **"Copy Mon-Fri to Sat-Sun" button**: Quick duplication

**Target Fields for Each Day-Type:**
- Calories (kcal)
- Protein (g)
- Carbs (g)
- Fat (g)

### 2. Enhanced Product Form

**New Nutrition Fields (UK label order):**

| Field | Unit | Notes |
|-------|------|-------|
| Energy (kJ) | kJ | Auto-converts if kcal entered |
| Energy (kcal) | kcal | Auto-converts if kJ entered (1 kcal = 4.184 kJ) |
| Fat | g | |
| Saturates | g | "of which saturates" |
| Carbohydrate | g | |
| Sugars | g | "of which sugars" |
| Fibre | g | |
| Protein | g | |
| Salt | g | Auto-converts from sodium if needed (salt = sodium x 2.5) |

**Additional Fields:**
- Product name
- Brand (optional)
- Price (standard)
- Offer price (optional)
- Offer label (optional, e.g. "Clubcard Price")
- Source link (URL where product was imported from)
- Image URL (optional)
- Storage notes (optional)

**Serving Basis Options:**
- **Per 100g** (default): Values entered are per 100g
- **Per serving**: User enters serving size in g/ml; system converts to per-100g for storage
- **As sold**: Treat as per-pack/item; user enters pack weight; system converts to per-100g

### 3. AI-Powered Import Features

**Three import methods on Add/Edit Product:**

1. **Upload Nutrition Label Photo**
   - User uploads a photo/screenshot of a nutrition label
   - AI extracts and pre-fills all fields
   - Shows editable preview before saving
   - Uncertain fields left blank with highlight

2. **Paste Text**
   - User copies nutrition info from a website
   - Parses and maps common label names to fields
   - Handles variations like "of which saturates", "carbohydrates", "Salt/Sodium"

3. **Import from URL**
   - User pastes a product page URL
   - Edge function fetches and parses the page
   - Extracts: name, brand, image, price, pack size, nutrition table
   - Uses schema.org/JSON-LD when available, falls back to HTML parsing
   - Shows side-by-side preview: "Found data" vs form fields
   - "Replace?" toggles if fields already have data

---

## User Interface Design

### Nutrition Targets Tab

```text
+----------------------------------------------------------+
| Nutrition Targets                                         |
+----------------------------------------------------------+
|                                                           |
| Planning Mode                                             |
| +------------------------+ +------------------------+    |
| | ● System Automated     | | ○ Manual               |    |
| |   Auto-adjust portions | |   You control portions |    |
| +------------------------+ +------------------------+    |
|                                                           |
| Daily Targets                                             |
| +---------------+ +---------------+                       |
| | Mon-Fri       | | Sat-Sun       |  [Copy Mon-Fri →]    |
| +---------------+ +---------------+                       |
|                                                           |
| [Selected: Mon-Fri]                                       |
| +----------+ +----------+ +----------+ +----------+      |
| | Calories | | Protein  | | Carbs    | | Fat      |      |
| | 2000     | | 150      | | 200      | | 65       |      |
| | kcal/day | | g/day    | | g/day    | | g/day    |      |
| +----------+ +----------+ +----------+ +----------+      |
|                                                           |
|                                     [Save Settings]       |
+----------------------------------------------------------+
```

### Product Form Dialog

```text
+----------------------------------------------------------+
| Add Product                    [Upload] [Paste] [URL]     |
+----------------------------------------------------------+
| Product Name:     [________________________]              |
| Brand (optional): [________________________]              |
|                                                           |
| Serving Basis:    [Per 100g ▼] [Serving size: ___ g]     |
|                                                           |
| --- Nutrition (per 100g) ---                             |
| Energy: [____] kJ  [____] kcal  (auto-converts)          |
| Fat:           [____] g                                   |
| Saturates:     [____] g                                   |
| Carbohydrate:  [____] g                                   |
| Sugars:        [____] g                                   |
| Fibre:         [____] g                                   |
| Protein:       [____] g                                   |
| Salt:          [____] g  ⓘ (converted from sodium)       |
|                                                           |
| --- Pricing ---                                           |
| Price:       £[____]   Pack size: [____] g               |
| Offer price: £[____]   Offer label: [__________]         |
|                                                           |
| --- Options ---                                           |
| Product Type: [Editable ▼]                               |
| ☐ Ignore macros in calculations                          |
|                                                           |
|                              [Cancel]  [Add Product]      |
+----------------------------------------------------------+
```

### Import Preview Modal

```text
+----------------------------------------------------------+
| Import Preview                                            |
+----------------------------------------------------------+
| Found from URL: tesco.com/groceries/...                  |
|                                                           |
| Field          | Found Value      | Use? |               |
| ---------------|------------------|------|               |
| Name           | "Greek Yogurt"   | [✓]  |               |
| Brand          | "Fage"           | [✓]  |               |
| Price          | £2.50            | [✓]  |               |
| Pack Size      | 500g             | [✓]  |               |
| Energy         | 97 kcal          | [✓]  |               |
| Fat            | 5.0g             | [✓]  |               |
| Saturates      | 3.5g             | [✓]  |               |
| Carbohydrate   | 4.0g             | [✓]  |               |
| ...                                                       |
|                                                           |
|                        [Cancel]  [Import Selected]        |
+----------------------------------------------------------+
```

---

## Technical Implementation

### Database Changes

**1. Extend `user_nutrition_settings` table:**

Add new columns for weekend targets:
- `weekday_calorie_target` (rename existing)
- `weekday_protein_target_grams`
- `weekday_carbs_target_grams`
- `weekday_fat_target_grams`
- `weekend_calorie_target`
- `weekend_protein_target_grams`
- `weekend_carbs_target_grams`
- `weekend_fat_target_grams`
- `weekend_targets_enabled` (boolean, default false - if false, use weekday values)

**2. Extend `products` table:**

Add new columns:
- `energy_kj_per_100g` (numeric) - kJ value
- `saturates_per_100g` (numeric, default 0)
- `sugars_per_100g` (numeric, default 0)
- `fibre_per_100g` (numeric, default 0)
- `salt_per_100g` (numeric, default 0)
- `brand` (text, nullable)
- `offer_price` (numeric, nullable)
- `offer_label` (text, nullable)
- `source_url` (text, nullable)
- `image_url` (text, nullable)
- `storage_notes` (text, nullable)
- `serving_basis` (text, default 'per_100g') - 'per_100g', 'per_serving', 'as_sold'
- `serving_size_grams` (numeric, nullable) - used when basis is per_serving or as_sold

### Edge Functions

**New: `extract-nutrition` edge function**

Handles all three import methods:

```typescript
// POST /extract-nutrition
{
  method: "image" | "text" | "url",
  content: string // base64 image, pasted text, or URL
}

// Returns
{
  success: boolean,
  data?: {
    name?: string,
    brand?: string,
    image_url?: string,
    price?: number,
    offer_price?: number,
    offer_label?: string,
    pack_size_grams?: number,
    energy_kj?: number,
    energy_kcal?: number,
    fat?: number,
    saturates?: number,
    carbohydrate?: number,
    sugars?: number,
    fibre?: number,
    protein?: number,
    salt?: number,
    source_url?: string,
    confidence: Record<string, "high" | "medium" | "low">
  },
  error?: string
}
```

**Implementation approach:**
- For images: Use Lovable AI (Gemini) vision model to extract nutrition info
- For text: Parse with regex patterns for common label formats
- For URLs: Fetch page, look for JSON-LD first, then parse HTML tables

### Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/extract-nutrition/index.ts` | AI extraction edge function |
| `src/components/settings/NutritionImportDialog.tsx` | Import preview modal |
| `src/lib/nutritionExtraction.ts` | Client-side text parsing utilities |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/settings/NutritionTargetSettings.tsx` | Add day-type tabs, copy button |
| `src/components/settings/ProductSettings.tsx` | Extended form with all nutrition fields, import buttons |
| `src/hooks/useNutritionSettings.ts` | Support weekend targets |
| `src/hooks/useProducts.ts` | Extended Product type with new fields |
| `src/lib/mealCalculations.ts` | Use correct targets based on day of week |
| Database migration | Add new columns to both tables |

---

## Calculation Logic

### Energy Conversion
```typescript
const KJ_TO_KCAL = 4.184;

// If user enters kJ only
kcal = Math.round(kJ / KJ_TO_KCAL);

// If user enters kcal only  
kJ = Math.round(kcal * KJ_TO_KCAL);
```

### Sodium to Salt Conversion
```typescript
// If source provides sodium instead of salt
salt = sodium * 2.5;
// Show tooltip: "Calculated from sodium (×2.5)"
```

### Serving Basis Conversion
```typescript
// Convert to per-100g for storage
if (basis === "per_serving") {
  per100g = (valuePerServing / servingSizeGrams) * 100;
}
if (basis === "as_sold") {
  per100g = (valuePerPack / packSizeGrams) * 100;
}
```

### Target Selection for Meal Plan
```typescript
function getTargetsForDate(date: Date, settings: NutritionSettings) {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  if (isWeekend && settings.weekend_targets_enabled) {
    return {
      calories: settings.weekend_calorie_target,
      protein: settings.weekend_protein_target_grams,
      carbs: settings.weekend_carbs_target_grams,
      fat: settings.weekend_fat_target_grams,
    };
  }
  
  return {
    calories: settings.weekday_calorie_target,
    protein: settings.weekday_protein_target_grams,
    carbs: settings.weekday_carbs_target_grams,
    fat: settings.weekday_fat_target_grams,
  };
}
```

---

## Validation Rules

### Product Form Validation

```typescript
const productSchema = z.object({
  name: z.string().min(1).max(200),
  brand: z.string().max(100).optional(),
  
  // Energy - at least one required, auto-calc the other
  energy_kj_per_100g: z.number().min(0).optional(),
  calories_per_100g: z.number().min(0).optional(),
  
  // All macros accept decimals, default to 0
  fat_per_100g: z.number().min(0).default(0),
  saturates_per_100g: z.number().min(0).default(0),
  carbs_per_100g: z.number().min(0).default(0),
  sugars_per_100g: z.number().min(0).default(0),
  fibre_per_100g: z.number().min(0).default(0),
  protein_per_100g: z.number().min(0).default(0),
  salt_per_100g: z.number().min(0).default(0),
  
  // Pricing
  price: z.number().min(0).default(0),
  offer_price: z.number().min(0).optional(),
  offer_label: z.string().max(50).optional(),
  
  // Serving basis
  serving_basis: z.enum(["per_100g", "per_serving", "as_sold"]),
  serving_size_grams: z.number().positive().optional(),
  pack_size_grams: z.number().positive().optional(),
  
  // Options
  product_type: z.enum(["editable", "fixed"]),
  fixed_portion_grams: z.number().positive().optional(),
  ignore_macros: z.boolean().default(false),
}).refine(data => {
  // If per_serving, require serving size
  if (data.serving_basis === "per_serving" && !data.serving_size_grams) {
    return false;
  }
  // If as_sold, require pack size
  if (data.serving_basis === "as_sold" && !data.pack_size_grams) {
    return false;
  }
  return true;
}, {
  message: "Serving/pack size required for selected basis"
});
```

---

## Import Feature Details

### Image Upload Flow

1. User clicks "Upload" button
2. File picker opens (accept: image/*)
3. Image displayed in preview
4. "Extracting..." loading state
5. Call edge function with base64 image
6. Edge function uses Gemini vision to read label
7. Returns structured data with confidence levels
8. Show preview modal with checkboxes
9. User confirms/edits fields
10. Populate form with selected values

### URL Import Flow

1. User clicks "Import from URL" button
2. Modal opens with URL input field
3. User pastes URL and clicks "Import"
4. Edge function fetches page
5. Parses structured data (JSON-LD) or HTML
6. Returns extracted fields
7. Show preview modal with found vs form comparison
8. Toggle which fields to import
9. Apply selected fields to form

### Text Paste Flow

1. User clicks "Paste text" button
2. Textarea opens
3. User pastes copied nutrition text
4. Client-side parsing extracts values
5. Show preview with parsed fields
6. Confirm to populate form

### Field Mapping (Common Label Variations)

```typescript
const FIELD_MAPPINGS = {
  energy_kj: ["energy", "energie", "kcal/kj", "kilojoules"],
  energy_kcal: ["energy", "calories", "kcal", "energy value"],
  fat: ["fat", "total fat", "lipides"],
  saturates: ["saturates", "of which saturates", "saturated fat", "sat fat"],
  carbohydrate: ["carbohydrate", "carbohydrates", "carbs", "total carbohydrate"],
  sugars: ["sugars", "of which sugars", "total sugars"],
  fibre: ["fibre", "fiber", "dietary fibre"],
  protein: ["protein", "proteins"],
  salt: ["salt", "sodium"], // Note: sodium needs conversion
};
```

---

## Summary

This upgrade transforms the Nutrition settings into a complete meal planning configuration system by:

1. **Separating weekday/weekend targets** so you can plan differently for work days vs weekends
2. **Adding full UK label fields** (saturates, sugars, fibre, salt) for comprehensive nutrition tracking
3. **Supporting multiple serving bases** (per 100g, per serving, as sold) to match how products are labelled
4. **Enabling AI-powered import** from photos, text, or URLs to save manual data entry time
5. **Storing source URLs and images** for product reference

The meal plan page will automatically use the correct targets based on the day being planned, ensuring your weekday and weekend goals are respected.

