import type { InventoryItem, InventoryUnit } from '@/admin/inventory/types';
import { item, at } from './customer-fixtures';
export const inventoryItem: InventoryItem = {
  ...item,
  isActive: true,
  stock: { activeUnitCount: 3, readyPhysicalCount: 1 },
  availabilityChecked: false,
};
export function inventoryUnits(): InventoryUnit[] {
  const base: InventoryUnit = {
    id: 'ready-unit',
    itemId: item.id,
    code: 'IPH-001',
    isActive: true,
    conditionStatus: 'layak',
    physicalStatus: 'ready',
    preparationUntil: null,
    maintenanceCompletedAt: null,
    notes: null,
    activeAllocationCount: 0,
    unreturnedBookingCount: 0,
  };
  return [
    base,
    {
      ...base,
      id: 'maintenance-unit',
      code: 'IPH-002',
      conditionStatus: 'maintenance',
      physicalStatus: 'awaiting_check',
      notes: 'Pemeriksaan baterai.',
    },
    {
      ...base,
      id: 'preparing-unit',
      code: 'IPH-003',
      physicalStatus: 'preparing',
      preparationUntil: at(3600000),
    },
  ];
}
