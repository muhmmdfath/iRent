import { reasonField } from '@/components/action-fields';
import { useEffect, useState } from 'react';
import { useAdminRead, type Page } from '@/admin/manage/hooks';
import { BusinessForm } from '@/components/business-form';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { api } from '@/services/api';
import type { Booking, BookingItem } from '@/customer/types';
import type { InventoryUnit } from '@/admin/inventory/types';
function ReplaceForm({
  booking,
  item,
  onClose,
}: {
  booking: Booking;
  item: BookingItem;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const query = useAdminRead<Page<InventoryUnit>>(
    'replacement-' + item.itemId,
    `/admin/items/${item.itemId}/units`,
    { page, limit: 100 },
  );
  if (query.isPending) return <LoadingState text="Memuat unit pengganti..." />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const units = query.data.data.filter(
    (unit) =>
      unit.isActive &&
      unit.conditionStatus === 'layak' &&
      unit.physicalStatus === 'ready' &&
      unit.id !== item.itemUnitId,
  );
  return (
    <>
      <BusinessForm
        title="Ganti unit booking"
        description={`Pengganti ${item.unitCodeSnapshot} dari model yang sama. Siap fisik belum membuktikan kalender tersedia; server memeriksa benturan/alokasi secara atomik. Harga dan jadwal booking tetap berlaku.`}
        fields={[
          {
            name: 'itemUnitId',
            label: 'Unit pengganti',
            type: 'select',
            options: [
              { value: '', label: 'Pilih unit pengganti' },
              ...units.map((unit) => ({ value: unit.id, label: unit.code })),
            ],
          },
          reasonField,
        ]}
        execute={async (input, key) =>
          api.post(
            `/admin/bookings/${booking.id}/items/${item.id}/unit/replace`,
            input,
            { headers: { 'Idempotency-Key': key } },
          )
        }
        onDone={onClose}
        onCancel={onClose}
      />
      <div className="form-actions">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Unit sebelumnya
        </Button>
        <span>Kelompok unit {page}</span>
        <Button
          variant="outline"
          disabled={page * 100 >= query.data.total}
          onClick={() => setPage(page + 1)}
        >
          Unit berikutnya
        </Button>
      </div>
    </>
  );
}
export function UnitReplacement({
  booking,
  disabled,
  onBusy,
}: {
  booking: Booking;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const [selected, setSelected] = useState<BookingItem | null>(null);
  useEffect(() => {
    onBusy(!!selected);
    return () => onBusy(false);
  }, [selected, onBusy]);
  const allowed = [
    'menunggu_pembayaran',
    'menunggu_konfirmasi',
    'dikonfirmasi',
  ].includes(booking.status);
  return allowed ? (
    <section className="form-section">
      <h2>Pengganti unit</h2>
      <p className="muted">
        Gunakan jika unit pesanan berisiko. Konfirmasikan penanganan dengan
        pelanggan sebelum serah-terima.
      </p>
      <div className="form-actions">
        {booking.items
          ?.filter((item) => item.useStatus === 'allocated' && !item.pickedUpAt)
          .map((item) => (
            <Button
              key={item.id}
              variant="outline"
              disabled={disabled || !!selected}
              onClick={() => setSelected(item)}
            >
              Ganti {item.unitCodeSnapshot}
            </Button>
          ))}
      </div>
      {selected && (
        <ReplaceForm
          key={selected.id}
          booking={booking}
          item={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  ) : null;
}
