# Dashboard Performance Optimization Guide

## Overview
The ShowRun dashboard is a React + Vite SPA with real-time Socket.IO updates. It displays run history, live execution events, and Teach Mode AI agent interactions.

## Performance Measurement

### Frontend metrics:
```bash
# 1. Build the dashboard
pnpm build

# 2. Start the dashboard server
node packages/showrun/dist/cli.js dashboard --packs ./taskpacks

# 3. Open browser DevTools:
# - Performance tab: Record page load
# - Network tab: Check bundle sizes
# - Lighthouse: Run audit for Core Web Vitals
```

### Key metrics to track:
- **First Contentful Paint (FCP):** Target <1.5s
- **Largest Contentful Paint (LCP):** Target <2.5s
- **Time to Interactive (TTI):** Target <3.5s
- **Bundle size:** Main bundle should be <500KB gzipped

## Known Performance Concerns

### 1. Database Query Performance (HIGH PRIORITY)
**Issue:** Dashboard uses `.all()` without pagination on large datasets.

**Files affected:**
- `packages/dashboard/src/server.ts` - Run/conversation queries
- `packages/dashboard/src/db.ts` - Database operations

**Quick test:**
```bash
# Create 100+ runs in database, then check dashboard load time
# Watch for slow queries in server logs
```

**Optimization strategy:**
```typescript
// Before: SELECT * FROM runs ORDER BY created_at DESC
// After: SELECT * FROM runs ORDER BY created_at DESC LIMIT 50 OFFSET ?

// Implement pagination:
io.on('connection', (socket) => {
  socket.on('load-more-runs', (page) => {
    const runs = db.getRuns(page * 50, 50);
    socket.emit('runs-page', runs);
  });
});
```

### 2. Real-time Event Streaming
**Issue:** High-frequency socket events (step updates, network captures) may overwhelm React rendering.

**Measurement:**
```typescript
// Add performance marks in React components:
performance.mark('render-start');
// ... render logic
performance.mark('render-end');
performance.measure('render-time', 'render-start', 'render-end');
```

**Optimization techniques:**
- Debounce rapid updates (e.g., every 100ms)
- Batch socket events before state updates
- Use `useMemo` and `React.memo` for expensive components

**Example:**
```typescript
// Debounce socket updates
const debouncedUpdate = useMemo(
  () => debounce((data) => setRunData(data), 100),
  []
);

socket.on('run-update', debouncedUpdate);
```

### 3. List Virtualization (RECOMMENDED)
**Issue:** Rendering 1000+ run history items or event log entries causes UI lag.

**Solution:** Use `react-window` or `react-virtual` for long lists.

```bash
pnpm add react-window
```

**Implementation:**
```tsx
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={runs.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <RunListItem run={runs[index]} />
    </div>
  )}
</FixedSizeList>
```

### 4. Bundle Size Optimization
**Current approach:** Vite default code splitting.

**Quick checks:**
```bash
cd packages/dashboard
pnpm build
ls -lh dist/assets/*.js  # Check bundle sizes
```

**Optimization strategies:**
- Route-level code splitting (lazy load pages)
- Tree-shake unused libraries
- Check for duplicate dependencies (`pnpm why <package>`)

**Example route splitting:**
```tsx
const TeachMode = lazy(() => import('./pages/TeachMode'));
const RunHistory = lazy(() => import('./pages/RunHistory'));

<Suspense fallback={<Loading />}>
  <Routes>
    <Route path="/teach" element={<TeachMode />} />
    <Route path="/history" element={<RunHistory />} />
  </Routes>
</Suspense>
```

## Frontend-Specific Optimizations

### Context management (Teach Mode):
**Issue:** `packages/dashboard/src/contextManager.ts` scans full message history repeatedly for token counting.

**Optimization:**
```typescript
// Maintain incremental token count instead of recalculating
class ContextManager {
  private totalTokens = 0;
  
  addMessage(msg: Message) {
    const tokens = this.estimateTokens(msg);
    this.totalTokens += tokens;
    // Store token count with message
    msg._tokenCount = tokens;
  }
  
  removeMessage(msg: Message) {
    this.totalTokens -= msg._tokenCount;
  }
}
```

### Browser inspector caching:
**Issue:** `getDomSnapshot()` called frequently without caching.

**Optimization:**
```typescript
const snapshotCache = new Map<string, { snapshot: any, timestamp: number }>();

getDomSnapshot() {
  const url = page.url();
  const cached = snapshotCache.get(url);
  
  if (cached && Date.now() - cached.timestamp < 5000) {
    return cached.snapshot;
  }
  
  const snapshot = await page.evaluate(/* ... */);
  snapshotCache.set(url, { snapshot, timestamp: Date.now() });
  return snapshot;
}
```

## Testing Performance Changes

### Before/after comparison:
1. Record baseline Lighthouse score
2. Make optimization
3. Re-run Lighthouse, compare metrics
4. Verify no functionality broken

### Load testing:
```bash
# Simulate heavy load
for i in {1..50}; do
  curl http://localhost:3000/api/runs &
done
wait
# Check server response times
```

## Success Metrics
- **Page load time:** <2s on 3G connection
- **UI interaction latency:** <100ms for button clicks
- **Run list with 1000+ items:** No visible lag when scrolling
- **Bundle size:** Main chunk <500KB, lazy chunks <200KB each
- **Database query time:** <200ms for paginated queries

## Related Files
- `packages/dashboard/src/server.ts` - Express + Socket.IO server
- `packages/dashboard/src/App.tsx` - React root component
- `packages/dashboard/src/contextManager.ts` - Token management
- `packages/dashboard/src/browserInspector.ts` - DOM snapshot caching
- `packages/dashboard/vite.config.ts` - Build configuration
