/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'src/shared'),
      '@features': path.resolve(import.meta.dirname, 'src/features'),
      '@pages': path.resolve(import.meta.dirname, 'src/pages'),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: {
            label: 'unit',
            color: 'green',
          },
          environment: 'jsdom',
          setupFiles: ['./src/tests/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['**/node_modules/**', '.claude/**', 'src/tests/integration/**'],
        },
      },
      {
        extends: true,
        test: {
          name: {
            label: 'integration',
            color: 'blue',
          },
          environment: 'jsdom',
          setupFiles: ['./src/tests/setup.ts'],
          include: ['src/tests/integration/**/*.test.ts'],
          exclude: ['**/node_modules/**', '.claude/**'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        '**/ocrFixtures.ts',
        '**/index.ts',
        '**/receiptSplitImage*.ts',
        '**/types.ts',
        '**/constants.ts',
        '**/components/**',
        '**/pages/components/**',
        '**/testHelpers.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
