import { create } from 'zustand';
import { useAuthStore } from '@/stores/useAuthStore';
import { qolApi, type Prices } from './api';

// Memory only: prices remain authoritative on the server, never in localStorage.
interface PriceState {
  prices: Prices;
  loaded: boolean;
  load: () => Promise<void>;
  save: (prices: Prices) => Promise<void>;
  clear: () => void;
}
let pending: Promise<void> | undefined;
let generation = 0;
let controller = new AbortController();
export const useQolPriceStore = create<PriceState>((set, get) => ({
  prices: {},
  loaded: false,
  load: () => {
    if (get().loaded) return Promise.resolve();
    if (pending) return pending;
    const current = generation;
    pending = qolApi
      .prices(controller.signal)
      .then((prices) => {
        if (current === generation) set({ prices, loaded: true });
      })
      .finally(() => {
        if (current === generation) pending = undefined;
      });
    return pending;
  },
  save: async (prices) => {
    const current = generation;
    const saved = await qolApi.savePrices(prices);
    if (current === generation) set({ prices: saved, loaded: true });
  },
  clear: () => {
    generation++;
    controller.abort();
    controller = new AbortController();
    pending = undefined;
    set({ prices: {}, loaded: false });
  },
}));
useAuthStore.subscribe((state, prev) => {
  if (
    state.apiBase !== prev.apiBase ||
    state.managementKey !== prev.managementKey ||
    state.isAuthenticated !== prev.isAuthenticated
  )
    useQolPriceStore.getState().clear();
});
