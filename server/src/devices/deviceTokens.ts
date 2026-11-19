import { createHash, randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { singaporeDay } from '../limits/dailyCounters';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface DeviceTokens {
  mint(): string;
  authenticate(token: string): string | null;
}

export function createDeviceTokens(db: DatabaseSync, now: () => Date): DeviceTokens {
  const insert = db.prepare(
    'INSERT INTO devices (token_hash, created_at, last_seen_day) VALUES (?, ?, ?)',
  );
  const find = db.prepare('SELECT last_seen_day FROM devices WHERE token_hash = ?');
  const touch = db.prepare('UPDATE devices SET last_seen_day = ? WHERE token_hash = ?');

  return {
    mint() {
      const token = randomBytes(32).toString('base64url');
      const moment = now();
      insert.run(hashToken(token), moment.toISOString(), singaporeDay(moment));
      return token;
    },

    authenticate(token) {
      const tokenHash = hashToken(token);
      const row = find.get(tokenHash) as { last_seen_day: string } | undefined;
      if (!row) return null;
      const today = singaporeDay(now());
      if (row.last_seen_day !== today) touch.run(today, tokenHash);
      return tokenHash;
    },
  };
}
