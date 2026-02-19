# Network Capture Performance Guide

## Overview
ShowRun's network capture system records all HTTP requests/responses during task pack execution. This is critical for debugging and HTTP replay, but can become a performance bottleneck with high request volumes.

## Architecture

### Key files:
- `packages/core/src/networkCapture.ts` - Buffer management, search, export
- `packages/core/src/dsl/stepHandlers.ts` - Network step handlers (wait_for_request, etc.)

### Current implementation:
- **Rolling buffer:** 300 entries max, 50MB total size limit
- **Search methods:** Linear scan with filter matching
- **Compression:** gzip decompression on demand (not cached)

## Performance Bottlenecks

### 1. Linear Buffer Scanning (CRITICAL)
**Location:** `networkCapture.ts` lines 355-366 (`getRequestIdByIndex`)

**Problem:** Every search iterates the entire buffer (300+ entries).

**Measurement:**
```typescript
// Add timing to search operations
const start = Date.now();
const requestId = ctx.networkCapture.getRequestIdByIndex(where, pick);
const duration = Date.now() - start;
if (duration > 100) {
  console.warn(`Slow network search: ${duration}ms for ${buffer.length} entries`);
}
```

**Optimization approach:**
```typescript
// Index by URL prefix
private urlIndex = new Map<string, Set<string>>(); // prefix -> requestIds

// Index by status code
private statusIndex = new Map<number, Set<string>>(); // status -> requestIds

// On entry add:
addEntry(entry) {
  buffer.push(entry);
  
  // Build indexes
  const urlPrefix = new URL(entry.url).origin;
  if (!urlIndex.has(urlPrefix)) urlIndex.set(urlPrefix, new Set());
  urlIndex.get(urlPrefix).add(entry.id);
  
  if (!statusIndex.has(entry.status)) statusIndex.set(entry.status, new Set());
  statusIndex.get(entry.status).add(entry.id);
}

// In search:
getRequestIdByIndex(where, pick) {
  let candidates = buffer;
  
  // Use indexes to narrow search
  if (where.url && !where.url.includes('*')) {
    const origin = new URL(where.url).origin;
    const indexedIds = urlIndex.get(origin);
    if (indexedIds) {
      candidates = buffer.filter(e => indexedIds.has(e.id));
    }
  }
  
  if (where.status) {
    const indexedIds = statusIndex.get(where.status);
    if (indexedIds) {
      candidates = candidates.filter(e => indexedIds.has(e.id));
    }
  }
  
  // Now search smaller candidate set
  return candidates.find(matchesWhere);
}
```

### 2. Repeated Decompression (HIGH PRIORITY)
**Location:** `networkCapture.ts` lines 244-246

**Problem:** `responseContains` regex searches decompress bodies on every call.

**Measurement:**
```bash
# Create task pack that:
# 1. Makes request with gzipped response (common)
# 2. Calls wait_for_request with responseContains multiple times
# 3. Check timing - each call re-decompresses
```

**Optimization:**
```typescript
class NetworkEntryInternal {
  private decompressedBodyCache?: Buffer;
  
  async getDecompressedBody(): Promise<Buffer> {
    if (this.decompressedBodyCache) {
      return this.decompressedBodyCache;
    }
    
    const body = await this.getBody();
    if (this.encoding === 'gzip') {
      this.decompressedBodyCache = await gunzip(body);
    } else {
      this.decompressedBodyCache = body;
    }
    
    return this.decompressedBodyCache;
  }
}
```

**Trade-off:** Increases memory usage. Consider LRU cache for large responses.

### 3. Polling Inefficiency
**Location:** `stepHandlers.ts` lines 506-514 (wait_for_request polling)

**Problem:** Fixed-interval polling calls `getRequestIdByIndex` repeatedly.

**Current:**
```typescript
while (Date.now() < deadline) {
  await sleepMs(pollIntervalMs);
  requestId = ctx.networkCapture!.getRequestIdByIndex(where, pick);
  if (requestId != null) break;
}
```

**Optimization - Event-driven approach:**
```typescript
// In networkCapture.ts
class NetworkCapture {
  private eventEmitter = new EventEmitter();
  
  addEntry(entry) {
    buffer.push(entry);
    this.eventEmitter.emit('request-added', entry);
  }
  
  async waitForRequest(where, pick, timeout) {
    // Check existing entries first
    const existing = this.getRequestIdByIndex(where, pick);
    if (existing) return existing;
    
    // Wait for new matching request
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject('timeout'), timeout);
      
      const listener = (entry) => {
        if (matchesWhere(entry, where)) {
          clearTimeout(timer);
          this.eventEmitter.off('request-added', listener);
          resolve(entry.id);
        }
      };
      
      this.eventEmitter.on('request-added', listener);
    });
  }
}
```

### 4. Regex Compilation
**Problem:** Inline regex patterns re-compiled on every match.

**Quick fix:**
```typescript
// Before:
if (where.url && !new RegExp(where.url).test(entry.url)) return false;

// After (at module level):
const regexCache = new Map<string, RegExp>();
function getRegex(pattern: string): RegExp {
  if (!regexCache.has(pattern)) {
    regexCache.set(pattern, new RegExp(pattern));
  }
  return regexCache.get(pattern);
}

// In match function:
if (where.url && !getRegex(where.url).test(entry.url)) return false;
```

## Testing Network Performance

### Synthetic benchmark:
```typescript
// Create task pack with:
// 1. Navigate to page with 200+ requests
// 2. Use wait_for_request with complex regex
// 3. Measure time for first vs. last request match

{
  "flow": [
    { "step": "navigate", "url": "https://example.com/heavy-page" },
    { "step": "wait_for_request", "where": { "url": "/api/users/.*" }, "save_to": "first" },
    { "step": "wait_for_request", "where": { "url": "/api/posts/.*" }, "save_to": "last" }
  ]
}
```

**Check event logs:** Compare `durationMs` for wait_for_request steps.

### Memory profiling:
```bash
node --expose-gc --max-old-space-size=512 packages/showrun/dist/cli.js run ./taskpacks/network-heavy --inputs '{}'
# Watch for memory spikes in buffer growth
```

## Buffer Configuration

### Current limits:
```typescript
maxEntries: 300
maxTotalBytes: 50 * 1024 * 1024  // 50MB
```

**When to adjust:**
- Long-running automations with >300 requests need higher limits
- Memory-constrained environments need lower limits

**Monitoring:**
```typescript
// Add metrics
console.log(`Network buffer: ${buffer.length} entries, ${totalBytes / 1024 / 1024}MB`);
```

## Success Metrics
- **Search latency:** <10ms for 300-entry buffer (currently O(n) → target O(log n))
- **Decompression:** Cache hit rate >80% for repeated access
- **Polling overhead:** Eliminate with event-driven approach
- **Memory usage:** <100MB for 300 entries with compression

## Related Files
- `packages/core/src/networkCapture.ts` - Core implementation
- `packages/core/src/dsl/stepHandlers.ts` - Network step handlers
- `packages/core/src/types.ts` - NetworkCapture interface
