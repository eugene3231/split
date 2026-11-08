import { describe, expect, it } from 'vitest';
import { countsOn, freshDb } from '../../test/testDb';
import { createDailyCounters, singaporeDay } from './dailyCounters';

const LIMITS = { perDevice: 20, global: 200 };

function setup(start = '2026-10-31T04:00:00Z') {
  const db = freshDb();
  const clock = { now: new Date(start) };
  const counters = createDailyCounters(db, () => clock.now);
  return { db, clock, counters };
}

describe('the Singapore day', () => {
  it('ends at 16:00 UTC', () => {
    expect(singaporeDay(new Date('2026-10-31T15:59:59Z'))).toBe('2026-10-31');
    expect(singaporeDay(new Date('2026-10-31T16:00:00Z'))).toBe('2026-11-01');
  });

  it('starts a fresh allowance at 16:00 UTC', () => {
    const { clock, counters } = setup('2026-10-31T15:59:00Z');
    for (let i = 0; i < 20; i++) counters.reserve('phone', LIMITS);
    expect(counters.reserve('phone', LIMITS).ok).toBe(false);
    clock.now = new Date('2026-10-31T16:00:00Z');
    expect(counters.reserve('phone', LIMITS).ok).toBe(true);
  });
});

describe('the per-phone limit', () => {
  it('lets the 20th scan through and refuses the 21st with scope device', () => {
    const { counters } = setup();
    for (let i = 1; i <= 20; i++) expect(counters.reserve('phone', LIMITS).ok).toBe(true);
    const refused = counters.reserve('phone', LIMITS);
    expect(refused).toMatchObject({ ok: false, scope: 'device' });
  });

  it('does not count one phone against another', () => {
    const { counters } = setup();
    for (let i = 0; i < 20; i++) counters.reserve('phone-a', LIMITS);
    expect(counters.reserve('phone-b', LIMITS).ok).toBe(true);
  });

  it('says how long until the next Singapore midnight', () => {
    const { counters } = setup('2026-10-31T15:00:00Z');
    for (let i = 0; i < 20; i++) counters.reserve('phone', LIMITS);
    expect(counters.reserve('phone', LIMITS)).toMatchObject({ retryAfterSeconds: 3600 });
  });
});

describe('the global limit', () => {
  it('refuses a fresh phone once the day is used up', () => {
    const { counters } = setup();
    const limits = { perDevice: 20, global: 3 };
    for (const phone of ['a', 'b', 'c']) expect(counters.reserve(phone, limits).ok).toBe(true);
    expect(counters.reserve('d', limits)).toMatchObject({ ok: false, scope: 'global' });
  });

  it('reports the device limit first when both are reached', () => {
    const { counters } = setup();
    const limits = { perDevice: 1, global: 1 };
    counters.reserve('a', limits);
    expect(counters.reserve('a', limits)).toMatchObject({ scope: 'device' });
  });
});

describe('refunding a reservation', () => {
  it('gives back both the phone and the global count', () => {
    const { db, counters } = setup();
    const first = counters.reserve('phone', LIMITS);
    if (!first.ok) throw new Error('expected a reservation');
    counters.refund(first.reservation);
    expect(countsOn(db, '2026-10-31')).toEqual({ 'scan:device|phone': 0, 'scan:global|': 0 });
  });

  it('refunds the day it was taken even after midnight', () => {
    const { db, clock, counters } = setup('2026-10-31T15:59:00Z');
    const first = counters.reserve('phone', LIMITS);
    if (!first.ok) throw new Error('expected a reservation');
    clock.now = new Date('2026-10-31T16:01:00Z');
    counters.reserve('phone', LIMITS);
    counters.refund(first.reservation);
    expect(countsOn(db, '2026-10-31')).toEqual({ 'scan:device|phone': 0, 'scan:global|': 0 });
    expect(countsOn(db, '2026-11-01')).toEqual({ 'scan:device|phone': 1, 'scan:global|': 1 });
  });

  it('frees room for another scan', () => {
    const { counters } = setup();
    const limits = { perDevice: 1, global: 5 };
    const first = counters.reserve('phone', limits);
    if (!first.ok) throw new Error('expected a reservation');
    counters.refund(first.reservation);
    expect(counters.reserve('phone', limits).ok).toBe(true);
  });
});

describe('minting limit per address', () => {
  it('refuses the 11th mint from one address', () => {
    const { counters } = setup();
    for (let i = 0; i < 10; i++) expect(counters.reserveMint('203.0.113.9', 10).ok).toBe(true);
    expect(counters.reserveMint('203.0.113.9', 10).ok).toBe(false);
    expect(counters.reserveMint('203.0.113.10', 10).ok).toBe(true);
  });

  it('keeps no raw address in the database', () => {
    const { db, counters } = setup();
    counters.reserveMint('203.0.113.9', 10);
    const keys = db.prepare('SELECT key FROM daily_counters').all();
    expect(JSON.stringify(keys)).not.toContain('203.0.113.9');
  });
});

describe('pruning old days', () => {
  it('drops rows older than two days when a new day starts', () => {
    const { db, clock, counters } = setup('2026-10-28T04:00:00Z');
    counters.reserve('phone', LIMITS);
    clock.now = new Date('2026-10-30T04:00:00Z');
    counters.reserve('phone', LIMITS);
    expect(Object.keys(countsOn(db, '2026-10-28'))).toEqual(['scan:device|phone', 'scan:global|']);
    clock.now = new Date('2026-10-31T04:00:00Z');
    counters.reserve('phone', LIMITS);
    expect(countsOn(db, '2026-10-28')).toEqual({});
    expect(Object.keys(countsOn(db, '2026-10-30'))).toHaveLength(2);
  });

  it('drops stale rows when the server starts', () => {
    const db = freshDb();
    db.prepare("INSERT INTO daily_counters VALUES ('2026-10-20', 'scan:global', '', 5)").run();
    createDailyCounters(db, () => new Date('2026-10-31T04:00:00Z'));
    expect(countsOn(db, '2026-10-20')).toEqual({});
  });
});
