import { deliveryViaChat } from '../delivery-fee';
import { DeliveryFeeNotice } from '../components/delivery-fee-notice';
import { ArrowLeftIcon, ArrowRightIcon } from '@radix-ui/react-icons';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DisclosureSummary } from '@/components/ui/disclosure-summary';
import { LoadingState, ErrorState } from '@/components/feedback';
import { errorMessage } from '@/services/api';
import { useBooking, useFinancial } from '../hooks';
import { wib, rupiah, statusLabels } from '../format';
import { ItemPhoto } from '../components/item-photo';
import { RefundPanel } from '@/refunds/panel';
import { CustomerReturns } from '../components/returns-panel';
import { ExtensionList } from '@/extensions/components/extension-list';
import './booking-detail.css';

const useLabels: Record<string, string> = {
  allocated: 'Dipesan',
  in_use: 'Sedang disewa',
  return_pending: 'Pengembalian dilaporkan',
  returned: 'Dikembalikan',
  lost_closed: 'Ditutup karena kehilangan',
};
const paymentLabels: Record<string, string> = {
  lunas: 'Lunas',
  dp_terverifikasi: 'DP terverifikasi',
  ditutup: 'Pembayaran ditutup',
};
const statusNotes: Record<string, string> = {
  menunggu_pembayaran: 'Bayar lalu upload bukti.',
  menunggu_konfirmasi: 'Bukti sedang diperiksa admin.',
  dikonfirmasi: 'Booking siap. Bawa KTP/SIM saat ambil.',
  berjalan:
    'Kembalikan sesuai jadwal. Butuh tambahan waktu? Ajukan perpanjangan.',
  selesai: 'Sewa selesai. Terima kasih.',
  dibatalkan: 'Booking dibatalkan. Cek refund jika ada.',
  kedaluwarsa: 'Waktu bayar habis. Silakan booking lagi.',
  ditolak: 'Booking ditolak. Lihat alasan di bawah.',
};
export function BookingDetailPage() {
  const { id = '' } = useParams();
  const query = useBooking(id);
  const financial = useFinancial(id);
  if (query.isPending) return <LoadingState text="Memuat booking..." />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const booking = query.data;
  const money = financial.data;
  const canReport =
    booking.status === 'berjalan' &&
    booking.items?.some((item) => item.useStatus === 'in_use');
  const showRefund =
    !!money?.booking.refunds?.length ||
    ['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi'].includes(
      booking.status,
    );
  const showExtensions =
    booking.status === 'berjalan' || !!money?.booking.extensions?.length;
  const paymentLabel = money
    ? paymentLabels[money.summary.paymentStatus] || 'Pembayaran belum lengkap'
    : null;
  return (
    <div className="booking-detail">
      <Link className="bd-back" to="/app/bookings">
        <ArrowLeftIcon aria-hidden="true" />
        Semua booking
      </Link>
      <header className="bd-heading">
        <div>
          <p className="bd-code">{booking.code}</p>
          <h1>Detail booking</h1>
        </div>
        <div className="bd-statuses">
          <span className="bd-status" data-status={booking.status}>
            {statusLabels[booking.status]}
          </span>
          {paymentLabel && (
            <span className="bd-payment-status">{paymentLabel}</span>
          )}
        </div>
      </header>
      <div className="bd-layout">
        <div className="bd-main">
          <div className="bd-notice">
            <p>{statusNotes[booking.status]}</p>
            {booking.cancelReason && <p>{booking.cancelReason}</p>}
            {booking.rejectedReason && <p>{booking.rejectedReason}</p>}
            {canReport && (
              <Button asChild>
                <a href="#booking-returns">
                  Laporkan pengembalian
                  <ArrowRightIcon aria-hidden="true" />
                </a>
              </Button>
            )}
          </div>
          <section className="bd-section" aria-labelledby="bd-devices-title">
            <h2 id="bd-devices-title">Perangkat & jadwal</h2>
            {booking.items?.map((item) => (
              <article key={item.id} className="bd-device">
                <div className="bd-device-heading">
                  <ItemPhoto
                    path={item.item?.photoPath || null}
                    name={item.itemNameSnapshot}
                    className="bd-device-photo"
                  />
                  <div>
                    <h3>{item.itemNameSnapshot}</h3>
                    <p className="bd-unit">Unit {item.unitCodeSnapshot}</p>
                    <span className="bd-use-status">
                      {useLabels[item.useStatus] || item.useStatus}
                    </span>
                  </div>
                </div>
                <dl className="bd-dates">
                  <div>
                    <dt>Pengambilan</dt>
                    <dd>{wib(item.startAt)}</dd>
                  </div>
                  <div>
                    <dt>Pengembalian</dt>
                    <dd>{wib(item.currentEndAt)}</dd>
                  </div>
                </dl>
              </article>
            ))}
            <div className="bd-pickup">
              <span>Metode pengambilan</span>
              <div>
                <p>
                  {booking.deliveryType === 'pickup'
                    ? 'Ambil di toko'
                    : deliveryViaChat(booking)
                      ? 'Antar-jemput · ongkir lewat chat'
                      : booking.deliveryZoneNameSnapshot + ' - antar-jemput'}
                </p>
                {booking.deliveryAddress && (
                  <p className="bd-unit">{booking.deliveryAddress}</p>
                )}
              </div>
            </div>
          </section>
          {money && (
            <div id="booking-returns" className="bd-returns">
              <CustomerReturns booking={money.booking} />
            </div>
          )}
          {money &&
            (showExtensions ? (
              <div className="bd-extensions">
                <ExtensionList booking={money.booking} />
              </div>
            ) : (
              <details className="bd-disclosure">
                <DisclosureSummary>Perpanjangan</DisclosureSummary>
                <ExtensionList booking={money.booking} />
              </details>
            ))}
          {money &&
            (showRefund ? (
              <RefundPanel key={id} booking={booking} money={money} />
            ) : (
              <details className="bd-disclosure">
                <DisclosureSummary>Pembatalan & refund</DisclosureSummary>
                <RefundPanel key={id} booking={booking} money={money} />
              </details>
            ))}
          <details className="bd-disclosure bd-history">
            <DisclosureSummary>Riwayat status</DisclosureSummary>
            <ol>
              {booking.statusLogs?.map((log) => (
                <li key={log.id}>
                  <span>{statusLabels[log.toStatus]}</span>
                  <time dateTime={log.createdAt}>{wib(log.createdAt)}</time>
                  {log.reason && <p>{log.reason}</p>}
                </li>
              ))}
            </ol>
          </details>
        </div>
        <aside className="bd-payment" aria-labelledby="bd-payment-title">
          <h2 id="bd-payment-title">Biaya & pembayaran</h2>
          <dl className="bd-totals">
            <div>
              <dt>Sewa awal</dt>
              <dd>{rupiah(booking.initialRentalTotal)}</dd>
            </div>
            <div>
              <dt>Antar-jemput</dt>
              <dd>
                {deliveryViaChat(booking)
                  ? 'Diinfokan lewat chat'
                  : rupiah(booking.deliveryFeeSnapshot)}
              </dd>
            </div>
            <div className="bd-initial-total">
              <dt>Total awal</dt>
              <dd>{rupiah(booking.initialGrandTotal)}</dd>
            </div>
            {money && money.summary.bill !== booking.initialGrandTotal && (
              <div>
                <dt>Total tagihan saat ini</dt>
                <dd>{rupiah(money.summary.bill)}</dd>
              </div>
            )}
          </dl>
          {deliveryViaChat(booking) && <DeliveryFeeNotice />}
          {financial.isPending ? (
            <p className="bd-unit">Memuat saldo...</p>
          ) : financial.isError ? (
            <div className="bd-money-error">
              <p role="alert">{errorMessage(financial.error)}</p>
              <Button
                variant="outline"
                onClick={() => void financial.refetch()}
              >
                Coba lagi
              </Button>
            </div>
          ) : (
            money && (
              <div className="bd-balance">
                <span>Sisa tagihan</span>
                <strong>{rupiah(money.summary.remaining)}</strong>
                <p>{paymentLabel}</p>
              </div>
            )
          )}
          <Button
            asChild
            variant={
              booking.status === 'menunggu_pembayaran' ? 'default' : 'outline'
            }
          >
            <Link to={'/app/bookings/' + id + '/payment'}>
              {booking.status === 'menunggu_pembayaran'
                ? 'Bayar & upload bukti'
                : 'Lihat pembayaran'}
              <ArrowRightIcon aria-hidden="true" />
            </Link>
          </Button>
          {booking.status === 'menunggu_pembayaran' && (
            <p className="bd-payment-note">
              Batas upload bukti: {wib(booking.expiresAt)}
            </p>
          )}
          {booking.status === 'menunggu_konfirmasi' &&
            booking.confirmationDueAt && (
              <p className="bd-payment-note">
                Batas konfirmasi admin: {wib(booking.confirmationDueAt)}
              </p>
            )}
        </aside>
      </div>
    </div>
  );
}
