import { describe, expect, it } from 'vitest';
import { personHeaderLayout } from './personHeaderLayout';

describe('person header layout', () => {
  it('preserves every character of long names and expands the header for their lines', () => {
    const measure = (text: string) => text.length * 10;
    const short = personHeaderLayout({ name: 'Alice', nameWidth: 100, conversion: false, measure });
    const long = personHeaderLayout({
      name: 'Alexandria Montgomery',
      nameWidth: 100,
      conversion: false,
      measure,
    });
    expect(long.lines.join(' ')).toBe('Alexandria Montgomery');
    expect(long.height).toBeGreaterThan(short.height);
    expect(long.lines.every((line) => measure(line) <= 100)).toBe(true);
  });
  it('wraps a name without spaces without dropping its suffix', () => {
    const layout = personHeaderLayout({
      name: 'AlexandriaMontgomery',
      nameWidth: 60,
      conversion: true,
      measure: (text) => text.length * 10,
    });
    expect(layout.lines.join('')).toBe('AlexandriaMontgomery');
    expect(layout.height).toBe(178);
  });
});
