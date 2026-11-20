/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

const surfaceColor = '#f4f5f7';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeManifestIcons: false,
      injectRegister: false,
      manifest: {
        id: '/',
        name: 'Split',
        short_name: 'Split',
        description: 'Split a bill with friends.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: surfaceColor,
        background_color: surfaceColor,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
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
