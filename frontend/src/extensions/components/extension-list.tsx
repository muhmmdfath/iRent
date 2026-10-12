import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { rupiah, wib } from '@/customer/format';
import type { Booking } from '@/customer/types';
import { extensionLabels } from '../types';

export function ExtensionList({
  booking,
  admin = false,
}: {
  booking: Booking;
  admin?: boolean;
}) {
  return (
    <section className="form-section">
      <div className="section-heading">
        <h2>Perpanjangan</h2>
        {!admin && booking.status === 'berjalan' && (
          <Button asChild>
            <Link to={`/app/bookings/${booking.id}/extensions/new`}>
              Ajukan perpanjangan
            </Link>
          </Button>
        )}
      </div>
      <p className="muted">
        Jadwal lama berlaku sampai pengajuan disetujui. Dana dan saldo
        perpanjangan memiliki rincian sendiri.
      </p>
      {booking.extensions?.length ? (
        booking.extensions.map((extension) => (
          <article className="management-row" key={extension.id}>
            <div>
              <h3>
                {extension.items.length} unit · {rupiah(extension.amountDue)}
              </h3>
              <p>{extensionLabels[extension.status]}</p>
              {extension.confirmationDueAt && (
                <p className="muted">
                  Konfirmasi {wib(extension.confirmationDueAt)}
                </p>
              )}
            </div>
            <Link
              className="text-link"
              to={`${admin ? '/admin' : '/app'}/bookings/${booking.id}/extensions/${extension.id}`}
            >
              Detail perpanjangan
            </Link>
          </article>
        ))
      ) : (
        <p className="muted">Belum ada pengajuan perpanjangan.</p>
      )}
    </section>
  );
}
