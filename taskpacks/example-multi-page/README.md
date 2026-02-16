# Multi-page Data Collection Example

This taskpack demonstrates how to collect data across multiple pages using the `collectibles` array and tab management steps.

## Key Features Demonstrated

- **`new_tab`**: Opens a new browser tab and navigates to a URL.
- **`switch_tab`**: Switches between open tabs, optionally closing the current tab.
- **Collectible Access in Templates**: Uses previously extracted data from the `collectibles` array in subsequent step parameters (e.g., navigating to URLs extracted from a listing page).
- **Data Aggregation**: Aggregates extracted data from multiple pages into a single set of collectibles.

## How it Works

1. **Navigate to Listing**: The flow starts by navigating to the "Web Browsers" category on Wikipedia.
2. **Extract Links**: All browser links from the listing are extracted into the `browser_links` collectible as an array.
3. **Visit First Browser**:
   - `new_tab` is used to open the first link: `https://en.wikipedia.org{{ collectibles.browser_links[0] }}`.
   - The page title is extracted into `browser1_title`.
   - `switch_tab` closes the browser tab and returns to the main listing tab (`tab: 0`).
4. **Visit Second Browser**:
   - `new_tab` is used to open the second link: `https://en.wikipedia.org{{ collectibles.browser_links[1] }}`.
   - The page title is extracted into `browser2_title`.
5. **Final Result**: The taskpack returns all extracted collectibles, including the list of links and the specific titles extracted from sub-pages.

## Core Improvements

To support this example, the following core framework improvements were implemented:
- Added `collectibles` to the `VariableContext` used for template resolution.
- Fixed the interpreter to correctly switch execution context (the `Page` object) after `new_tab` and `switch_tab` steps.
