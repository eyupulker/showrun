## 2024-02-27 - [Aria Labels]
**Learning:** Added `aria-label` to icon-only buttons (`header-back` and `delete-btn`) in `packages/dashboard/src/ui/App.tsx` and `packages/dashboard/src/ui/Sidebar.tsx` to ensure accessibility for screen readers.
**Action:** Always verify that icon-only interactive elements contain accessible labels using `aria-label` or visually hidden text.