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
          exclude: [
            '**/node_modules/**',
            '.claude/**',
            '.worktrees/**',
            'src/tests/integration/**',
          ],
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
          exclude: ['**/node_modules/**', '.claude/**', '.worktrees/**'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        '**/index.ts',
        '**/personBreakdownImage.ts',
        '**/overviewImage.ts',
        '**/canvas/draw.ts',
        '**/types.ts',
        '**/constants.ts',
        '**/testHelpers.ts',
        'src/main.tsx',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
