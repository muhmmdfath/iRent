import { createHash } from 'node:crypto';
import {
  Booking,
  BookingItem,
  Extension,
  ItemUnit,
  UnitAllocation,
} from '../../generated/prisma/client';
import { CreateBookingDto } from './bookings.dto';

export type CalendarAllocation = UnitAllocation & {
  bookingItem: BookingItem & { booking: Booking };
  extensionItem: { extension: Extension } | null;
};

export function protectsAllocation(
  allocation: CalendarAllocation,
  now: Date,
): boolean {
  if (allocation.state !== 'active') return false;
  const owner =
    allocation.allocationKind === 'extension_hold'
      ? allocation.extensionItem?.extension
      : allocation.bookingItem.booking;
  if (!owner) return false;
  if (owner.status === 'menunggu_pembayaran')
    return owner.expiresAt !== null && now <= owner.expiresAt;
  return [
    'menunggu_konfirmasi',
    'dikonfirmasi',
    'berjalan',
    'disetujui',
  ].includes(owner.status);
}

export function overdue(item: BookingItem, now: Date): boolean {
  return (
    ['in_use', 'return_pending'].includes(item.useStatus) &&
    item.currentEndAt < now
  );
}

export function unitAvailable(
  unit: ItemUnit,
  allocations: CalendarAllocation[],
  uses: BookingItem[],
  start: Date,
  end: Date,
  now: Date,
): boolean {
  if (!unit.isActive || unit.conditionStatus !== 'layak') return false;
  const currentUses = uses.filter(
    (item) =>
      item.itemUnitId === unit.id &&
      ['in_use', 'return_pending'].includes(item.useStatus),
  );
  if (currentUses.some((item) => overdue(item, now))) return false;
  if (unit.physicalStatus === 'preparing') {
    if (!unit.preparationUntil || start < unit.preparationUntil) return false;
  } else if (unit.physicalStatus !== 'ready' && !currentUses.length)
    return false;
  return !allocations.some(
    (allocation) =>
      allocation.itemUnitId === unit.id &&
      protectsAllocation(allocation, now) &&
      allocation.blockStartAt < end &&
      allocation.blockEndAt > start,
  );
}

export function bookingRequestHash(input: CreateBookingDto): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        startAt: input.startAt,
        durationHours: input.durationHours,
        items: input.items
          .map((item) => ({
            itemId: item.itemId.toLowerCase(),
            quantity: item.quantity,
          }))
          .sort((a, b) => a.itemId.localeCompare(b.itemId)),
        deliveryType: input.deliveryType,
        deliveryZoneId: input.deliveryZoneId?.toLowerCase() ?? null,
        deliveryAddress: input.deliveryAddress?.trim() ?? null,
        payOption: input.payOption,
        termsVersion: input.termsVersion,
        agreeTerms: input.agreeTerms,
        prepareIdentity: input.prepareIdentity,
        understandPayment: input.understandPayment,
        agreeOperatingHours: input.agreeOperatingHours,
      }),
    )
    .digest('hex');
}
