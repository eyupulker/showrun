# Runtime Performance Optimization Guide

## Overview
This guide covers performance optimization for ShowRun's core execution engine - the Playwright-based task pack runner that powers all automation workflows.

## Key Performance Areas

### 1. Browser Lifecycle Management
**Current state:** Each task pack run creates a new browser instance (~2-3s startup overhead).

**Quick measurement:**
```bash
time node packages/showrun/dist/cli.js run ./taskpacks/example-json --inputs '{}'
```

**Optimization opportunities:**
- Browser instance pooling (eliminate repeated startup)
- Persistent browser contexts for related tasks
- Lazy browser initialization for HTTP-only flows

**Trade-offs:** Pooling increases memory usage, requires lifecycle management.

### 2. Step Execution Parallelization
**Current state:** All steps execute sequentially, even when independent.

**Measurement approach:**
- Check `durationMs` in run event logs: `./runs/<timestamp>/events.jsonl`
- Sum step durations to identify parallelization potential

**Example optimization:**
```typescript
// Sequential: navigate, wait for selector, extract_text
// Could parallelize: Multiple extract_text steps after page load
```

**Implementation notes:**
- Analyze step dependencies (read vs. write operations)
- Network capture steps must remain sequential per URL
- DOM steps can parallelize if reading different elements

### 3. Network Capture Buffer Performance
**Current bottleneck:** Linear buffer scans in `getRequestIdByIndex()` iterate 300+ entries.

**Quick test:**
```bash
# Create a task pack that makes 100+ requests, then uses wait_for_request with regex
# Measure time difference between early vs. late request matching
```

**Optimization strategies:**
- Add indexed lookups (URL prefix tree, status code map)
- Cache regex compilation
- Implement binary search for sorted buffers

**Known issue:** `responseContains` regex decompresses bodies repeatedly (line 244-246 in networkCapture.ts).

### 4. Caching Opportunities

**Already implemented:**
- "Once" step cache (auth resilience)
- Network entry map
- Pack metadata cache

**Missing caches:**
- Decompressed HTTP response bodies (frequent reuse in network capture)
- JMESPath expression results (extracted collectibles)
- Parsed JSON responses (avoid re-parsing in multiple steps)

**Implementation pattern:**
```typescript
// LRU cache with size limits
const cache = new Map<string, CachedValue>();
if (cache.has(key) && !isExpired(cache.get(key))) {
  return cache.get(key).value;
}
```

## Performance Testing Workflow

### Baseline measurement:
1. Run example task packs 10x, record median runtime
2. Check event logs for step timing breakdown
3. Identify slowest operations (browser start, network wait, DOM queries)

### Synthetic benchmarks:
```bash
# Network-heavy flow
node packages/showrun/dist/cli.js run ./taskpacks/network-test --inputs '{}'

# DOM-heavy flow  
node packages/showrun/dist/cli.js run ./taskpacks/dom-test --inputs '{}'
```

### Profiling with Node.js:
```bash
node --prof packages/showrun/dist/cli.js run ./taskpacks/example-json --inputs '{}'
node --prof-process isolate-*.log > profile.txt
```

## Success Metrics
- **Browser startup:** Target <500ms (from current 2-3s)
- **Step latency:** Simple steps <100ms
- **Network capture lookup:** O(log n) instead of O(n)
- **Cache hit rate:** >70% for repeated requests

## Related Files
- `packages/core/src/runner.ts` - Main execution loop
- `packages/core/src/networkCapture.ts` - Buffer management
- `packages/core/src/dsl/stepHandlers.ts` - Step execution
- `packages/core/src/authResilience.ts` - Caching example
