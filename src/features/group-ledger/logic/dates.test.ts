import { describe, expect, it } from 'vitest';
import { dateLabel, timeAgo } from './dates';
import { asLocalDate } from './ids';

const today = asLocalDate('2026-11-19');

describe('dateLabel', () => {
  it('names today and yesterday, and spells out other days', () => {
    expect(dateLabel(today, today)).toBe('Today');
    expect(dateLabel(asLocalDate('2026-11-18'), today)).toBe('Yesterday');
    expect(dateLabel(asLocalDate('2026-11-16'), today)).toBe('Mon 16 Nov');
    expect(dateLabel(asLocalDate('2025-12-31'), today)).toBe('Wed 31 Dec 2025');
  });

  it('knows yesterday across a month end', () => {
    expect(dateLabel(asLocalDate('2026-11-30'), asLocalDate('2026-12-01'))).toBe('Yesterday');
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-11-19T12:00:00Z');

  it('rounds down to the largest unit that fits', () => {
    expect(timeAgo('2026-11-19T11:59:30Z', now)).toBe('just now');
    expect(timeAgo('2026-11-19T11:55:00Z', now)).toBe('5 min ago');
    expect(timeAgo('2026-11-19T09:00:00Z', now)).toBe('3 h ago');
    expect(timeAgo('2026-11-18T09:00:00Z', now)).toBe('yesterday');
    expect(timeAgo('2026-11-15T12:00:00Z', now)).toBe('4 days ago');
  });
});
