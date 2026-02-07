

# Add Portioning Settings UI to Nutrition Target Settings

## Summary

The auto-portioning logic and meal eligibility features are already fully implemented and working. The only missing piece is the **UI for configuring portioning settings** (min/max grams, rounding, tolerance %) in the Settings page.

---

## What's Already Working

| Feature | Status | Location |
|---------|--------|----------|
| Auto-calculation algorithm | Working | `src/lib/autoPortioning.ts` |
| Meal eligibility blocking | Working | `MealItemDialog.tsx` lines 51-53, 221-231 |
| "Auto" badge in dialog | Working | `MealItemDialog.tsx` line 166-171 |
| Database columns for settings | Exist | `min_grams_per_item`, `max_grams_per_item`, `portion_rounding`, `target_tolerance_percent` |
| Settings values in DB | Configured | User has: min=10, max=500, rounding=5, tolerance=2% |

---

## What Needs to be Added

Add portioning settings inputs to `NutritionTargetSettings.tsx`:

```text
+----------------------------------------------+
| Advanced Portioning Settings                   |
| (Shown only when Target Mode is selected)     |
+----------------------------------------------+
| Min grams per item    [  10  ] grams         |
| Max grams per item    [ 500  ] grams         |
| Round portions to     [   5  ] grams         |
| Target tolerance      [   2  ] %             |
+----------------------------------------------+
```

---

## Implementation Plan

### File: `src/components/settings/NutritionTargetSettings.tsx`

**1. Update the Zod Schema** (lines 16-29)

Add 4 new fields to the schema:

```typescript
const settingsSchema = z.object({
  // ... existing fields ...
  // Portioning settings
  min_grams_per_item: z.coerce.number().min(1).max(100).nullable().optional(),
  max_grams_per_item: z.coerce.number().min(50).max(2000).nullable().optional(),
  portion_rounding: z.coerce.number().min(1).max(50).nullable().optional(),
  target_tolerance_percent: z.coerce.number().min(0).max(10).nullable().optional(),
});
```

**2. Update Default Values** (lines 37-51)

Add defaults for the new fields:

```typescript
defaultValues: {
  // ... existing ...
  min_grams_per_item: 10,
  max_grams_per_item: 500,
  portion_rounding: 5,
  target_tolerance_percent: 2,
},
```

**3. Update useEffect for Settings Load** (lines 54-69)

Include the new fields in the `form.reset()` call:

```typescript
form.reset({
  // ... existing fields ...
  min_grams_per_item: settings.min_grams_per_item,
  max_grams_per_item: settings.max_grams_per_item,
  portion_rounding: settings.portion_rounding,
  target_tolerance_percent: settings.target_tolerance_percent,
});
```

**4. Update onSubmit Handler** (lines 85-98)

Include the new fields when saving:

```typescript
await upsertSettings.mutateAsync({
  // ... existing fields ...
  min_grams_per_item: values.min_grams_per_item,
  max_grams_per_item: values.max_grams_per_item,
  portion_rounding: values.portion_rounding,
  target_tolerance_percent: values.target_tolerance_percent,
});
```

**5. Add Portioning Settings UI Section** (after line 329)

Add a new Collapsible section inside the Target Mode block:

```tsx
{/* Portioning Settings - inside target_based section */}
<Collapsible className="mt-4">
  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary">
    <Settings2 className="h-4 w-4" />
    Advanced Portioning Settings
    <ChevronDown className="h-4 w-4 ml-auto" />
  </CollapsibleTrigger>
  <CollapsibleContent className="pt-4 space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <FormField name="min_grams_per_item" ... />
      <FormField name="max_grams_per_item" ... />
      <FormField name="portion_rounding" ... />
      <FormField name="target_tolerance_percent" ... />
    </div>
  </CollapsibleContent>
</Collapsible>
```

---

## UI Design

Each field should have:
- Clear label
- Number input with appropriate step/min/max
- Helper text explaining the setting

| Field | Label | Description | Default |
|-------|-------|-------------|---------|
| `min_grams_per_item` | Min portion size | Smallest portion to suggest | 10g |
| `max_grams_per_item` | Max portion size | Largest portion to suggest | 500g |
| `portion_rounding` | Round to nearest | Portions rounded to this value | 5g |
| `target_tolerance_percent` | Target tolerance | Acceptable deviation from target | 2% |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/settings/NutritionTargetSettings.tsx` | Add schema fields, form defaults, useEffect updates, onSubmit updates, and UI section |

---

## Testing Checklist

After implementation:

1. Go to Settings > Nutrition
2. Select "System Automated" mode
3. Verify "Advanced Portioning Settings" section appears
4. Verify current values load from database (10, 500, 5, 2)
5. Change values and save
6. Refresh page and confirm values persisted
7. Go to Meal Plan, add items, verify portioning respects new settings

