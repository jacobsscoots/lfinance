
# Fix Nutrition URL Import - Not Extracting Data

## Problem Identified

The URL import appears to succeed (Firecrawl successfully fetches the page), but the AI returns `null` for almost all fields. Testing revealed that **Tesco's anti-bot protection is still blocking the content** - Firecrawl is returning a "security check failed" error page instead of the actual product data.

The edge function doesn't detect this blocked page and passes it to the AI, which then correctly cannot extract any product information.

---

## Solution

### 1. Enhanced Firecrawl Configuration

Add parameters to better handle JavaScript-rendered pages:
- **waitFor**: Wait for dynamic content to load (5000ms for supermarket sites)
- **timeout**: Increase timeout for slow-loading pages
- These settings help Firecrawl fully render the page before capturing content

### 2. Detect Blocked/Error Pages

Add validation to detect when the fetched content is actually a block page:
- Check for common error indicators: "security check", "blocked", "captcha"
- Verify the HTML contains expected product data elements
- Return a helpful error message when blocked

### 3. Use Markdown for AI Extraction

Firecrawl's markdown output is cleaner and more token-efficient than raw HTML:
- Prefer markdown when available
- Fall back to HTML if markdown is empty
- Reduces noise and improves extraction accuracy

### 4. Add Debug Logging

Log the first portion of received content to help diagnose issues:
- Shows what Firecrawl actually returned
- Makes future debugging easier

### 5. Improved Error Messages

When a block is detected:
- Tell users the site has strong anti-bot protection
- Suggest using "Upload Photo" or "Paste Text" as alternatives

---

## File Changes

| File | Changes |
|------|---------|
| `supabase/functions/extract-nutrition/index.ts` | Enhanced Firecrawl config, block detection, better logging |

---

## Technical Details

### Firecrawl Configuration Update

```typescript
body: JSON.stringify({
  url,
  formats: ["markdown", "html"],
  onlyMainContent: false,
  waitFor: 5000, // Wait for JS content
  timeout: 30000,
})
```

### Block Detection Logic

```typescript
// Detect if page is a block/error page
const blockIndicators = [
  "security check",
  "something is not right",
  "access denied",
  "captcha",
  "please verify"
];

const contentLower = (markdown || html).toLowerCase();
const isBlocked = blockIndicators.some(indicator => 
  contentLower.includes(indicator)
);

if (isBlocked) {
  throw new Error("This website's anti-bot protection blocked the request...");
}
```

### Content Priority

```typescript
// Prefer markdown (cleaner), fall back to HTML
const contentForAi = markdown && markdown.length > 200 
  ? markdown 
  : html;
```

---

## Expected Outcome

After these changes:
- Blocked pages are detected and users get clear feedback
- Working pages have better extraction due to markdown usage
- Debug logging helps diagnose future issues
- Clear guidance is provided when a site cannot be scraped
