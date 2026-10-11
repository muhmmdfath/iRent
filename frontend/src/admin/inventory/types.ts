import type { Item } from '@/customer/types';
export interface InventoryItem extends Item {
  isActive: boolean;
  availabilityChecked?: false;
}
export interface InventoryFilters {
  page: number;
  search: string;
  category: '' | 'iphone' | 'accessory';
  isActive: '' | 'true' | 'false';
}
export interface Page<T> {
  data: T[];
  total: number;
  page: number;
}
export interface InventoryUnit {
  id: string;
  itemId: string;
  code: string;
  isActive: boolean;
  conditionStatus: 'layak' | 'maintenance' | 'lost';
  physicalStatus:
    'ready' | 'in_use' | 'awaiting_check' | 'in_transit' | 'preparing' | 'lost';
  preparationUntil: string | null;
  maintenanceCompletedAt: string | null;
  notes: string | null;
  activeAllocationCount: number;
  unreturnedBookingCount: number;
}
export interface ItemInput {
  category: 'iphone' | 'accessory';
  name: string;
  includes: string[];
  price6h: string;
  price12h: string;
  price24h: string;
}
