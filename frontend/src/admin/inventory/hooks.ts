import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/auth/session';
import { inventoryApi } from './api';
import type { InventoryFilters } from './types';
export function useInventory(filters: InventoryFilters) {
  const user = useSession().data?.user;
  return useQuery({
    queryKey: ['admin', user?.id, 'inventory', filters],
    queryFn: ({ signal }) => inventoryApi.items(filters, signal),
    enabled: user?.role === 'admin',
    refetchInterval: 30000,
  });
}
export function useInventoryDetail(id: string, page: number) {
  const user = useSession().data?.user,
    enabled = user?.role === 'admin' && !!id;
  const item = useQuery({
    queryKey: ['admin', user?.id, 'inventory-item', id],
    queryFn: ({ signal }) => inventoryApi.item(id, signal),
    enabled,
    refetchInterval: 30000,
  });
  const units = useQuery({
    queryKey: ['admin', user?.id, 'inventory-units', id, page],
    queryFn: ({ signal }) => inventoryApi.units(id, page, signal),
    enabled,
    refetchInterval: 30000,
  });
  return { item, units };
}
export function useInventoryClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
