import {
  defaultDiscountState,
  defaultGstState,
  defaultServiceChargeState,
} from '@features/split-workspace/constants';
import type { EditableItem, Receipt } from '@shared/types';

function sampleItem(id: string, name: string, amountInput: string): EditableItem {
  return {
    id,
    name,
    amountInput,
    discountPercentInput: '',
    assignment: { mode: 'equal', personId: '', personIds: [] },
  };
}

export const SAMPLE_PEOPLE = ['Ana', 'Ben', 'Cai', 'Dee'];

export const SAMPLE_RECEIPT: Receipt = {
  id: 'sample-jumbo',
  name: 'Jumbo Seafood',
  items: [
    sampleItem('sample-crab', 'Chilli crab (1.2kg)', '98.40'),
    sampleItem('sample-prawns', 'Cereal prawns', '32.00'),
    sampleItem('sample-kangkong', 'Sambal kangkong', '16.00'),
    sampleItem('sample-mantou', 'Fried mantou ×8', '9.60'),
    sampleItem('sample-tiger', 'Tiger tower', '68.00'),
    sampleItem('sample-lime', 'Lime juice', '6.50'),
  ],
  discount: { ...defaultDiscountState },
  serviceCharge: { ...defaultServiceChargeState },
  gst: { ...defaultGstState },
  receiptTotalInput: '',
  currency: 'SGD',
  exchangeRateOverride: null,
};
