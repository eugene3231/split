import type { DatabaseSync } from 'node:sqlite';
import { inTransaction } from './openDb';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

const bundled = import.meta.glob<string>('./migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const MIGRATIONS: Migration[] = Object.entries(bundled)
  .map(([file, sql]) => {
    const name = file.slice(file.lastIndexOf('/') + 1, -'.sql'.length);
    return { version: Number.parseInt(name, 10), name, sql };
  })
  .sort((a, b) => a.version - b.version);

export function migrate(db: DatabaseSync, migrations: Migration[] = MIGRATIONS): number {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)',
  );
  const known = new Set(migrations.map((migration) => migration.version));
  const applied = db.prepare('SELECT version FROM schema_migrations').all() as Array<{
    version: number;
  }>;
  const unknown = applied.filter((row) => !known.has(row.version));
  if (unknown.length > 0) {
    throw new Error(
      `The database has migration ${unknown.map((row) => row.version).join(', ')} that this server does not know. Run a newer server.`,
    );
  }

  const done = new Set(applied.map((row) => row.version));
  for (const migration of migrations) {
    if (done.has(migration.version)) continue;
    inTransaction(db, () => {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
    });
  }
  return migrations.length;
}
