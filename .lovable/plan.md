

## Fix: Gmail OAuth redirect and build errors

### Problem
Two issues need fixing:

1. **Gmail OAuth redirects to wrong URL**: After connecting Gmail, the OAuth callback redirects to `ekahzylmgbngjngkirhl.lovableproject.com` (which shows "Publish or update your Lovable project"). The `getAppUrl()` fallback in the `gmail-oauth` edge function constructs this incorrect URL. It should use the preview URL as the fallback instead.

2. **Build errors**: Five edge functions have `error.message` on a value of type `unknown` -- a TypeScript strict mode issue.

### Changes

**1. Fix `supabase/functions/gmail-oauth/index.ts`**
- Change `getAppUrl()` fallback from `lovableproject.com` to use the preview URL format: `https://id-preview--{projectId}.lovable.app` (matching the actual preview URL pattern).
- Also fix the `error.message` TypeScript error on the catch block (cast error to `Error`).

**2. Fix TypeScript errors in 4 other edge functions**
- `supabase/functions/analyze-usage-ai/index.ts` (line 369)
- `supabase/functions/compare-energy-deals/index.ts` (line 493)
- `supabase/functions/fetch-etf-price/index.ts` (line 137)
- `supabase/functions/gmail-sync-receipts/index.ts` (line 392)

For each, change `error.message` to `(error as Error).message` or use a ternary with `instanceof Error`.

### Technical detail
The `getAppUrl()` function is only a fallback -- the client already sends `window.location.origin` in the OAuth state parameter, and the callback extracts it. However, if state parsing fails for any reason, the fallback kicks in. Fixing the fallback URL ensures robustness.

