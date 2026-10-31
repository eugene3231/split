import { describe, expect, it } from 'vitest';
import { SCAN_ERROR_KINDS } from '@shared/api/scan';
import { ScanError, describeScanError } from './scanError';

describe('describeScanError', () => {
  it('asks for a key on every kind except a bad photo and a missing pass', () => {
    const asking = SCAN_ERROR_KINDS.filter(
      (kind) => describeScanError(new ScanError(kind)).asksForKey,
    );
    expect(asking).toEqual(
      SCAN_ERROR_KINDS.filter((k) => k !== 'bad-image' && k !== 'needs-device'),
    );
  });

  it('names the shared limit when the whole scanner is used up', () => {
    expect(describeScanError(new ScanError('over-limit', 'global')).message).toBe(
      "Split's shared scanner has reached today's limit. Add your own Gemini key to keep scanning.",
    );
  });

  it('tells a phone that hit its own limit that its free scans are used', () => {
    expect(describeScanError(new ScanError('over-limit', 'device')).message).toBe(
      "You've used today's free scans. Add your own Gemini key to keep scanning.",
    );
  });

  it('blames the photo, not the server, for a bad image', () => {
    const { message, asksForKey } = describeScanError(new ScanError('bad-image'));
    expect(asksForKey).toBe(false);
    expect(message).toBe(
      "This file can't be scanned. Use a JPEG, PNG, WebP or HEIC photo, or a PDF, under 10 MB.",
    );
  });
});
