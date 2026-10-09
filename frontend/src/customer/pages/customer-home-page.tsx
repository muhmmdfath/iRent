import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/auth/session';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/services/api';
import { useBookings, useFinancial } from '../hooks';
import { customerApi } from '../api';
import { ItemPhoto } from '../components/item-photo';
import { Deadline } from '../components/deadline';
import { BookingRows } from './bookings-page';
import { rupiah, wib } from '../format';
export function CustomerHomePage() {
  const user = useSession().data!.user;
  const bookings = useBookings();
  const pending = useQuery({
    queryKey: ['customer', user.id, 'next-payment'],
    queryFn: ({ signal }) => customerApi.nextPayment(signal),
    refetchInterval: 15_000,
  });
  const action = pending.data?.[0];
  const financial = useFinancial(action?.id || '');
  const obligation = financial.data?.booking.obligations.find(
    (row) => row.extensionId === null && row.status === 'open',
  );
  return (
    <>
      <header className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">iRent Semarang</p>
          <h1>Selamat datang, {user.name}.</h1>
          <p>Jadwal sewa dan tindakan berikutnya, dalam satu tempat.</p>
        </div>
        <Button asChild variant={action ? 'outline' : 'default'}>
          <Link to="/catalog">Cari perangkat</Link>
        </Button>
      </header>
      {!user.profile?.completedAt && (
        <section className="profile-prompt">
          <div>
            <h2>Lengkapi profil penyewa</h2>
            <p className="muted">
              Data wajib diperlukan sebelum booking pertama.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/app/profile">Lengkapi profil</Link>
          </Button>
        </section>
      )}
      {pending.isError && (
        <p className="form-error">
          {errorMessage(pending.error)}{' '}
          <button className="text-link" onClick={() => void pending.refetch()}>
            Coba lagi
          </button>
        </p>
      )}
      {action && (
        <section className="primary-booking">
          <div className="payment-overview">
            <ItemPhoto
              path={action.items?.[0]?.item?.photoPath || null}
              name={action.items?.[0]?.itemNameSnapshot || 'Perangkat'}
              className="item-photo-thumb"
            />
            <div>
              <p className="eyebrow">Menunggu pembayaran</p>
              <h2>{action.items?.[0]?.itemNameSnapshot || action.code}</h2>
              <p className="muted text-sm">
                {action.code} - Ambil {wib(action.initialStartAt)}
              </p>
            </div>
          </div>
          <div className="primary-booking-actions">
            <div className="amount-focus">
              <p>Bayar sekarang</p>
              <strong>
                {obligation
                  ? rupiah(obligation.remainingAmount ?? obligation.amountDue)
                  : financial.isPending
                    ? 'Memuat...'
                    : 'Lihat rincian pembayaran'}
              </strong>
            </div>
            <Deadline at={action.expiresAt} label="Batas upload" />
            <Button asChild>
              <Link to={'/app/bookings/' + action.id + '/payment'}>
                Bayar & upload bukti
              </Link>
            </Button>
          </div>
        </section>
      )}
      <section className="dashboard-bookings">
        <div className="section-heading">
          <h2>Booking terbaru</h2>
          <Link className="text-link" to="/app/bookings">
            Lihat semua
          </Link>
        </div>
        {bookings.isPending ? (
          <p role="status" className="muted">
            Memuat booking...
          </p>
        ) : bookings.isError ? (
          <p className="form-error">
            {errorMessage(bookings.error)}{' '}
            <button
              className="text-link"
              onClick={() => void bookings.refetch()}
            >
              Coba lagi
            </button>
          </p>
        ) : bookings.data.length ? (
          <BookingRows bookings={bookings.data.slice(0, 5)} />
        ) : (
          <div className="empty-state">
            <h3>Belum ada booking</h3>
            <p>Pilih perangkat dan jadwal yang kamu butuhkan.</p>
          </div>
        )}
      </section>
    </>
  );
}
