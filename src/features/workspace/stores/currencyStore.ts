import { create } from 'zustand';
import {
  loadExchangeRates,
  saveExchangeRates,
} from '@features/workspace/logic/exchangeRateStorage';
import { fetchExchangeRates } from '@features/workspace/api/exchangeRateApi';
import { FALLBACK_RATES_TO_SGD } from '@shared/logic/core/exchangeRates';

type CurrencyStore = {
  exchangeRates: Record<string, number>;
  exchangeRatesLastFetched: number | null;
  fetchAndSetExchangeRates: () => Promise<void>;
};

const initialRates = loadExchangeRates() ?? FALLBACK_RATES_TO_SGD;

export const useCurrencyStore = create<CurrencyStore>((set) => ({
  exchangeRates: initialRates,
  exchangeRatesLastFetched: null,

  fetchAndSetExchangeRates: async () => {
    const fetched = await fetchExchangeRates();
    if (fetched) {
      saveExchangeRates(fetched);
      set({ exchangeRates: fetched, exchangeRatesLastFetched: Date.now() });
    }
  },
}));
