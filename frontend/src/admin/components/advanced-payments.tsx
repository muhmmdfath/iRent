import { reasonField } from '@/components/action-fields';
import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { useAdminRead } from '@/admin/manage/hooks';
import { BusinessForm } from '@/components/business-form';
import { receiptFields, validateReceipt } from '@/components/receipt-fields';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { rupiah, wib } from '@/customer/format';
import type { Financial } from '@/customer/types';
interface Receipt {
  id: string;
  paymentObligationId: string | null;
  extensionId: string | null;
  direction: string;
  amount: string;
  method: string;
  occurredAt: string;
  recordedAt: string;
  note: string;
  receivingAccountReference: string | null;
  transactionReference: string | null;
  supersededAt: string | null;
}
export function AdvancedPayments({
  money,
  disabled,
  onBusy,
}: {
  money: Financial;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const booking = money.booking;
  const query = useAdminRead<Receipt[]>(
    'receipts-' + booking.id,
    `/admin/bookings/${booking.id}/receipts`,
    {},
    true,
  );
  const [action, setAction] = useState<
    | { kind: 'reconcile'; obligationId: string }
    | { kind: 'correct'; receipt: Receipt }
    | null
  >(null);
  useEffect(() => {
    onBusy(!!action);
    return () => onBusy(false);
  }, [action, onBusy]);
  const terminal = ['kedaluwarsa', 'ditolak', 'dibatalkan'].includes(
    booking.status,
  );
  return (
    <section className="form-section">
      <h2>Receipt & rekonsiliasi</h2>
      <p className="muted">
        Uang aktual dan riwayat koreksinya. Koreksi tidak menghapus receipt asli
        atau mengubah jadwal otomatis.
      </p>
      {query.isPending ? (
        <LoadingState text="Memuat receipt..." />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {query.data.map((receipt) => (
            <article className="management-row" key={receipt.id}>
              <div>
                <h3>
                  {receipt.direction === 'out' ? 'Refund keluar' : 'Uang masuk'}{' '}
                  {rupiah(receipt.amount)}
                </h3>
                <p>
                  {wib(receipt.occurredAt)} ·{' '}
                  {receipt.method === 'cash'
                    ? 'Tunai'
                    : receipt.method === 'qris'
                      ? 'QRIS'
                      : 'Transfer'}
                </p>
                <p className="muted">
                  {receipt.extensionId
                    ? 'Scope perpanjangan'
                    : 'Scope booking awal'}{' '}
                  · {receipt.transactionReference || 'Tanpa referensi bank'}
                </p>
                <p>{receipt.note}</p>
                {receipt.supersededAt && (
                  <p className="info-note">
                    Sudah diganti; dampak kas aktif nol.
                  </p>
                )}
              </div>
              {receipt.direction === 'in' && !receipt.supersededAt && (
                <Button
                  variant="outline"
                  disabled={disabled || !!action}
                  onClick={() => setAction({ kind: 'correct', receipt })}
                >
                  Koreksi receipt
                </Button>
              )}
            </article>
          ))}
          {!query.data.length && (
            <p className="muted">Belum ada uang aktual yang dicatat.</p>
          )}
        </>
      )}
      {booking.obligations
        .filter(
          (obligation) =>
            obligation.extensionId === null &&
            (terminal ||
              obligation.proofs?.some((proof) => proof.status === 'rejected')),
        )
        .map((obligation) => (
          <div className="form-actions" key={obligation.id}>
            <Button
              variant="outline"
              disabled={disabled || !!action}
              onClick={() =>
                setAction({ kind: 'reconcile', obligationId: obligation.id })
              }
            >
              Rekonsiliasi{' '}
              {obligation.purpose === 'settlement'
                ? 'pelunasan'
                : 'pembayaran awal'}
            </Button>
          </div>
        ))}
      {action?.kind === 'correct' && (
        <BusinessForm
          key={action.receipt.id}
          title="Koreksi receipt masuk"
          description="Gunakan hanya untuk kesalahan pencatatan. Receipt lama tetap tersimpan dengan pembalik dan receipt pengganti. Saldo dapat berubah; dana yang terikat refund aktif/selesai diperiksa server."
          fields={[
            ...receiptFields(action.receipt.amount).map((field) => ({
              ...field,
              value:
                field.name === 'method' ? action.receipt.method : field.value,
            })),
            reasonField,
          ]}
          validate={validateReceipt}
          execute={async (input, key) =>
            api.post(
              `/admin/bookings/${booking.id}/payments/${action.receipt.id}/correct`,
              input,
              { headers: { 'Idempotency-Key': key } },
            )
          }
          onDone={() => setAction(null)}
          onCancel={() => setAction(null)}
        />
      )}
      {action?.kind === 'reconcile' && (
        <BusinessForm
          key={action.obligationId}
          title="Rekonsiliasi uang booking"
          description="Pastikan uang benar-benar diterima dan belum dicatat. Rekonsiliasi menyiapkan refund; booking tidak diaktifkan kembali."
          fields={[
            ...receiptFields(),
            {
              name: 'proofId',
              label: 'Bukti sumber',
              type: 'select',
              optional: true,
              options: [
                { value: '', label: 'Tanpa bukti unggahan' },
                ...(
                  booking.obligations.find(
                    (obligation) => obligation.id === action.obligationId,
                  )?.proofs || []
                )
                  .filter(
                    (proof) =>
                      proof.status === 'rejected' ||
                      (terminal && proof.status === 'pending'),
                  )
                  .map((proof) => ({
                    value: proof.id,
                    label: `${wib(proof.uploadedAt)} · ${rupiah(proof.claimedAmount)}`,
                  })),
              ],
            },
          ]}
          validate={validateReceipt}
          execute={async (input, key) =>
            api.post(
              `/admin/bookings/${booking.id}/payments/reconcile`,
              { ...input, obligationId: action.obligationId },
              { headers: { 'Idempotency-Key': key } },
            )
          }
          onDone={() => setAction(null)}
          onCancel={() => setAction(null)}
        />
      )}
    </section>
  );
}
