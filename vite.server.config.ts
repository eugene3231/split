import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'src/shared'),
      '@features': path.resolve(import.meta.dirname, 'src/features'),
      '@pages': path.resolve(import.meta.dirname, 'src/pages'),
    },
  },
  publicDir: false,
  ssr: { noExternal: true },
  build: {
    ssr: 'server/main.ts',
    target: 'node24',
    outDir: 'dist/server',
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'main.js', format: 'esm' } },
  },
});
