import { create } from 'zustand';
export type ToastKind = 'success' | 'error' | 'info' | 'warning';
export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
}
export const useToastStore = create<{
  items: Toast[];
  push: (item: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}>((set) => ({
  items: [],
  push: (item) =>
    set((state) => ({
      items: [
        ...state.items.filter(
          (row) => row.title !== item.title || row.message !== item.message,
        ),
        { ...item, id: crypto.randomUUID() },
      ].slice(-3),
    })),
  dismiss: (id) =>
    set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
  clear: () => set({ items: [] }),
}));
export const notify = (item: Omit<Toast, 'id'>) =>
  useToastStore.getState().push(item);
