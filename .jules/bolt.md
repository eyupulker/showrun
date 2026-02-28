# Bolt's Journal
## 2024-05-18 - [TaskPackLoader File I/O Blocking]
**Learning:** Synchronous file I/O operations (`readFileSync`, `existsSync`) in widely-used helper functions like `TaskPackLoader.loadTaskPack` cause main thread blocking, specifically because it performs sequential I/O operations for manifest, flow data, and snapshots.
**Action:** Replaced sequential synchronous I/O with concurrent asynchronous I/O (`fs/promises.readFile` inside `Promise.all()`) and caught `ENOENT` to safely handle optional files, improving main thread performance without changing behavior.