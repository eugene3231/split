import { beforeEach, describe, expect, it } from 'vitest';
import { asOpId } from '@features/group-ledger/logic/ids';
import { discardGroupReceiptDraft, receiptDraftBase } from './receiptDraftBase';

const key = 'group:g:receipt:e';
const first = asOpId('rev-1');
const newer = asOpId('rev-2');

beforeEach(() => {
  window.localStorage.clear();
});

describe('the revision a receipt draft was started from', () => {
  it('stays the one the draft began on while the draft is kept, so a save flags a newer version', () => {
    receiptDraftBase(key, first);
    window.localStorage.setItem(key, '{}');

    expect(receiptDraftBase(key, newer)).toBe(first);
  });

  it('is the latest revision when no draft is kept', () => {
    receiptDraftBase(key, first);

    expect(receiptDraftBase(key, newer)).toBe(newer);
  });

  it('is forgotten with the draft', () => {
    receiptDraftBase(key, first);
    window.localStorage.setItem(key, '{}');

    discardGroupReceiptDraft(key);

    expect(window.localStorage.getItem(key)).toBeNull();
    expect(receiptDraftBase(key, newer)).toBe(newer);
  });
});
