import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { LimitScope } from '@shared/api/scan';
import { inTransaction } from '../db/openDb';

const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const DEVICE_BUCKET = 'scan:device';
export const GLOBAL_BUCKET = 'scan:global';
export const MINT_BUCKET = 'device-mint:ip';

export interface ScanLimits {
  perDevice: number;
  global: number;
}

export interface Reservation {
  day: string;
  deviceKey: string;
}

export type ReserveResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; scope: LimitScope; retryAfterSeconds: number };

export type LimitCheck = { ok: true } | { ok: false; scope: LimitScope; retryAfterSeconds: number };

export function singaporeDay(now: Date): string {
  return new Date(now.getTime() + SINGAPORE_OFFSET_MS).toISOString().slice(0, 10);
}

function secondsUntilNextDay(now: Date): number {
  const sinceMidnight = (now.getTime() + SINGAPORE_OFFSET_MS) % DAY_MS;
  return Math.ceil((DAY_MS - sinceMidnight) / 1000);
}

export function hashForDay(day: string, value: string): string {
  return createHash('sha256').update(`${day}${value}`).digest('hex');
}

export interface DailyCounters {
  check(deviceKey: string, limits: ScanLimits): LimitCheck;
  reserve(deviceKey: string, limits: ScanLimits): ReserveResult;
  refund(reservation: Reservation): void;
  reserveMint(ip: string, limit: number): { ok: true } | { ok: false; retryAfterSeconds: number };
}

export function createDailyCounters(db: DatabaseSync, now: () => Date): DailyCounters {
  const read = db.prepare(
    'SELECT count FROM daily_counters WHERE day = ? AND bucket = ? AND key = ?',
  );
  const increment = db.prepare(
    `INSERT INTO daily_counters (day, bucket, key, count) VALUES (?, ?, ?, 1)
     ON CONFLICT (day, bucket, key) DO UPDATE SET count = count + 1`,
  );
  const decrement = db.prepare(
    'UPDATE daily_counters SET count = MAX(count - 1, 0) WHERE day = ? AND bucket = ? AND key = ?',
  );
  const prune = db.prepare('DELETE FROM daily_counters WHERE day < ?');
  let prunedOn = '';

  function countOf(day: string, bucket: string, key: string): number {
    const row = read.get(day, bucket, key) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  function pruneOnNewDay(today: string): void {
    if (today === prunedOn) return;
    const cutoff = singaporeDay(new Date(Date.parse(`${today}T00:00:00Z`) - 2 * DAY_MS));
    prune.run(cutoff);
    prunedOn = today;
  }

  function checkLimits(
    day: string,
    moment: Date,
    deviceKey: string,
    limits: ScanLimits,
  ): LimitCheck {
    const retryAfterSeconds = secondsUntilNextDay(moment);
    if (countOf(day, DEVICE_BUCKET, deviceKey) >= limits.perDevice) {
      return { ok: false, scope: 'device', retryAfterSeconds };
    }
    if (countOf(day, GLOBAL_BUCKET, '') >= limits.global) {
      return { ok: false, scope: 'global', retryAfterSeconds };
    }
    return { ok: true };
  }

  pruneOnNewDay(singaporeDay(now()));

  return {
    check: (deviceKey, limits) => checkLimits(singaporeDay(now()), now(), deviceKey, limits),

    reserve(deviceKey, limits) {
      const moment = now();
      const day = singaporeDay(moment);
      pruneOnNewDay(day);
      return inTransaction(db, (): ReserveResult => {
        const check = checkLimits(day, moment, deviceKey, limits);
        if (!check.ok) return check;
        increment.run(day, DEVICE_BUCKET, deviceKey);
        increment.run(day, GLOBAL_BUCKET, '');
        return { ok: true, reservation: { day, deviceKey } };
      });
    },

    refund({ day, deviceKey }) {
      inTransaction(db, () => {
        decrement.run(day, DEVICE_BUCKET, deviceKey);
        decrement.run(day, GLOBAL_BUCKET, '');
      });
    },

    reserveMint(ip, limit) {
      const moment = now();
      const day = singaporeDay(moment);
      pruneOnNewDay(day);
      const key = hashForDay(day, ip);
      return inTransaction(db, () => {
        if (countOf(day, MINT_BUCKET, key) >= limit) {
          return { ok: false as const, retryAfterSeconds: secondsUntilNextDay(moment) };
        }
        increment.run(day, MINT_BUCKET, key);
        return { ok: true as const };
      });
    },
  };
}
