import type { OcrResponse } from '@shared/types'

export interface MockReceiptFixture {
  label: string
  peopleNames: string[]
  buildResponse: () => OcrResponse
}

export const MOCK_RECEIPT_FIXTURES: MockReceiptFixture[] = [
  {
    label: 'Mock Receipt 1',
    peopleNames: ['Alice', 'Bob', 'Charlie'],
    buildResponse: () => ({
      items: [
        { description: 'Chicken Rice', amount: 8.5 },
        { description: 'Iced Lemon Tea', amount: 3.2 },
        { description: 'Pasta Alfredo', amount: 15.9 },
        { description: 'Truffle Fries', amount: 12.0 },
      ],
      subtotal: 39.6,
      total: 47.48,
      detected: {
        gst: { enabled: true, amount: null, percent: 9, confidence: 0.99, source: 'mock' },
        serviceCharge: { enabled: true, amount: null, percent: 10, confidence: 0.99, source: 'mock' },
      },
      warnings: ['Loaded local mock receipt data.'],
    }),
  },
  {
    label: 'Mock Receipt 2',
    peopleNames: ['Alice', 'Bob', 'Charlie', 'David'],
    buildResponse: () => ({
      items: [
        { description: 'Genki Forest', amount: 2.5 },
        { description: 'Jasmine Tea', amount: 2.5 },
        { description: 'Homemade Barley (warm)', amount: 2.0 },
        { description: 'Chinese Tea (hot)', amount: 1.8 },
        { description: 'Homemade Barley (Cold)', amount: 2.0 },
        { description: 'Chicken Gizzard (pcs)', amount: 3.0 },
        { description: 'Grilled chicken hearts (pcs)', amount: 4.0 },
        { description: 'Flammulina (set)', amount: 4.8 },
        { description: 'Grilled Eggplant with Minced Garlic (pcs)', amount: 5.0 },
        { description: 'Grilled Pork Belly (pcs)', amount: 4.8 },
        { description: 'Chives (set)', amount: 4.8 },
        { description: 'Lamb Kebab (pcs)', amount: 3.9 },
        { description: 'Charcoal Grilled Scallops (pcs) Min 2 pcs', amount: 17.5 },
        { description: 'Rice', amount: 6.4 },
        { description: 'Green Chilli with Century Egg (Sour and Sp)', amount: 7.8 },
        { description: 'Sweet and Sour Fish', amount: 14.8 },
        { description: 'Mala Baby Lobster', amount: 23.8 },
        { description: 'Saute Dried Boneless Chicken with Chilli a', amount: 18.8 },
        { description: 'Twice cooked Pork', amount: 12.8 },
        { description: 'Dry Fried French Beans With Minced Pork', amount: 8.8 },
      ],
      subtotal: 151.8,
      total: 166.98,
      detected: {
        gst: { enabled: true, amount: 0.0, percent: 9.0, confidence: 0.95, source: '9% GST' },
        serviceCharge: { enabled: true, amount: 15.18, percent: 10.0, confidence: 0.95, source: '10% Service Charge' },
      },
      warnings: [
        'GST amount is 0.00 despite a 9% rate being listed.',
        'Some item descriptions are truncated due to image cropping.',
      ],
    }),
  },
]

export function buildLocalMockOcrResponse(): OcrResponse {
  return MOCK_RECEIPT_FIXTURES[0].buildResponse()
}

export function buildSimpleModeMockOcrResponse(): OcrResponse {
  return MOCK_RECEIPT_FIXTURES[1].buildResponse()
}
