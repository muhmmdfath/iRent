import { create } from 'zustand';
// UI state only. Session and server data belong to React Query.
export const useUiStore = create<{
  navigationOpen: boolean;
  setNavigationOpen: (open: boolean) => void;
}>((set) => ({
  navigationOpen: false,
  setNavigationOpen: (navigationOpen) => set({ navigationOpen }),
}));
