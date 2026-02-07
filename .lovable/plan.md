
Goal
- Fix the “Connection failed: Edge Function returned a non‑2xx status code” that happens immediately when clicking “Connect Bank” on the published site.
- Make the bank-connection flow deterministic and debuggable (clear, structured error messages), without changing unrelated features.

What’s happening (root cause, based on current code)
- The frontend calls the backend function `truelayer-auth` like this:
  - `supabase.functions.invoke("truelayer-auth", { body: { redirectUri } })`
- But the backend function `supabase/functions/truelayer-auth/index.ts` only performs actions when a URL query parameter exists:
  - `const action = url.searchParams.get('action')`
  - It expects `?action=auth-url` / `?action=exchange-code` / `?action=refresh-token`
- Because the frontend does not send `action`, the backend returns `400 { error: "Invalid action" }`.
- Supabase’s client surfaces that as the generic message: “Edge Function returned a non‑2xx status code”.

Secondary issue you will hit after the above is fixed (based on your screenshot)
- Your TrueLayer “Redirect URIs” do not include the app’s redirect URL.
- Once the app successfully redirects to TrueLayer, the authorization step will fail unless TrueLayer is configured with:
  - `https://lfinance.lovable.app/accounts?truelayer_callback=true`
- (TrueLayer notes it may take up to ~15 minutes to apply.)

Implementation plan (code changes)
1) Make `truelayer-auth` accept a deterministic request schema (body-based), while keeping backward compatibility
   - File: `supabase/functions/truelayer-auth/index.ts`
   - Update request parsing so `action` can come from either:
     1) Query string: `?action=...` (existing behavior)
     2) JSON body: `{ action: "auth-url" | "exchange-code" | "refresh-token", ... }` (new)
     3) If neither is present, return a structured 400 with an explicit message (do not fall back to “Invalid action”).
   - Add strict validation per action:
     - `auth-url`: requires `redirectUri`
     - `exchange-code`: requires `code` and `redirectUri`
     - `refresh-token`: requires `refreshToken`
   - Return structured error JSON consistently:
     - `{ error: "message", stage: "auth-url" | "exchange-code" | "refresh-token" | "validation", details?: any }`
   - Improve CORS headers to include the full recommended header list so browsers don’t fail preflight in edge cases.
     - Also include `Access-Control-Allow-Methods: GET,POST,OPTIONS` (explicit).

2) Update the frontend to always send `action` in the body (no reliance on query strings)
   - File: `src/hooks/useBankConnections.ts`
   - Start connection:
     - Call `invoke("truelayer-auth", { body: { action: "auth-url", redirectUri } })`
   - Complete connection:
     - Call `invoke("truelayer-auth", { body: { action: "exchange-code", code, redirectUri } })`
   - Refresh token:
     - Call `invoke("truelayer-auth", { body: { action: "refresh-token", refreshToken } })`

3) Make frontend error messages deterministic and informative (so you can self-diagnose next time)
   - File: `src/hooks/useBankConnections.ts`
   - Add a small helper to normalize function errors into a readable string:
     - Include HTTP status if available
     - Include backend JSON error body if available (`error.context` often contains response/body for function failures)
   - Update toast descriptions to use this normalized message, so instead of:
     - “Edge Function returned a non‑2xx status code”
     you’ll see something like:
     - “truelayer-auth (400 validation): Missing action. Expected auth-url | exchange-code | refresh-token.”

4) Fix likely next blocker: TrueLayer Redirect URI mismatch (configuration, no code)
   - In TrueLayer Console (Live, since you confirmed you’re using Live):
     - Add redirect URI exactly:
       - `https://lfinance.lovable.app/accounts?truelayer_callback=true`
     - Remove/replace the incorrect/incomplete one currently shown (it won’t match what the app uses).
     - Keep `http://localhost:3000/callback` only if you still test locally; it does not help the published site.
   - Note: TrueLayer may take up to 15 minutes to apply redirect URI changes.

5) Hardening (recommended, small, and deterministic)
   - Clean up “pending” connections when `startConnection` fails:
     - Today the code inserts a pending DB record before calling `truelayer-auth`.
     - If `truelayer-auth` fails, you’ll end up with orphaned “pending” rows.
   - Update `startConnection` mutation to:
     - `insert pending row` → `invoke auth-url`
     - if invoke fails: best-effort delete that pending row before showing the toast.

6) Validate end-to-end (test checklist)
   - After implementing steps (1)-(3):
     - Go to Accounts → Connect Bank
     - Expected result: you are redirected to TrueLayer (no immediate red error banner)
   - After step (4):
     - Complete the TrueLayer flow
     - Expected result: you return to `/accounts?truelayer_callback=true&code=...` and see “Connecting your bank…” followed by “Bank connected!”
   - If anything still fails:
     - Use the now-detailed toast message to identify the stage (auth-url vs exchange-code).
     - Check backend function logs for the same stage label and details.

Files involved (expected edits)
- `supabase/functions/truelayer-auth/index.ts` (action parsing, validation, CORS, structured errors)
- `src/hooks/useBankConnections.ts` (send action explicitly + better error display + pending cleanup)

Notes on publishing
- These changes include frontend code changes, so they will require publishing to update the live site after implementation.
- Secret updates do not require republishing, but this fix is code-level.

Out of scope (explicitly not doing now)
- Changing TrueLayer provider selection logic, adding provider picker UI, or implementing extra security features like PKCE/state persistence in DB. (We can add later once the core flow is stable.)
