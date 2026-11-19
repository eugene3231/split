import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertWritableDir, openDb } from './openDb';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    chmodSync(dir, 0o700);
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'split-db-'));
  dirs.push(dir);
  return dir;
}

describe('opening the database', () => {
  it('creates the folder and runs in WAL mode', () => {
    const file = path.join(tempDir(), 'nested', 'split.db');
    const db = openDb(file);
    expect(db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    db.close();
  });

  it('keeps data across a reopen', () => {
    const file = path.join(tempDir(), 'split.db');
    const first = openDb(file);
    first.exec('CREATE TABLE t (x); INSERT INTO t VALUES (7)');
    first.close();
    const second = openDb(file);
    expect(second.prepare('SELECT x FROM t').get()).toEqual({ x: 7 });
    second.close();
  });
});

describe('checking the data folder', () => {
  it('accepts a writable folder', () => {
    expect(() => assertWritableDir(tempDir())).not.toThrow();
  });

  it.skipIf(process.getuid?.() === 0)('says what to chown when the folder is read-only', () => {
    const dir = tempDir();
    chmodSync(dir, 0o500);
    const uid = process.getuid?.();
    const gid = process.getgid?.();
    expect(() => assertWritableDir(dir)).toThrow(
      `${dir} is not writable by uid ${uid} gid ${gid}: chown ${uid}:${gid} the data folder`,
    );
  });
});
