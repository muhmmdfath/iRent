import { useRef } from 'react';
import { BusinessForm, type ActionField } from '@/components/business-form';
import { api } from '@/services/api';
import { rupiah, wib } from '@/customer/format';
import type { Booking, Financial } from '@/customer/types';
import { pendingExtension } from '../types';

export function ExtensionRequestForm({
  booking,
  onDone,
  onCancel,
  onBusy,
}: {
  booking: Booking;
  onDone: (extensionId: string) => void;
  onCancel: () => void;
  onBusy?: (busy: boolean) => void;
}) {
  const created = useRef('');
  const busy = new Set(
    (booking.extensions || [])
      .filter((extension) => pendingExtension(extension.status))
      .flatMap((extension) =>
        extension.items.map((item) => item.bookingItemId),
      ),
  );
  const units =
    booking.items?.filter(
      (item) =>
        ['in_use', 'return_pending'].includes(item.useStatus) &&
        !busy.has(item.id),
    ) || [];
  const fields: ActionField[] = units.map((item) => ({
    name: item.id,
    label: `${item.itemNameSnapshot} · ${item.unitCodeSnapshot} · kembali ${wib(item.currentEndAt)}`,
    type: 'select',
    optional: true,
    options: [
      { value: '', label: 'Tidak diperpanjang' },
      ...[6, 12, 24].map((hours) => {
        const tariff =
          hours === 6
            ? item.tariff6hSnapshot
            : hours === 12
              ? item.tariff12hSnapshot
              : item.tariff24hSnapshot;
        return {
          value: String(hours),
          label: `Tambah ${hours} jam${tariff ? ' · ' + rupiah(tariff) : ''}`,
        };
      }),
    ],
  }));
  if (booking.status !== 'berjalan' || !units.length)
    return (
      <p className="info-note">
        Tidak ada unit yang dapat diajukan saat ini. Unit mungkin sudah kembali
        atau memiliki pengajuan aktif.
      </p>
    );
  return (
    <BusinessForm
      title="Ajukan perpanjangan"
      description="Pilih unit dan tambahan waktu. Ajukan paling lambat dua jam sebelum jadwal kembali. Jadwal berubah setelah admin menyetujui; ketersediaan diperiksa saat pengajuan."
      fields={fields}
      validate={(input) => {
        if (!Object.values(input).some(Boolean))
          throw new Error('Pilih minimal satu unit.');
      }}
      execute={async (input, key) => {
        const result = (
          await api.post<Financial & { decision: string }>(
            `/bookings/${booking.id}/extensions`,
            {
              items: Object.entries(input)
                .filter(([, value]) => value)
                .map(([bookingItemId, addedHours]) => ({
                  bookingItemId,
                  addedHours: Number(addedHours),
                })),
            },
            { headers: { 'Idempotency-Key': key } },
          )
        ).data;
        created.current = result.decision;
        return result;
      }}
      onDone={() => onDone(created.current)}
      onCancel={onCancel}
      onBusy={onBusy}
    />
  );
}
