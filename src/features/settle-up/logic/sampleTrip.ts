import type { Person } from '@shared/types';
import type { SettleUpReceipt } from './settleUp';

export const SAMPLE_PEOPLE: Person[] = [
  { id: 'sample-ana', name: 'Ana' },
  { id: 'sample-ben', name: 'Ben' },
  { id: 'sample-cai', name: 'Cai' },
  { id: 'sample-dee', name: 'Dee' },
];

export const SAMPLE_RECEIPTS: SettleUpReceipt[] = [
  {
    id: 'sample-villa',
    name: 'Villa, 2 nights',
    owedByPersonCents: {
      'sample-ana': 18000,
      'sample-ben': 18000,
      'sample-cai': 18000,
      'sample-dee': 18000,
    },
  },
  {
    id: 'sample-seafood',
    name: 'Jimbaran seafood',
    owedByPersonCents: {
      'sample-ana': 4250,
      'sample-ben': 6120,
      'sample-cai': 3880,
      'sample-dee': 5010,
    },
  },
  {
    id: 'sample-grab',
    name: 'Grab to airport',
    owedByPersonCents: {
      'sample-ana': 1150,
      'sample-ben': 1150,
      'sample-cai': 0,
      'sample-dee': 1150,
    },
  },
];

export const SAMPLE_PAYERS: Record<string, string> = {
  'sample-villa': 'sample-ana',
  'sample-seafood': 'sample-ben',
};
