## 2024-05-24 - Semantic Buttons for Collapsible Sections
**Learning:** Using `div` with `onClick` for collapsible headers is bad for accessibility because it lacks keyboard focus and proper ARIA states.
**Action:** Replaced `div` with `<button type="button">`, added `aria-expanded` and `aria-controls`, and used CSS to reset button styles so they look like the original headers but behave like buttons. Used `React.useId()` for robust ARIA ID generation.
