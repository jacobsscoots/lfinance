

# Fix Error Display for Blocked URL Imports

## Problem

When a supermarket website blocks the scraping request, the edge function correctly detects this and throws an error with a helpful message. However, the error is returned with a **500 status code**, which causes the client to display a generic "Edge Function returned a non-2xx status code" instead of the actual helpful error message.

---

## Solution

Return blocked URL errors with a **200 status code** but with `success: false` in the response body. This allows the client to properly read and display the error message.

### Current Behavior (Incorrect)
```typescript
// Line 111-116 in extract-nutrition/index.ts
catch (e) {
  return new Response(
    JSON.stringify({ success: false, error: e.message }),
    { status: 500, headers: { ... } }  // ❌ 500 causes generic error
  );
}
```

### Fixed Behavior
```typescript
catch (e) {
  const isUserError = e.message.includes("anti-bot") || 
                      e.message.includes("blocking") ||
                      e.message.includes("blocked");
  
  return new Response(
    JSON.stringify({ success: false, error: e.message }),
    { 
      status: isUserError ? 200 : 500,  // ✅ 200 for user-facing errors
      headers: { ... } 
    }
  );
}
```

---

## Why This Works

- **200 status with `success: false`**: The client can read the JSON response body and extract the error message
- **500 status**: The client treats this as a server failure and shows a generic error
- Many expected error conditions (blocked sites, invalid URLs, rate limits) are not server failures - they're user-actionable situations

---

## File to Modify

| File | Changes |
|------|---------|
| `supabase/functions/extract-nutrition/index.ts` | Return 200 status for user-facing errors instead of 500 |

---

## Technical Details

### Error Categories

| Error Type | Status | Reason |
|------------|--------|--------|
| Anti-bot blocked | 200 | User should try different method |
| Rate limit | 200 | User should wait and retry |
| Invalid input | 400 | Client error, already correct |
| Server/config error | 500 | Actual server problem |

### Implementation

Update the catch block in the main handler to check if the error is a user-actionable situation and return appropriate status:

```typescript
catch (e) {
  console.error("extract-nutrition error:", e);
  
  const errorMessage = e instanceof Error ? e.message : "Unknown error";
  
  // These are user-actionable errors, not server failures
  const isUserError = 
    errorMessage.includes("anti-bot") ||
    errorMessage.includes("blocking") ||
    errorMessage.includes("blocked") ||
    errorMessage.includes("Rate limit") ||
    errorMessage.includes("could not") ||
    errorMessage.includes("Try 'Upload");
  
  return new Response(
    JSON.stringify({ success: false, error: errorMessage }),
    { 
      status: isUserError ? 200 : 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}
```

---

## Expected Result

After this change, when Tesco (or other supermarkets) block the request, users will see:

> "This website's anti-bot protection blocked the request. Please try using 'Upload Photo' or 'Paste Text' instead - these methods work reliably for any product."

Instead of:

> "Edge Function returned a non-2xx status code"

