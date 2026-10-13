import type { Person, Receipt, ReceiptSplit, SplitResult } from '@shared/types';
import { computeSplit, consolidateSplits } from '@features/split-workspace/logic/split/split';
import { mapNonEmpty, type NonEmptyArray } from '@features/split-workspace/logic/nonEmpty';

export interface Splits {
  /** Each receipt with its split, in the currency it was billed in. */
  receiptSplits: NonEmptyArray<ReceiptSplit>;
  /** Every receipt added up in the base currency. */
  consolidated: SplitResult;
}

interface Derivation {
  people: Person[];
  receipts: NonEmptyArray<Receipt>;
  exchangeRates: Record<string, number>;
  splits: Splits;
}

let last: Derivation | null = null;

/**
 * Every split the workspace shows. The last result is kept, so the screens that read it in one
 * render share a single computation.
 */
export function deriveSplits(
  people: Person[],
  receipts: NonEmptyArray<Receipt>,
  exchangeRates: Record<string, number>,
): Splits {
  if (
    last?.people === people &&
    last.receipts === receipts &&
    last.exchangeRates === exchangeRates
  ) {
    return last.splits;
  }

  const receiptSplits = mapNonEmpty(receipts, (receipt) => ({
    receipt,
    split: computeSplit(receipt, people),
  }));
  const splits = { receiptSplits, consolidated: consolidateSplits(receiptSplits, exchangeRates) };
  last = { people, receipts, exchangeRates, splits };
  return splits;
}
