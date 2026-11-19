import { defineConfig } from '@vite-pwa/assets-generator/config';

const surface = '#f4f5f7';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [192, 512], favicons: [] },
    maskable: { sizes: [512], resizeOptions: { background: surface } },
    apple: { sizes: [180], resizeOptions: { background: surface } },
  },
  images: ['public/favicon.svg'],
});
