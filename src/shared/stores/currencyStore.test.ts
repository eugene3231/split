import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrencyStore } from '@shared/stores/currencyStore';
import * as exchangeRateApi from '@shared/api/exchangeRateApi';
import * as storage from '@shared/api/storage';

describe('currencyStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useCurrencyStore.setState({ exchangeRatesLastFetched: null });
  });

  it('fetchAndSetExchangeRates updates store when API returns rates', async () => {
    const mockRates = { SGD: 1, USD: 1.35 };
    vi.spyOn(exchangeRateApi, 'fetchExchangeRates').mockResolvedValue(mockRates);
    vi.spyOn(storage, 'saveExchangeRates').mockImplementation(() => {});

    await useCurrencyStore.getState().fetchAndSetExchangeRates();

    expect(useCurrencyStore.getState().exchangeRates).toEqual(mockRates);
    expect(useCurrencyStore.getState().exchangeRatesLastFetched).toBeTypeOf('number');
    expect(storage.saveExchangeRates).toHaveBeenCalledWith(mockRates);
  });

  it('fetchAndSetExchangeRates does not update store when API returns null', async () => {
    vi.spyOn(exchangeRateApi, 'fetchExchangeRates').mockResolvedValue(null);
    const originalRates = { ...useCurrencyStore.getState().exchangeRates };

    await useCurrencyStore.getState().fetchAndSetExchangeRates();

    expect(useCurrencyStore.getState().exchangeRates).toEqual(originalRates);
    expect(useCurrencyStore.getState().exchangeRatesLastFetched).toBeNull();
  });
});
