#!/bin/bash
echo "=== Benchmarking Build ==="

# Function to run build and measure time
run_build() {
    local label=$1
    echo "Running build: $label..."
    { time pnpm build > /dev/null 2>&1 ; } 2>&1 | grep real
}

# 1. Clean build
echo "Cleaning dist directories..."
rm -rf dist packages/*/dist

run_build "Full Clean Build"

# 2. No-change build
run_build "No-change Build"

# 3. Small change build
echo "Making a small change in packages/core/src/index.ts..."
echo "// benchmark comment" >> packages/core/src/index.ts
run_build "Small Change Build (core)"

# Cleanup small change (portable way to remove last line)
head -n -1 packages/core/src/index.ts > packages/core/src/index.ts.tmp && mv packages/core/src/index.ts.tmp packages/core/src/index.ts
