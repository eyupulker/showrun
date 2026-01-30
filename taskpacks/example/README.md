# TypeScript Example Task Pack

This example demonstrates a **TypeScript task pack** using DSL builders - full IDE support, type checking, and build step required.

## What it does

1. Navigates to https://example.com
2. Extracts the page title
3. Extracts the text from the first `<h1>` element

## Collectibles

- `page_title` (string): The page title from the `<title>` tag
- `h1_text` (string): The text content of the first `<h1>` element

## Usage

After building, run with:

```bash
tp run --pack ./taskpacks/example --inputs '{}'
```
