import { ArrowTopRightIcon } from '@radix-ui/react-icons';
import { useState } from 'react';
import {
  RentalDateFilter,
  type RentalWindow,
} from '../components/rental-date-filter';
import { HomeDeviceGrid } from '../components/home-device-grid';
import { CheckIcon, CalendarIcon, UploadIcon } from '@radix-ui/react-icons';
import './customer-home.css';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/auth/session';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/services/api';
import { useBookings, useFinancial } from '../hooks';
import { customerApi } from '../api';
import { ItemPhoto } from '../components/item-photo';
import { Deadline } from '../components/deadline';
import { RecentBookingCards } from '../components/recent-booking-cards';
import { rupiah, wib } from '../format';
export function CustomerHomePage() {
  const user = useSession().data!.user;
  const bookings = useBookings();
  const [rentalWindow, setRentalWindow] = useState<RentalWindow | null>(null);
  const pending = useQuery({
    queryKey: ['customer', user.id, 'next-payment'],
    queryFn: ({ signal }) => customerApi.nextPayment(signal),
    refetchInterval: 15_000,
  });
  const catalog = useQuery({
    queryKey: ['catalog', 'customer-home'],
    queryFn: ({ signal }) => customerApi.catalog(1, signal),
  });
  const action = pending.data?.[0];
  const financial = useFinancial(action?.id || '');
  const obligation = financial.data?.booking.obligations.find(
    (row) => row.extensionId === null && row.status === 'open',
  );
  return (
    <div className="customer-home">
      <section
        className="dashboard-bookings customer-latest-bookings"
        aria-labelledby="latest-bookings-title"
      >
        <div className="section-heading">
          <h2 id="latest-bookings-title">Booking terbaru</h2>
          <Link className="booking-view-all" to="/app/bookings">
            Lihat semua <ArrowTopRightIcon aria-hidden="true" />
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
          <RecentBookingCards bookings={bookings.data.slice(0, 3)} compact />
        ) : (
          <div className="empty-state">
            <h3>Belum ada booking</h3>
            <p>Pilih perangkat untuk mulai sewa.</p>
          </div>
        )}
      </section>
      <div className="customer-home-grid">
        <div className="customer-home-main">
          <section
            className="customer-devices"
            aria-labelledby="customer-devices-title"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">Temukan perangkatmu</p>
                <h2 id="customer-devices-title">Pilih perangkat</h2>
              </div>
              <div className="customer-catalog-actions">
                <RentalDateFilter
                  value={rentalWindow}
                  onChange={setRentalWindow}
                />
                <Button asChild variant="outline">
                  <Link to="/catalog">Lihat semua</Link>
                </Button>
              </div>
            </div>
            <p className="customer-section-copy">
              Pilih perangkat dan tanggal sewa.
            </p>
            {catalog.isPending ? (
              <div
                className="customer-device-grid"
                role="status"
                aria-label="Memuat perangkat"
              >
                {[1, 2, 3].map((id) => (
                  <div key={id} className="customer-device-skeleton" />
                ))}
              </div>
            ) : catalog.isError ? (
              <div className="customer-inline-state">
                <p>{errorMessage(catalog.error)}</p>
                <Button
                  variant="outline"
                  onClick={() => void catalog.refetch()}
                >
                  Coba lagi
                </Button>
              </div>
            ) : catalog.data.data.length ? (
              <HomeDeviceGrid
                items={catalog.data.data.slice(0, 6)}
                window={rentalWindow}
              />
            ) : (
              <div className="customer-inline-state">
                <p>Perangkat belum tersedia di katalog.</p>
              </div>
            )}
          </section>
        </div>
        <aside
          className="customer-home-aside"
          aria-label="Informasi dan tindakan sewa"
        >
          <section className="customer-welcome-card">
            <p>Sewa di iRent Semarang</p>
            <h2>Perangkat untuk setiap rencana.</h2>
            <p>Pilih perangkat, booking, lalu bayar.</p>
            <Button asChild variant="outline">
              <Link to="/catalog">Mulai pilih perangkat</Link>
            </Button>
          </section>
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
              <button
                className="text-link"
                onClick={() => void pending.refetch()}
              >
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
                      ? rupiah(
                          obligation.remainingAmount ?? obligation.amountDue,
                        )
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

          {!action && !pending.isPending && !pending.isError && (
            <section className="customer-help-card">
              <h2>Tidak ada pembayaran tertunda</h2>
              <p>
                Cek detail booking untuk jadwal, status verifikasi,
                perpanjangan, dan pengembalian.
              </p>
              <Button asChild variant="outline">
                <Link to="/app/bookings">Buka booking saya</Link>
              </Button>
            </section>
          )}
          <section className="customer-help-card">
            <h2>Sebelum mulai sewa</h2>
            <ol className="rental-checklist">
              <li>
                <Button
                  asChild
                  variant="ghost"
                  className="rental-checklist-action"
                >
                  <Link
                    to="/app/profile"
                    aria-label={
                      user.profile?.completedAt
                        ? 'Profil lengkap, buka profil penyewa'
                        : 'Profil belum lengkap, lengkapi data penyewa'
                    }
                  >
                    <span
                      className={
                        'rental-checklist-icon ' +
                        (user.profile?.completedAt
                          ? 'is-complete'
                          : 'needs-attention')
                      }
                      aria-hidden="true"
                    >
                      {user.profile?.completedAt ? <CheckIcon /> : '!'}
                    </span>
                    <span>
                      <strong>Profil penyewa</strong>
                      <small>
                        {user.profile?.completedAt
                          ? 'Profil lengkap. Siapkan KTP/SIM.'
                          : 'Lengkapi profil dulu.'}
                      </small>
                    </span>
                  </Link>
                </Button>
              </li>
              <li>
                <Button
                  asChild
                  variant="ghost"
                  className="rental-checklist-action"
                >
                  <Link to="/app/new">
                    <span className="rental-checklist-icon" aria-hidden="true">
                      <CalendarIcon />
                    </span>
                    <span>
                      <strong>Jadwal dan perangkat</strong>
                      <small>Pilih jadwal dan cek ketersediaan.</small>
                    </span>
                  </Link>
                </Button>
              </li>
              <li>
                <Button
                  asChild
                  variant="ghost"
                  className="rental-checklist-action"
                >
                  <Link
                    to={
                      action
                        ? '/app/bookings/' + action.id + '/payment'
                        : '/app/bookings'
                    }
                  >
                    <span
                      className={
                        'rental-checklist-icon ' +
                        (action ? 'needs-attention' : '')
                      }
                      aria-hidden="true"
                    >
                      {action ? '!' : <UploadIcon />}
                    </span>
                    <span>
                      <strong>Pembayaran dan bukti</strong>
                      <small>
                        {action
                          ? 'Bayar dan upload bukti.'
                          : 'Cek pembayaran booking kamu.'}
                      </small>
                    </span>
                  </Link>
                </Button>
              </li>
            </ol>
            <p>Upload bukti, lalu tunggu konfirmasi admin.</p>
            <Button asChild variant="outline">
              <Link to="/terms">Ketentuan sewa</Link>
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}
