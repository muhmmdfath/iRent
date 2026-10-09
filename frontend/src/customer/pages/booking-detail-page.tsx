import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { useBooking, useFinancial } from '../hooks';
import { wib, rupiah, statusLabels } from '../format';
import { ItemPhoto } from '../components/item-photo';
const useLabels: Record<string, string> = {
  allocated: 'Dipesan',
  in_use: 'Sedang disewa',
  return_pending: 'Pengembalian dilaporkan',
  returned: 'Dikembalikan',
  lost_closed: 'Ditutup karena kehilangan',
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
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">{booking.code}</p>
        <h1>Detail booking</h1>
        <p>
          <span className="status-badge">{statusLabels[booking.status]}</span>
        </p>
      </header>
      <div className="form-actions mb-8">
        <Button asChild>
          <Link to={'/app/bookings/' + id + '/payment'}>
            {booking.status === 'menunggu_pembayaran'
              ? 'Bayar & upload bukti'
              : 'Lihat pembayaran'}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/app/bookings">Semua booking</Link>
        </Button>
      </div>
      <section className="form-section">
        <h2>Perangkat & jadwal</h2>
        {booking.items?.map((item) => (
          <div key={item.id} className="booking-unit-row">
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
              <p className="text-sm">
                {useLabels[item.useStatus] || item.useStatus}
              </p>
            </div>
          </div>
        ))}
      </section>
      <section className="form-section">
        <h2>Pengambilan</h2>
        <p>
          {booking.deliveryType === 'pickup'
            ? 'Ambil di toko'
            : booking.deliveryZoneNameSnapshot + ' - antar-jemput'}
        </p>
        {booking.deliveryAddress && (
          <p className="muted">{booking.deliveryAddress}</p>
        )}
      </section>
      <section className="form-section">
        <h2>Biaya & pembayaran</h2>
        <dl className="price-breakdown">
          <div>
            <dt>Sewa awal</dt>
            <dd>{rupiah(booking.initialRentalTotal)}</dd>
          </div>
          <div>
            <dt>Antar-jemput</dt>
            <dd>{rupiah(booking.deliveryFeeSnapshot)}</dd>
          </div>
          <div>
            <dt>Total awal</dt>
            <dd>{rupiah(booking.initialGrandTotal)}</dd>
          </div>
        </dl>
        {financial.isPending ? (
          <p className="muted">Memuat saldo...</p>
        ) : financial.isError ? (
          <p className="form-error">
            {errorMessageForFinancial(financial.error)}
          </p>
        ) : (
          <>
            <p>Sisa tagihan {rupiah(financial.data.summary.remaining)}</p>
            <p className="muted text-sm">
              {financial.data.summary.paymentStatus === 'lunas'
                ? 'Lunas'
                : financial.data.summary.paymentStatus === 'dp_terverifikasi'
                  ? 'DP terverifikasi'
                  : financial.data.summary.paymentStatus === 'ditutup'
                    ? 'Pembayaran ditutup'
                    : 'Pembayaran belum lengkap'}
            </p>
          </>
        )}
      </section>
      {financial.data?.booking.refunds?.length ? (
        <section className="form-section">
          <h2>Status refund</h2>
          {financial.data.booking.refunds.map((refund) => (
            <div className="proof-row" key={refund.id}>
              <p>{rupiah(refund.approvedAmount ?? refund.requestedAmount)}</p>
              <p>
                {refund.status === 'diajukan'
                  ? 'Refund diajukan'
                  : refund.status === 'disetujui'
                    ? 'Disetujui - menunggu transfer'
                    : refund.status === 'sudah_dikembalikan'
                      ? 'Uang sudah dikembalikan'
                      : 'Refund ditolak'}
              </p>
            </div>
          ))}
        </section>
      ) : null}
      <details className="optional-fields">
        <summary>Riwayat status</summary>
        {booking.statusLogs?.map((log) => (
          <div className="proof-row" key={log.id}>
            <p>{statusLabels[log.toStatus]}</p>
            <p className="muted text-sm">{wib(log.createdAt)}</p>
          </div>
        ))}
      </details>
    </>
  );
}
import { errorMessage as errorMessageForFinancial } from '@/services/api';
