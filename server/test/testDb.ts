import type { DatabaseSync } from 'node:sqlite';
import { migrate } from '../src/db/migrate';
import { openDb } from '../src/db/openDb';

export function freshDb(): DatabaseSync {
  const db = openDb(':memory:');
  migrate(db);
  return db;
}

export function countsOn(db: DatabaseSync, day: string): Record<string, number> {
  const rows = db
    .prepare('SELECT bucket, key, count FROM daily_counters WHERE day = ?')
    .all(day) as Array<{ bucket: string; key: string; count: number }>;
  return Object.fromEntries(rows.map((row) => [`${row.bucket}|${row.key}`, row.count]));
}
