import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ActionDialog } from '@/components/action-dialog';
import { ExtensionRequestForm } from './extension-request-form';
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
  const navigate = useNavigate();
  const [requestOpen, setRequestOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <section className="form-section">
      <div className="section-heading">
        <h2>Perpanjangan</h2>
        {!admin && booking.status === 'berjalan' && (
          <Button
            className="rental-action"
            onClick={() => setRequestOpen(true)}
          >
            Ajukan perpanjangan
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
      {requestOpen && (
        <ActionDialog
          title="Ajukan perpanjangan"
          busy={busy}
          onClose={() => setRequestOpen(false)}
        >
          <ExtensionRequestForm
            booking={booking}
            onCancel={() => setRequestOpen(false)}
            onBusy={setBusy}
            onDone={(extensionId) => {
              setRequestOpen(false);
              navigate(`/app/bookings/${booking.id}/extensions/${extensionId}`);
            }}
          />
        </ActionDialog>
      )}
    </section>
  );
}
