
# Fix URL Import for Nutrition Data

## Problem

The "From URL" import feature is failing with the error "Could not access this URL. The website may be blocking automated access." This happens because UK supermarket websites like Tesco actively block server-side requests from bots.

The current edge function uses a simple `fetch()` with a basic User-Agent, which Tesco's anti-bot protection detects and blocks.

---

## Solution: Integrate Firecrawl

Firecrawl is an AI-powered web scraper specifically designed to handle websites with anti-bot protection. It's available as a connector in Lovable and is the recommended solution for this type of scraping.

### What Changes

1. **Connect Firecrawl** - You'll be prompted to set up a Firecrawl connection which provides an API key
2. **Update the edge function** - Use Firecrawl's API to fetch and parse web pages instead of direct `fetch()`
3. **Better error handling** - Provide clearer error messages when scraping fails

---

## How Firecrawl Works

Instead of:
```typescript
// Current approach - blocked by Tesco
const response = await fetch(url, { headers: { "User-Agent": "..." } });
```

We'll use:
```typescript
// Firecrawl approach - handles anti-bot protection
const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
  method: "POST",
  headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}` },
  body: JSON.stringify({ url, formats: ["markdown", "html"] })
});
```

Firecrawl handles:
- Browser-like rendering
- JavaScript execution
- Anti-bot bypass
- Clean content extraction

---

## Implementation Steps

### Step 1: Connect Firecrawl
You'll be prompted to connect Firecrawl to your project. This makes the `FIRECRAWL_API_KEY` available to the edge function.

### Step 2: Update Edge Function

**File: `supabase/functions/extract-nutrition/index.ts`**

Changes to the `extractFromUrl` function:
- Check for Firecrawl API key
- Call Firecrawl API to fetch the page content
- Handle Firecrawl-specific response format
- Fall back to direct fetch for non-blocked sites
- Provide helpful error messages

### Step 3: Improve Error Messages

When URL import fails, show specific guidance:
- "This website blocked automated access. Try the Upload or Paste Text options instead."
- Link to alternative import methods

---

## Fallback Strategy

If Firecrawl isn't connected or credits run out:
1. Attempt direct fetch first (works for many sites)
2. If blocked (403/429), show clear error with alternatives
3. Guide users to Upload Photo or Paste Text options

This ensures the feature degrades gracefully even without Firecrawl.

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/extract-nutrition/index.ts` | Add Firecrawl integration with fallback |

---

## After Implementation

Once connected, the URL import will work with:
- Tesco
- Sainsbury's  
- Asda
- Morrisons
- Waitrose
- Most other retail websites

The feature will reliably extract product name, brand, price, pack size, and full nutrition information from product pages.
