import { describe, expect, it } from 'vitest';
import {
  buildWorkspaceFileName,
  hasWorkspaceContent,
  readWorkspaceFile,
} from '@features/split-workspace/logic/workspaceTransfer';
import { exportDraftToJson } from '@features/split-workspace/logic/draftStorage';
import { makeItem, makeReceipt } from '../../../tests/integration/testHelpers';

describe('buildWorkspaceFileName', () => {
  it('names the export after the local date', () => {
    expect(buildWorkspaceFileName(new Date(2026, 9, 4, 23, 30))).toBe('split-2026-10-04.json');
  });
});

describe('readWorkspaceFile', () => {
  it('reads a Split export back into a workspace', async () => {
    const json = exportDraftToJson({
      people: [{ id: 'p1', name: 'Alice' }],
      receipts: [makeReceipt({ id: 'r1', items: [makeItem({ id: 'i1', name: 'Laksa' })] })],
      activeReceiptId: 'r1',
      payerMobile: '91234567',
    });

    const draft = await readWorkspaceFile(new File([json], 'split.json'));

    expect(draft?.people).toEqual([{ id: 'p1', name: 'Alice' }]);
    expect(draft?.receipts[0].items[0].name).toBe('Laksa');
    expect(draft?.payerMobile).toBe('91234567');
  });

  it('rejects a file that is not a Split export', async () => {
    expect(await readWorkspaceFile(new File(['{"hello":1}'], 'other.json'))).toBeNull();
    expect(await readWorkspaceFile(new File(['not json'], 'notes.txt'))).toBeNull();
  });
});

describe('hasWorkspaceContent', () => {
  const blankReceipt = makeReceipt({ items: [makeItem({ name: '', amountInput: '' })] });

  it('treats a fresh workspace as empty', () => {
    expect(hasWorkspaceContent([], [blankReceipt])).toBe(false);
  });

  it.each([
    ['a person', [{ id: 'p1', name: 'Alice' }], [blankReceipt]],
    ['a typed item', [], [makeReceipt({ items: [makeItem({ name: 'Laksa', amountInput: '' })] })]],
    ['a second receipt', [], [blankReceipt, blankReceipt]],
  ])('counts %s as something to lose', (_label, people, receipts) => {
    expect(hasWorkspaceContent(people, receipts)).toBe(true);
  });
});
