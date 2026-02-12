

# Switch AI to Claude on Cheaper Bills and Meal Planner

## Summary

Replace the existing Lovable AI Gateway (Gemini) with Claude (Anthropic) on the Cheaper Bills page, and add a new Claude-powered meal planning feature to the Meal Planner. Both will share a single backend service.

---

## What exists today

| Page | Current AI | How it works |
|------|-----------|-------------|
| Cheaper Bills | Lovable AI Gateway (Gemini 3 Flash) via `analyze-usage-ai` edge function | Chat-style Q&A about energy usage, recommendations, savings tips |
| Meal Planner | **No AI** -- uses a deterministic math solver (`portioningEngine.ts`, 1,900 lines) | User adds food items, clicks "Generate", solver assigns gram portions to hit calorie/macro targets |

---

## What will change

### 1. Store the Anthropic API key

- Add `ANTHROPIC_API_KEY` as a secret via the secrets tool
- You will need to provide your Claude API key from the Anthropic dashboard

### 2. Create a shared `claude-ai` edge function

A single new edge function at `supabase/functions/claude-ai/index.ts` that:

- Accepts `{ feature: "cheaper_bills" | "meal_planner", input: {...} }`
- Routes to feature-specific system prompts
- Calls `https://api.anthropic.com/v1/messages` with the `ANTHROPIC_API_KEY`
- Uses `claude-sonnet-4-20250514` (Claude 3.5 Sonnet successor)
- Returns the same response structure each page expects
- Handles errors: 429 rate limits, 401 auth failures, timeouts
- Logs the provider name (`claude`) for verification (no PII)

### 3. Update Cheaper Bills

**File: `src/components/cheaper-bills/BillsAssistant.tsx`**

- Change the `supabase.functions.invoke` call from `analyze-usage-ai` to `claude-ai`
- Pass `{ feature: "cheaper_bills", input: { question, readings, tariff } }`
- Response format stays identical (`{ response: "..." }`) -- no UI changes needed

**The existing `analyze-usage-ai` function will be kept** (other features may reference it), but BillsAssistant will stop using it.

### 4. Add AI meal planning to Meal Planner

**New feature: "AI Plan My Day"** button on each day card

How it will work:
1. User adds food items to a day (as they do now)
2. User clicks "AI Plan" instead of / alongside "Generate"
3. The system sends Claude:
   - The list of available food items (with nutrition per 100g)
   - The calorie and macro targets for that day
   - Any locked portions
   - Seasoning rules (15g cap)
4. Claude returns a JSON array of `{ product_id, quantity_grams }` for each item
5. The UI applies these portions exactly as the existing solver does

This means:
- The deterministic solver stays as a fallback ("Generate" button unchanged)
- AI adds a second option that can produce more sensible meal compositions
- Response is validated against the same constraints before saving

**Files to create/edit:**
- `supabase/functions/claude-ai/index.ts` -- new shared edge function
- `src/components/mealplan/MealDayCard.tsx` -- add "AI Plan" button next to "Generate"
- `src/hooks/useMealPlanItems.ts` -- add `aiPlanDay` mutation that calls the edge function and saves results
- `supabase/config.toml` -- register the new function

### 5. Prompts (kept in one place -- the edge function)

All system prompts will live inside `claude-ai/index.ts`:

- **Cheaper Bills prompt**: Migrated from the existing `analyze-usage-ai` system prompt (UK energy assistant, exclusion rules, recommendation format)
- **Meal Planner prompt**: New prompt instructing Claude to assign gram portions to foods within calorie/macro tolerances, respecting locked items and the 15g seasoning cap, returning strict JSON via tool calling

---

## Technical details

### Edge function structure

```text
supabase/functions/claude-ai/index.ts
  |
  +-- CORS handling
  +-- JWT auth verification
  +-- Input validation (Zod)
  +-- Feature router:
       +-- "cheaper_bills" -> builds energy context, calls Claude
       +-- "meal_planner"  -> builds food/target context, calls Claude with tool_use for JSON
  +-- Error handling (429, 401, 500)
  +-- Logging (feature name, model, token count -- no PII)
```

### Claude API call pattern

```text
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: ANTHROPIC_API_KEY
  anthropic-version: 2023-06-01
  content-type: application/json

Body for meal planner uses tool_use to get structured JSON output.
Body for cheaper bills uses plain text response.
```

### Config update

```toml
[functions.claude-ai]
verify_jwt = false
```

---

## What gets removed vs added

| Removed | Added |
|---------|-------|
| `BillsAssistant` call to `analyze-usage-ai` | `BillsAssistant` call to `claude-ai` |
| (nothing else removed) | New `claude-ai` edge function |
| | "AI Plan" button on meal day cards |
| | `aiPlanDay` mutation in `useMealPlanItems` |

---

## Testing checklist

- Cheaper Bills: open the AI assistant, ask "How can I reduce my bill?" -- confirm response comes from Claude (check edge function logs for `provider: claude`)
- Meal Planner: add items to a day, click "AI Plan" -- confirm portions are assigned within calorie/macro targets
- Error handling: temporarily use a bad API key to confirm error messages appear correctly
- Verify the existing "Generate" button still works (deterministic solver unchanged)

---

## Setup required from you

1. You will be prompted to enter your `ANTHROPIC_API_KEY` (from https://console.anthropic.com/settings/keys)
2. No other configuration needed
