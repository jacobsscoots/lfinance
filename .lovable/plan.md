

# Plan: Fix Topper Minimums, Smart Seasonings, Reset Day & Reset Week

## Overview

This plan addresses four key improvements:
1. **Topper minimum portions** - Ensure fruit/granola always gets sensible non-zero grams (not 0g)
2. **Smart seasoning logic** - Match seasonings to protein types with realistic quantities  
3. **Reset Day button** - Already exists as "Clear All Items" - rename for clarity
4. **Reset Week button** - New feature to clear the entire week's plan in one action

---

## 1. Fix Topper Items Showing 0g

### Problem
The breakfast algorithm correctly caps granola at 35g but the **secondary items (fruit)** can end up at 0g when:
- The base (yogurt) is large enough to hit all calorie targets
- The `afterBaseCals` remaining is zero or negative

### Solution
Add minimum portion enforcement for all breakfast roles:

| Role | Minimum | Maximum |
|------|---------|---------|
| Base (yogurt) | 100g | 500g |
| Secondary (fruit) | 80g | 250g |
| Topper (granola) | 25g | 40g |

**Logic change in `solveSimultaneous` (lines 289-340):**

```typescript
// Step 3.5: Ensure secondary items get minimum portion
breakfastSecondary.forEach(idx => {
  if (grams[idx] < 80) {
    grams[idx] = 80; // Minimum 80g fruit
  }
});

// Step 1: Cap granola at 35g but ensure minimum 25g if included
breakfastTopper.forEach(idx => {
  grams[idx] = Math.max(25, Math.min(35, grams[idx] || 30));
});
```

This ensures any item the user adds will always have a visible, sensible portion.

---

## 2. Smart Seasoning Logic

### Problem
Seasonings are currently set to a fixed 15g regardless of what they pair with. This creates:
- Random/bland combinations
- Unrealistic quantities (15g paprika on fish?)

### Solution
Create a **seasoning-to-protein pairing map** with realistic quantities:

```typescript
const SEASONING_PAIRINGS: Record<string, { proteins: string[], grams: number }> = {
  "schwartz": { proteins: ["chicken", "beef", "pork"], grams: 8 },
  "paprika": { proteins: ["chicken", "pork"], grams: 3 },
  "garlic": { proteins: ["chicken", "fish", "prawn"], grams: 6 },
  "herbs": { proteins: ["fish", "chicken", "lamb"], grams: 5 },
  "lemon": { proteins: ["fish", "salmon", "cod"], grams: 10 },
  "pepper": { proteins: ["beef", "steak", "chicken"], grams: 2 },
  "curry": { proteins: ["chicken", "tofu", "prawn"], grams: 10 },
  "soy": { proteins: ["fish", "tofu", "prawn", "salmon"], grams: 15 },
  "teriyaki": { proteins: ["salmon", "chicken"], grams: 20 },
  "cajun": { proteins: ["chicken", "fish", "prawn"], grams: 5 },
};

const DEFAULT_SEASONING_GRAMS = 10; // If no match
```

**New function: `getSeasoningPortion`**

```typescript
function getSeasoningPortion(
  seasoning: Product,
  mealItems: EditableItem[]
): number {
  const seasoningName = seasoning.name.toLowerCase();
  const proteins = mealItems.filter(i => isHighProteinSource(i.product));
  
  // Find best match
  for (const [key, config] of Object.entries(SEASONING_PAIRINGS)) {
    if (seasoningName.includes(key)) {
      // Check if any protein in meal matches
      const hasMatchingProtein = proteins.some(p => 
        config.proteins.some(pName => p.product.name.toLowerCase().includes(pName))
      );
      if (hasMatchingProtein) {
        return config.grams;
      }
    }
  }
  
  // Default: small portion if no specific match
  return DEFAULT_SEASONING_GRAMS;
}
```

**Integration**: Replace the fixed `15g` seasoning assignment with the dynamic calculation.

---

## 3. Reset Day Button (Rename + Confirm)

### Current State
- Already exists as "Clear All Items" in the day card dropdown
- Works correctly - deletes all `meal_plan_items` for that day's plan

### Change
- Rename to **"Reset Day"** for consistency with new Reset Week button
- Add confirmation dialog to prevent accidental deletion

---

## 4. Reset Week Button (New Feature)

### Location
Add to the **week header actions** area (next to "Copy Previous Week" button)

### UI Design

```
Week Navigation                      [Target Mode] [Generate] [↻ Reset Week] [Copy Prev Week]
```

Mobile: Add to the ⋮ dropdown menu

### Implementation

**New mutation in `useMealPlanItems.ts`:**

```typescript
const clearWeek = useMutation({
  mutationFn: async () => {
    if (!user) throw new Error("Not authenticated");
    
    // Get all plan IDs for this week
    const planIds = mealPlans.map(p => p.id);
    
    // Delete all items from all plans
    const { error } = await supabase
      .from("meal_plan_items")
      .delete()
      .eq("user_id", user.id)
      .in("meal_plan_id", planIds);
    
    if (error) throw error;
    
    return { plansCleared: planIds.length };
  },
  onSuccess: (result) => {
    queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
    toast.success(`Reset ${result.plansCleared} days`);
  },
});
```

**UI in `WeeklyMealPlanner.tsx`:**

Add Reset Week button with confirmation:

```typescript
const [resetWeekOpen, setResetWeekOpen] = useState(false);

// In header actions area:
<AlertDialog open={resetWeekOpen} onOpenChange={setResetWeekOpen}>
  <AlertDialogTrigger asChild>
    <Button variant="outline" size="sm">
      <RotateCcw className="h-4 w-4 mr-1" />
      Reset Week
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Reset entire week?</AlertDialogTitle>
      <AlertDialogDescription>
        This will clear all meals and portions for the week. 
        Your saved foods and settings will not be affected.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={() => clearWeek.mutate()}>
        Reset Week
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/autoPortioning.ts` | Add minimum portion enforcement for breakfast roles; Add seasoning pairing logic |
| `src/hooks/useMealPlanItems.ts` | Add `clearWeek` mutation |
| `src/components/mealplan/WeeklyMealPlanner.tsx` | Add Reset Week button with confirmation dialog |
| `src/components/mealplan/MealDayCard.tsx` | Rename "Clear All Items" to "Reset Day" |

---

## Testing Plan

After implementation:
1. Add yogurt + fruit + granola to breakfast → click Generate → verify:
   - Fruit gets ≥80g (not 0g)
   - Granola gets 25-35g
   - Yogurt sized appropriately for protein
2. Add chicken + Schwartz seasoning → click Generate → verify seasoning gets ~8g (not 15g)
3. Test Reset Day on a single day → confirm items cleared
4. Test Reset Week → confirm all 7 days cleared but settings preserved
5. Verify macros still hit targets exactly (no alert warnings)

