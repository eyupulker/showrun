import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts'],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.test.ts',
        '**/__tests__/**',
        '**/scripts/**',
        '**/bin/**',
        '**/*.config.*',
        '**/taskpacks/**',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
        // Per-package thresholds
        'packages/core/**': {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
        'packages/dashboard/**': {
          lines: 70,
          functions: 70,
          branches: 70,
          statements: 70,
        },
        'packages/mcp-server/**': {
          lines: 70,
          functions: 70,
          branches: 70,
          statements: 70,
        },
        'packages/browser-inspector-mcp/**': {
          lines: 70,
          functions: 70,
          branches: 70,
          statements: 70,
        },
        'packages/taskpack-editor-mcp/**': {
          lines: 70,
          functions: 70,
          branches: 70,
          statements: 70,
        },
        'packages/harness/**': {
          lines: 75,
          functions: 75,
          branches: 75,
          statements: 75,
        },
        'packages/showrun/**': {
          lines: 60,
          functions: 60,
          branches: 60,
          statements: 60,
        },
      },
    },
  },
});
