import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { ItemPhoto } from '@/customer/components/item-photo';
import { rupiah, statusLabels, wib } from '@/customer/format';
import { useOnline } from '@/hooks/use-online';
import { useAdminDetail } from '../hooks';
import { ProofViewer } from '../components/proof-viewer';
import { ReceiptForm, RejectProofForm } from '../components/payment-action';
import { BookingOperations } from '../components/operations';
import { RefundPanel } from '@/refunds/panel';
import { ExtensionList } from '@/extensions/pages';
import { AdvancedPayments } from '../components/advanced-payments';
import { UnitReplacement } from '../components/unit-replacement';
import { DeliveryFailure } from '../components/delivery-failure';
const purposeLabels = {
  initial_dp: 'DP awal',
  initial_full: 'Pembayaran penuh awal',
  settlement: 'Pelunasan',
  extension: 'Perpanjangan',
};
export function AdminBookingDetailPage() {
  const { id = '' } = useParams();
  const online = useOnline();
  const { booking: detail, financial } = useAdminDetail(id);
  const [action, setAction] = useState<{
    kind: 'verify' | 'reject' | 'settlement';
    proofId?: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [operationBusy, setOperationBusy] = useState(false);
  const [refundBusy, setRefundBusy] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [replacementBusy, setReplacementBusy] = useState(false);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const extraBusy = receiptBusy || replacementBusy || deliveryBusy;
  if (detail.isPending || financial.isPending)
    return <LoadingState text="Memuat detail booking..." />;
  if (detail.isError)
    return (
      <ErrorState error={detail.error} retry={() => void detail.refetch()} />
    );
  if (financial.isError)
    return (
      <ErrorState
        error={financial.error}
        retry={() => void financial.refetch()}
      />
    );
  const booking = detail.data;
  const money = financial.data;
  const terminal = ['kedaluwarsa', 'ditolak', 'dibatalkan'].includes(
    money.booking.status,
  );
  const obligations = money.booking.obligations.filter(
    (value) => value.extensionId === null,
  );
  const pendingSettlement = obligations.some(
    (value) =>
      value.purpose === 'settlement' && value.status === 'proof_pending',
  );
  const canSettle =
    ['dikonfirmasi', 'berjalan', 'selesai'].includes(money.booking.status) &&
    BigInt(money.summary.remaining) > 0n &&
    !pendingSettlement;
  function done(text: string) {
    setAction(null);
    setMessage(text);
  }
  return (
    <>
      <Link className="back-link" to="/admin/bookings">
        ← Semua booking
      </Link>
      <header className="page-heading admin-detail-heading">
        <div>
          <p className="eyebrow">{booking.code}</p>
          <h1>Detail booking</h1>
          <p className="status-badge">{statusLabels[money.booking.status]}</p>
        </div>
        <Button
          variant="outline"
          disabled={!online || detail.isFetching || financial.isFetching}
          onClick={() => {
            void detail.refetch();
            void financial.refetch();
          }}
        >
          Perbarui data
        </Button>
      </header>
      {message && (
        <p className="success-note" role="status">
          {message}
        </p>
      )}
      {money.confirmationOverdue && (
        <p className="info-note">
          Batas konfirmasi sudah lewat. Periksa bukti dan uang masuk; booking
          tidak dibatalkan otomatis karena keterlambatan pemeriksaan.
        </p>
      )}
      <div className="admin-detail-grid">
        <div>
          <section className="form-section admin-customer-info">
            <h2>Penyewa & pengambilan</h2>
            <h3>{booking.customer?.name || 'Pelanggan'}</h3>
            {booking.customer?.phone && <p>{booking.customer.phone}</p>}
            {booking.customer?.email && <p>{booking.customer.email}</p>}
            <p>
              {booking.deliveryType === 'pickup'
                ? 'Ambil di toko'
                : `Antar-jemput · ${booking.deliveryZoneNameSnapshot}`}
            </p>
            {booking.deliveryAddress && (
              <p className="muted">{booking.deliveryAddress}</p>
            )}
          </section>
          <section className="form-section">
            <h2>Perangkat & jadwal</h2>
            {booking.items?.map((item) => (
              <div className="booking-unit-row" key={item.id}>
                <ItemPhoto
                  path={item.item?.photoPath || null}
                  name={item.itemNameSnapshot}
                  className="item-photo-thumb"
                />
                <div>
                  <h3>{item.itemNameSnapshot}</h3>
                  <p className="muted text-sm">Unit {item.unitCodeSnapshot}</p>
                  <p>Ambil {wib(item.startAt)}</p>
                  <p>Kembali {wib(item.currentEndAt)}</p>
                </div>
              </div>
            ))}
          </section>
          <BookingOperations
            booking={booking}
            money={money}
            paymentBusy={!!action || refundBusy || extraBusy}
            onBusy={setOperationBusy}
            onDone={done}
          />
          <ExtensionList booking={money.booking} admin />
          <RefundPanel
            key={id}
            booking={booking}
            money={money}
            admin
            disabled={!!action || operationBusy || extraBusy}
            onBusy={setRefundBusy}
          />
          <UnitReplacement
            booking={money.booking}
            disabled={
              !!action ||
              operationBusy ||
              refundBusy ||
              receiptBusy ||
              deliveryBusy
            }
            onBusy={setReplacementBusy}
          />
          <DeliveryFailure
            booking={money.booking}
            disabled={
              !!action ||
              operationBusy ||
              refundBusy ||
              receiptBusy ||
              replacementBusy
            }
            onBusy={setDeliveryBusy}
          />
          <AdvancedPayments
            money={money}
            disabled={
              !!action ||
              operationBusy ||
              refundBusy ||
              replacementBusy ||
              deliveryBusy
            }
            onBusy={setReceiptBusy}
          />
          <section className="form-section">
            <div className="section-heading">
              <h2>Bukti & verifikasi</h2>
              <span className="muted text-sm">Booking awal dan pelunasan</span>
            </div>
            {terminal && (
              <p className="info-note">
                Booking sudah ditutup. Uang masuk pada booking ini perlu
                direkonsiliasi untuk refund; jangan mengonfirmasi booking
                kembali.
              </p>
            )}
            {!obligations.some((value) => value.proofs?.length) && (
              <p className="muted">Belum ada bukti pembayaran yang diunggah.</p>
            )}
            {obligations.map((obligation) =>
              obligation.proofs?.map((proof) => (
                <article className="admin-proof" key={proof.id}>
                  <header className="section-heading">
                    <div>
                      <h3>{purposeLabels[obligation.purpose]}</h3>
                      <p className="muted text-sm">
                        Diunggah {wib(proof.uploadedAt)}
                      </p>
                    </div>
                    <span className="status-badge">
                      {proof.status === 'pending'
                        ? 'Menunggu pemeriksaan'
                        : proof.status === 'verified'
                          ? 'Diverifikasi'
                          : 'Ditolak'}
                    </span>
                  </header>
                  <p>
                    Nominal pada bukti:{' '}
                    <strong>{rupiah(proof.claimedAmount)}</strong>
                  </p>
                  {obligation.expiresAt && (
                    <p className="muted text-sm">
                      Batas pembayaran awal: {wib(obligation.expiresAt)}
                    </p>
                  )}
                  {proof.rejectedReason && (
                    <p className="field-error">{proof.rejectedReason}</p>
                  )}
                  <ProofViewer proof={proof} />
                  {proof.status === 'pending' &&
                    obligation.pendingProofId === proof.id &&
                    !terminal && (
                      <>
                        {action?.proofId === proof.id ? (
                          action.kind === 'verify' ? (
                            <ReceiptForm
                              bookingId={id}
                              proofId={proof.id}
                              suggestedAmount={proof.claimedAmount}
                              onDone={done}
                              onCancel={() => setAction(null)}
                            />
                          ) : (
                            <RejectProofForm
                              bookingId={id}
                              proofId={proof.id}
                              onDone={done}
                              onCancel={() => setAction(null)}
                            />
                          )
                        ) : (
                          <div className="form-actions">
                            <Button
                              disabled={
                                !online ||
                                !!action ||
                                operationBusy ||
                                refundBusy ||
                                extraBusy
                              }
                              onClick={() => {
                                setMessage(null);
                                setAction({
                                  kind: 'verify',
                                  proofId: proof.id,
                                });
                              }}
                            >
                              Verifikasi uang masuk
                            </Button>
                            <Button
                              variant="outline"
                              disabled={
                                !online ||
                                !!action ||
                                operationBusy ||
                                refundBusy ||
                                extraBusy
                              }
                              onClick={() => {
                                setMessage(null);
                                setAction({
                                  kind: 'reject',
                                  proofId: proof.id,
                                });
                              }}
                            >
                              Tolak bukti
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                </article>
              )),
            )}
          </section>
          <details className="optional-fields">
            <summary>Riwayat status booking</summary>
            {booking.statusLogs?.map((log) => (
              <div className="proof-row" key={log.id}>
                <div>
                  <p>{statusLabels[log.toStatus]}</p>
                  {log.reason && <p className="muted text-sm">{log.reason}</p>}
                </div>
                <p className="muted text-sm">{wib(log.createdAt)}</p>
              </div>
            ))}
          </details>
        </div>
        <aside className="admin-ledger">
          <p className="eyebrow">Saldo booking awal</p>
          <h2>
            {money.summary.paymentStatus === 'lunas'
              ? 'Tagihan lunas'
              : 'Sisa tagihan'}
          </h2>
          <p className="admin-review-amount">
            {rupiah(money.summary.remaining)}
          </p>
          <dl className="price-breakdown">
            <div>
              <dt>Total tagihan</dt>
              <dd>{rupiah(money.summary.bill)}</dd>
            </div>
            <div>
              <dt>Uang diterima</dt>
              <dd>{rupiah(money.summary.received)}</dd>
            </div>
            <div>
              <dt>Dana diterapkan</dt>
              <dd>{rupiah(money.summary.applied)}</dd>
            </div>
            <div>
              <dt>Dana menunggu penerapan</dt>
              <dd>{rupiah(money.summary.reserved)}</dd>
            </div>
            <div>
              <dt>Refund ditransfer</dt>
              <dd>{rupiah(money.summary.refunded)}</dd>
            </div>
          </dl>
          <p className="muted text-sm">
            Upload bukti tidak menambah uang diterima. Verifikasi berdasarkan
            uang aktual pada rekening atau kas.
          </p>
          {pendingSettlement && (
            <p className="info-note">
              Periksa bukti pelunasan yang masih menunggu sebelum mencatat
              penerimaan lain.
            </p>
          )}
          {canSettle &&
            (action?.kind === 'settlement' ? (
              <ReceiptForm
                bookingId={id}
                suggestedAmount={money.summary.remaining}
                onDone={done}
                onCancel={() => setAction(null)}
              />
            ) : (
              <Button
                disabled={
                  !online ||
                  !!action ||
                  operationBusy ||
                  refundBusy ||
                  extraBusy
                }
                onClick={() => {
                  setMessage(null);
                  setAction({ kind: 'settlement' });
                }}
              >
                Catat pelunasan
              </Button>
            ))}
          {terminal && (
            <p className="muted text-sm">Pembayaran booking sudah ditutup.</p>
          )}
        </aside>
      </div>
    </>
  );
}
