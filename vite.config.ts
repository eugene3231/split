/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@pages': path.resolve(__dirname, 'src/pages'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/shared/logic/computation/**/*.ts',
        'src/shared/api/storage.ts',
        'src/features/receipt-import/logic/ocr.ts',
      ],
    },
  },
})
