import { describe, expect, it } from 'vitest';
import { freshDb } from '../../test/testDb';
import { createDeviceTokens } from './deviceTokens';

describe('device tokens', () => {
  it('recognises a token it minted', () => {
    const tokens = createDeviceTokens(freshDb(), () => new Date('2026-10-31T04:00:00Z'));
    const token = tokens.mint();
    expect(tokens.authenticate(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives the same device key every time for one token', () => {
    const tokens = createDeviceTokens(freshDb(), () => new Date('2026-10-31T04:00:00Z'));
    const token = tokens.mint();
    expect(tokens.authenticate(token)).toBe(tokens.authenticate(token));
  });

  it('does not recognise a token it never minted', () => {
    const tokens = createDeviceTokens(freshDb(), () => new Date('2026-10-31T04:00:00Z'));
    tokens.mint();
    expect(tokens.authenticate('made-up')).toBeNull();
  });

  it('mints a different 256-bit token each time', () => {
    const tokens = createDeviceTokens(freshDb(), () => new Date('2026-10-31T04:00:00Z'));
    const [a, b] = [tokens.mint(), tokens.mint()];
    expect(a).not.toBe(b);
    expect(Buffer.from(a, 'base64url')).toHaveLength(32);
  });

  it('stores only a hash of the token', () => {
    const db = freshDb();
    const tokens = createDeviceTokens(db, () => new Date('2026-10-31T04:00:00Z'));
    const token = tokens.mint();
    expect(JSON.stringify(db.prepare('SELECT * FROM devices').all())).not.toContain(token);
  });

  it('records the Singapore day a device was last seen', () => {
    const db = freshDb();
    const clock = { now: new Date('2026-10-31T04:00:00Z') };
    const tokens = createDeviceTokens(db, () => clock.now);
    const token = tokens.mint();
    clock.now = new Date('2026-11-02T04:00:00Z');
    tokens.authenticate(token);
    expect(db.prepare('SELECT last_seen_day FROM devices').get()).toEqual({
      last_seen_day: '2026-11-02',
    });
  });
});
