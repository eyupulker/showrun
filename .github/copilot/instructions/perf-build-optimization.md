# Build Performance Optimization Guide

## Overview
ShowRun uses a pnpm monorepo with 7 packages. Build performance directly impacts development velocity and CI turnaround time.

## Current Build Architecture

### Build command flow:
```bash
pnpm build
# Executes: pnpm -r --filter=!showrun build && pnpm --filter=showrun build
```

**Why this ordering?** The `showrun` package depends on all others, so they build first.

### Per-package build tools:
- **core, harness, mcp-server:** `tsup` (fast, bundles dependencies)
- **dashboard:** `tsc && vite build` (TypeScript + Vite SPA bundler)
- **showrun:** `tsup && tsc --emitDeclarationOnly && node scripts/copy-assets.js`

## Known Bottlenecks

### 1. Redundant Compilation (HIGH PRIORITY)
**Dashboard:** Runs `tsc && vite build` - Vite already compiles TypeScript, so `tsc` may be redundant.

**Quick test:**
```bash
cd packages/dashboard
rm -rf dist
time (tsc && vite build)  # Current approach
rm -rf dist
time vite build            # Vite alone
# Compare output and check if .d.ts files are needed
```

**Fix if redundant:** Update `packages/dashboard/package.json` to remove `tsc &&`.

**Showrun:** Triple compilation (`tsup && tsc --emitDeclarationOnly && copy-assets`)

**Optimization:** Investigate if tsup can emit declarations directly with `dts: true` option.

### 2. Incremental Build Validation
**Current state:** Root `tsconfig.json` has `composite: true` and `incremental: true`.

**Test incremental builds:**
```bash
pnpm build                    # Clean build
touch packages/core/src/loader.ts
time pnpm build               # Should be <5s for incremental
```

**If slow:** Check `.tsbuildinfo` files are being created and used.

### 3. Parallel Build Opportunities
**Current:** `pnpm -r` builds packages in parallel by default, respecting dependencies.

**Optimization:** Verify workspace dependencies in `package.json` are accurate so pnpm can maximize parallelism.

```bash
# Check dependency graph
pnpm list --depth 1 --json | jq '.[] | {name: .name, deps: .dependencies | keys}'
```

## Build Caching

### CI caching (already implemented in PRs #50, #40):
- pnpm store cache
- node_modules cache
- TypeScript `.tsbuildinfo` cache

**Validation:**
```bash
# In CI, check for cache hit logs:
# "Cache restored from key: node-modules-..."
```

### Local caching:
- Use `pnpm store path` to locate local cache
- `.tsbuildinfo` files should persist between builds

## Quick Performance Wins

### 1. Profile build times:
```bash
time pnpm -r build --stream 2>&1 | tee build.log
# Analyze which package takes longest
```

### 2. Check for unnecessary dependencies:
```bash
cd packages/core
pnpm why playwright  # Should only be in harness/core
```

### 3. Optimize tsup configuration:
```typescript
// In package build scripts, check for:
{
  "build": "tsup --minify"  // Minification slows builds, often unnecessary for Node.js
}
// Consider: "build": "tsup" (no minify)
```

## Measurement Workflow

### Baseline (clean build):
```bash
rm -rf packages/*/dist node_modules/.cache
pnpm install
time pnpm build  # Record time
```

### Incremental (hot build):
```bash
touch packages/core/src/types.ts
time pnpm build  # Should be <10s
```

### CI simulation:
```bash
# With caching
time (pnpm install --frozen-lockfile && pnpm build && pnpm test:unit)
```

## Success Metrics
- **Clean build:** <30s (currently unknown baseline)
- **Incremental build:** <5s for single-package changes
- **CI build + test:** <5 minutes (currently 10-minute timeout)
- **No redundant TypeScript passes:** Max 1 tsc per package

## Related Files
- Root `tsconfig.json` - Incremental and composite settings
- `package.json` scripts - Build orchestration
- `.github/workflows/ci.yml` - CI build configuration
- Individual `packages/*/package.json` - Per-package build scripts
