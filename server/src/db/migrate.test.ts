import { describe, expect, it } from 'vitest';
import { MIGRATIONS, migrate } from './migrate';
import { openDb } from './openDb';

function tables(db: ReturnType<typeof openDb>): string[] {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{
      name: string;
    }>
  ).map((row) => row.name);
}

describe('migrations', () => {
  it('builds the schema on a fresh database', () => {
    const db = openDb(':memory:');
    expect(migrate(db)).toBe(1);
    expect(tables(db)).toEqual(['daily_counters', 'devices', 'schema_migrations']);
  });

  it('changes nothing when run again', () => {
    const db = openDb(':memory:');
    migrate(db);
    const before = db.prepare('SELECT * FROM schema_migrations').all();
    migrate(db);
    expect(db.prepare('SELECT * FROM schema_migrations').all()).toEqual(before);
  });

  it('refuses to start on a database with a migration the code does not know', () => {
    const db = openDb(':memory:');
    migrate(db);
    db.prepare("INSERT INTO schema_migrations VALUES (99, '0099_future', 'now')").run();
    expect(() => migrate(db)).toThrow(/migration 99/);
  });

  it('rolls a failed migration back whole', () => {
    const db = openDb(':memory:');
    const broken = [
      ...MIGRATIONS,
      { version: 2, name: '0002_broken', sql: 'CREATE TABLE half (x); SELECT nope FROM missing;' },
    ];
    expect(() => migrate(db, broken)).toThrow();
    expect(tables(db)).not.toContain('half');
    expect(db.prepare('SELECT version FROM schema_migrations').all()).toEqual([{ version: 1 }]);
  });
});
