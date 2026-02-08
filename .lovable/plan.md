Combined Lovable Prompt (audit + remove Deal Scanner + responsive + security + cleanup)

You are working on my existing web app codebase. Your job is to audit the entire website end-to-end, fix what you find, and leave it stable, responsive, and secure.

0) Rules for this work

Do not rewrite the whole app or change core features unless required to fix bugs/security.

Prefer small, safe refactors over big rewrites.

Every change must compile and run.

After fixes, do a quick pass to confirm nothing broke (basic smoke test steps).

When removing features, remove routes/nav/access, then remove code safely (no broken imports).

1) Remove Deal Scanner (High Priority) — complete removal

Completely remove the “Deal Scanner” feature/page so it cannot be accessed:

Code removals (follow this exact list)

Delete src/pages/Deals.tsx

Delete src/components/deals/ directory

Remove src/hooks/useDeal*.ts hooks (Sources, Rules, Logs, Notifications)

Delete supabase/functions/scan-deals/

Update src/App.tsx routes to remove Deals route

Update src/components/layout/AppSidebar.tsx navigation to remove Deals link

Clean up related types, constants, feature flags/config (only if exclusive to Deal Scanner)

Remove any related API endpoints / background jobs / cron tasks / DB tables/columns only if strictly exclusive to Deal Scanner (if shared, leave intact)

Ensure the build passes and no imports reference deleted files

Deliverable:

Confirm Deals is fully gone (no route, no nav link, no leftover imports, no functions referencing it)

2) Full codebase audit (bugs + loose ends + unused code)

Scan the entire repo for:

Runtime errors, broken UI actions, missing/null checks, unhandled promise rejections

State issues (stale caches, incorrect invalidations, race conditions)

Bad date logic, off-by-ones, timezone handling, edge cases

Dead/unused code: unused components, unused hooks, unused API calls, unused utils, unused imports, unused CSS/classes

Duplicated logic that can be shared safely (only if it reduces bugs)

Performance issues: unnecessary re-renders, expensive loops, duplicated fetches, over-fetching

Also include the areas you already identified:

Remove unused hooks like incomplete parts of useGmailReceipts.ts

Optimize heavy calculations in Investments.tsx (memoize properly, avoid blocking main thread)

Standardize mutation error handling across hooks

Deliverables:

“Audit Summary” grouped by severity (High / Medium / Low)

Implement fixes, removing dead code and cleaning up as you go

3) Responsive UI overhaul (mobile + resizing + embedded window sizing)

Make the UI work cleanly on:

Mobile (small widths)

Tablets

Desktop

Ultra-wide

Resizing the browser window / embedded frame (no layout breaks)

Requirements (global)

Flexible layouts: proper wrapping, no fixed widths that break

No horizontal scrolling on mobile unless inside a deliberate scroll container

Tap targets are finger-friendly

Forms/modals work on small screens (scrollable modal body, sticky actions if helpful)

Navigation adapts to small screens (collapse/drawer/hamburger)

Standardize responsive breakpoints + spacing across the app

Fix “window framing” issues: viewport changes must not break layout

Specific checks (your plan)

Navigation: verify AppSidebar collapses correctly on tablets; ensure MobileNav works

Transactions: ensure filter sidebar collapses on mobile, table adapts

Investments & Cheaper Bills: convert complex grids to stack on mobile (ex: grid-cols-1 → md:grid-cols-2 etc)

Tables (Transactions, Bills, etc.): wrap in overflow-x-auto containers OR switch to mobile card views if needed

Deliverables:

Update styles/components so every page is responsive

Any tables must be usable on mobile (scroll container or card fallback)

4) Security scan + fix all security issues you find (do not skip)

Audit for and fix:

Auth/session handling mistakes

IDOR (insecure direct object references)

Missing authorization checks on server routes

XSS risks (dangerouslySetInnerHTML, unsanitized inputs, rendering user content)

CSRF concerns (if cookies/sessions used)

Injection risks (SQL/NoSQL/template injection)

Secrets handling (keys in client code, leaking env vars)

CORS misconfig

Rate limiting / abuse protection for sensitive endpoints

File upload validation (type/size/path) if uploads exist

Dependency vulnerabilities: review packages and update safely

Specific items you already flagged

XSS: refactor src/components/ui/chart.tsx to avoid dangerouslySetInnerHTML OR sanitize inputs safely

Auth race condition: improve useAuth.tsx initial session check so it’s robust

Edge Functions: review compare-energy-deals and any other functions for:

input validation

safe error handling (don’t leak internal errors to client)

Input validation: verify all form inputs (esp TransactionFormDialog) have strict Zod schemas and server-side validation where applicable

Deliverables:

“Security Findings” grouped by severity (High / Medium / Low)

For each issue: where it was + what you changed to fix it

Add safe defaults (headers/sanitization/validation) without breaking existing flows

5) Testing + verification (must do)

After all changes:

Run lint / typecheck / build

Fix errors/warnings that indicate real issues

Provide a short “How I verified” checklist (what pages/actions you tested)

Confirm: Deals is removed, responsive works on mobile widths, and no security regressions found

6) Output format (your response must follow this)

Audit Summary (High / Medium / Low)

Security Findings (High / Medium / Low)

List of patches/changes you made (grouped by area: Deals removal / Responsive / Security / Cleanup)

How I verified (short checklist)

Follow-ups you recommend (optional)

Start now by scanning the repo structure and listing the highest-risk areas before making changes, then implement the work in the order above.