import { PAGE_SIZE } from '@/lib/pagination';
import { api } from '@/services/api';
import type {
  InventoryFilters,
  InventoryItem,
  InventoryUnit,
  ItemInput,
  Page,
} from './types';
export const inventoryApi = {
  items: async (filters: InventoryFilters, signal?: AbortSignal) =>
    (
      await api.get<Page<InventoryItem>>('/admin/items', {
        signal,
        params: {
          ...filters,
          search: filters.search || undefined,
          category: filters.category || undefined,
          isActive: filters.isActive || undefined,
          limit: PAGE_SIZE,
        },
      })
    ).data,
  item: async (id: string, signal?: AbortSignal) =>
    (await api.get<InventoryItem>(`/admin/items/${id}`, { signal })).data,
  units: async (id: string, page: number, signal?: AbortSignal) =>
    (
      await api.get<Page<InventoryUnit>>(`/admin/items/${id}/units`, {
        signal,
        params: { page, limit: PAGE_SIZE },
      })
    ).data,
  create: async (input: ItemInput) =>
    (await api.post<InventoryItem>('/admin/items', input)).data,
  update: async (
    id: string,
    input: Partial<Omit<ItemInput, 'category'>> & {
      isActive?: boolean;
      photoPath?: null;
    },
  ) => (await api.patch<InventoryItem>(`/admin/items/${id}`, input)).data,
  addUnits: async (
    id: string,
    input: { quantity: number } | { codes: string[] },
  ) =>
    (await api.post<InventoryUnit[]>(`/admin/items/${id}/units`, input)).data,
  activeUnit: async (id: string, isActive: boolean) =>
    (await api.patch<InventoryUnit>(`/admin/units/${id}/active`, { isActive }))
      .data,
  maintenance: async (id: string, reason: string) =>
    (
      await api.post<InventoryUnit>(`/admin/units/${id}/maintenance`, {
        reason,
      })
    ).data,
  completeMaintenance: async (id: string) =>
    (await api.post<InventoryUnit>(`/admin/units/${id}/maintenance/complete`))
      .data,
  completePreparation: async (id: string) =>
    (await api.post<InventoryUnit>(`/admin/units/${id}/preparation/complete`))
      .data,
  photo: async (id: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return (
      await api.post<{ path: string; result: InventoryItem }>(
        `/admin/items/${id}/photo`,
        body,
      )
    ).data;
  },
};
