import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('installed app colours', () => {
  it('match the surface token in index.css', () => {
    const surface = read('src/index.css').match(/--color-surface: (#[0-9a-f]{6});/)?.[1];
    expect(surface).toBeDefined();

    expect(read('index.html')).toContain(`<meta name="theme-color" content="${surface}" />`);
    expect(read('vite.config.ts')).toContain(`const surfaceColor = '${surface}';`);
    expect(read('pwa-assets.config.ts')).toContain(`const surface = '${surface}';`);
  });
});
