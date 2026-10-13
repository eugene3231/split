import { z } from 'zod';
import { LOCAL_STORAGE_EXCHANGE_RATES_KEY } from '@features/split-workspace/constants';
import { jsonStorage } from './jsonStorage';

const exchangeRatesSchema = z.object({
  rates: z
    .record(z.string(), z.unknown())
    .transform((rates) =>
      Object.fromEntries(
        Object.entries(rates).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0,
        ),
      ),
    ),
  savedAt: z.number().catch(0),
});

const exchangeRatesStorage = jsonStorage(
  'localStorage',
  LOCAL_STORAGE_EXCHANGE_RATES_KEY,
  exchangeRatesSchema,
);

export function saveExchangeRates(rates: Record<string, number>): void {
  exchangeRatesStorage.save({ rates, savedAt: Date.now() });
}

export function loadExchangeRates(): Record<string, number> | null {
  const rates = exchangeRatesStorage.load()?.rates;
  return rates && Object.keys(rates).length > 0 ? rates : null;
}
