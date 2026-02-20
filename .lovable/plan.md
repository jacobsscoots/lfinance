

## Fix: Force Vite Cache Invalidation for React useState Crash

### Problem
The app shows a blank screen due to `Cannot read properties of null (reading 'useState')` -- a duplicate React instance loaded from stale Vite pre-bundled dependency chunks. Previous fixes (editing `vite.config.ts`, reinstalling packages) have not invalidated the cached chunks.

### Root Cause
Vite's dependency pre-bundling cache (`node_modules/.vite`) is keyed by a hash of the config + lockfile. If the hash doesn't change, stale chunks continue to be served. The chunk hash `v=f1629243` has persisted across all previous attempts.

### Fix Strategy

Force the cache hash to change by adding explicit `optimizeDeps.include` entries for React packages. This changes the config hash Vite uses to determine if pre-bundled deps are still valid, guaranteeing a full re-bundle on next load.

### Changes

**1. `vite.config.ts`** -- Add `optimizeDeps.include` to force re-bundling:

```text
optimizeDeps: {
  force: true,
  include: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "react-dom/client",
  ],
},
```

This ensures:
- `force: true` skips any cached pre-bundle
- `include` explicitly lists React entry points so Vite bundles them into a single chunk (preventing duplicate instances)
- `dedupe` in `resolve` remains as a second safety net

**2. No application code changes** -- the `TransactionFilters.tsx` and `usePayCycleData.ts` changes from the last edit are correct and unrelated to this crash.

### Technical Detail
The full `vite.config.ts` will be:
```typescript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
  },
  dedupe: ["react", "react-dom"],
},
optimizeDeps: {
  force: true,
  include: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "react-dom/client",
  ],
},
```

