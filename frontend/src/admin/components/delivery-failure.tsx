import { reasonField } from '@/components/action-fields';
import { useEffect, useState } from 'react';
import { BusinessForm } from '@/components/business-form';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';
import type { Booking } from '@/customer/types';
export function DeliveryFailure({
  booking,
  disabled,
  onBusy,
}: {
  booking: Booking;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    onBusy(open);
    return () => onBusy(false);
  }, [open, onBusy]);
  return booking.status === 'dikonfirmasi' &&
    booking.deliveryType === 'delivery' ? (
    <section className="form-section">
      <h2>Tindak lanjut delivery</h2>
      <p>
        Jika pelanggan gagal menerima barang, catat kesiapan petugas dan waktu
        kegagalan yang sudah diverifikasi. Keterlambatan toko memengaruhi batas
        no-show; pembatalan diproses worker setelah syarat terpenuhi.
      </p>
      <Button
        variant="outline"
        disabled={disabled || open}
        onClick={() => setOpen(true)}
      >
        Catat kegagalan pelanggan
      </Button>
      {open && (
        <BusinessForm
          title="Catat kegagalan delivery"
          fields={[
            {
              name: 'readyAt',
              label: 'Petugas siap menyerahkan (WIB)',
              type: 'datetime',
            },
            {
              name: 'customerFailureAt',
              label: 'Kegagalan pelanggan terverifikasi (WIB)',
              type: 'datetime',
            },
            reasonField,
          ]}
          validate={(input) => {
            if (
              new Date(input.readyAt) > new Date(input.customerFailureAt) ||
              new Date(input.customerFailureAt).getTime() > Date.now()
            )
              throw new Error(
                'Waktu petugas dan pelanggan harus berurutan dan tidak di masa depan.',
              );
          }}
          execute={async (input, key) =>
            api.post(
              `/admin/bookings/${booking.id}/delivery/customer-failure`,
              input,
              { headers: { 'Idempotency-Key': key } },
            )
          }
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      )}
    </section>
  ) : null;
}
