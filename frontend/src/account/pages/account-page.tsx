import { Link } from 'react-router-dom';
import {
  PersonIcon,
  EnvelopeClosedIcon,
  MobileIcon,
  HomeIcon,
  ReaderIcon,
  LockClosedIcon,
  CheckIcon,
  InfoCircledIcon,
  ChevronRightIcon,
  Pencil1Icon,
} from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { useSession } from '@/auth/session';
import { useProfile } from '@/customer/hooks';
import { errorMessage } from '@/services/api';
import type { User } from '@/auth/types';
import './account-page.css';
import { ChangePasswordPanel } from '../components/change-password-panel';
function LoginDetails({ user }: { user: User }) {
  return (
    <section className="account-panel" aria-labelledby="login-details-title">
      <header className="account-panel-heading">
        <span className="account-panel-icon">
          <LockClosedIcon aria-hidden="true" />
        </span>
        <div>
          <h2 id="login-details-title">Informasi akun</h2>
          <p>Identitas yang digunakan untuk masuk ke iRent.</p>
        </div>
      </header>
      <dl className="account-info-grid">
        <div>
          <dt>Nama akun</dt>
          <dd>{user.name}</dd>
        </div>
        <div>
          <dt>Akses</dt>
          <dd>{user.role === 'admin' ? 'Admin' : 'Pelanggan'}</dd>
        </div>
        <div>
          <dt>Email masuk</dt>
          <dd>{user.email || 'Tidak dicantumkan'}</dd>
        </div>
        <div>
          <dt>Nomor HP masuk</dt>
          <dd>{user.phone || 'Tidak dicantumkan'}</dd>
        </div>
      </dl>
      <p className="account-panel-footnote">
        Nomor HP masuk dapat berbeda dari nomor kontak pada profil penyewa.
      </p>
    </section>
  );
}
function CustomerAccount({ user }: { user: User }) {
  const profile = useProfile();
  const data = profile.data;
  const complete = !!data?.completedAt;
  const initials = user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return (
    <div className="account-workspace">
      <aside className="account-identity-column">
        <section className="account-identity-card">
          <div className="account-cover" aria-hidden="true" />
          <div className="account-identity-body">
            <div className="account-portrait" aria-hidden="true">
              {initials}
            </div>
            <p className="account-role-label">Pelanggan iRent</p>
            <h2>{data?.fullName || user.name}</h2>
            <p className="account-identity-contact">
              {user.email || user.phone || 'Akun pelanggan'}
            </p>
            <span
              className={
                'account-profile-status ' + (complete ? 'is-complete' : '')
              }
            >
              {profile.isPending ? (
                'Memuat profil'
              ) : profile.isError ? (
                'Status belum tersedia'
              ) : complete ? (
                <>
                  <CheckIcon aria-hidden="true" />
                  Profil lengkap
                </>
              ) : (
                <>
                  <InfoCircledIcon aria-hidden="true" />
                  Profil belum lengkap
                </>
              )}
            </span>
            <Button asChild variant="outline">
              <Link to="/app/profile">
                <Pencil1Icon aria-hidden="true" />
                {complete ? 'Edit profil penyewa' : 'Lengkapi profil penyewa'}
              </Link>
            </Button>
          </div>
        </section>
        <section className="account-readiness">
          <h2>Kesiapan sebelum sewa</h2>
          <p>Data wajib untuk membuat booking pertama.</p>
          {profile.isPending ? (
            <div className="account-loading" role="status">
              Memuat data penyewa...
            </div>
          ) : profile.isError ? (
            <div className="account-profile-error">
              <p>{errorMessage(profile.error)}</p>
              <Button variant="outline" onClick={() => void profile.refetch()}>
                Coba lagi
              </Button>
            </div>
          ) : (
            <ul>
              {[
                ['Nama lengkap', !!data?.fullName],
                ['Nomor HP aktif', !!data?.phoneActive],
                ['Alamat penyewa', !!data?.address],
                ['NIK tersimpan', complete],
              ].map(([label, done]) => (
                <li key={String(label)}>
                  <span
                    className={done ? 'is-ready' : 'is-missing'}
                    aria-label={done ? 'Sudah terisi' : 'Belum lengkap'}
                  >
                    {done ? <CheckIcon aria-hidden="true" /> : '!'}
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          )}
          <div className="account-identity-note">
            <LockClosedIcon aria-hidden="true" />
            <p>
              NIK tidak ditampilkan kembali. Siapkan KTP/SIM saat pengambilan
              perangkat.
            </p>
          </div>
        </section>
      </aside>
      <div className="account-settings-column">
        <LoginDetails user={user} />
        <ChangePasswordPanel />
        <section
          className="account-panel"
          aria-labelledby="renter-details-title"
        >
          <header className="account-panel-heading">
            <span className="account-panel-icon">
              <PersonIcon aria-hidden="true" />
            </span>
            <div>
              <h2 id="renter-details-title">Profil penyewa</h2>
              <p>Kontak dan alamat untuk kebutuhan sewa.</p>
            </div>
            <Button asChild variant="outline">
              <Link to="/app/profile">Edit profil</Link>
            </Button>
          </header>
          {profile.isPending ? (
            <div className="account-loading" role="status">
              Memuat profil penyewa...
            </div>
          ) : profile.isError ? (
            <p className="account-unavailable">
              Profil belum bisa dimuat. Gunakan tombol Coba lagi pada panel
              kesiapan.
            </p>
          ) : (
            <>
              <dl className="account-renter-details">
                <div>
                  <dt>
                    <PersonIcon aria-hidden="true" />
                    Nama lengkap
                  </dt>
                  <dd>{data?.fullName || 'Belum diisi'}</dd>
                </div>
                <div>
                  <dt>
                    <MobileIcon aria-hidden="true" />
                    Nomor HP aktif
                  </dt>
                  <dd>{data?.phoneActive || 'Belum diisi'}</dd>
                </div>
                <div className="account-address">
                  <dt>
                    <HomeIcon aria-hidden="true" />
                    Alamat
                  </dt>
                  <dd>
                    {data?.address ||
                      'Lengkapi alamat sebelum membuat booking.'}
                  </dd>
                </div>
              </dl>
              {!complete && (
                <div className="account-incomplete-note">
                  <InfoCircledIcon aria-hidden="true" />
                  <p>
                    Lengkapi profil agar kamu bisa melanjutkan pemesanan
                    perangkat.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
        <section
          className="account-panel"
          aria-labelledby="additional-contact-title"
        >
          <header className="account-panel-heading">
            <span className="account-panel-icon">
              <EnvelopeClosedIcon aria-hidden="true" />
            </span>
            <div>
              <h2 id="additional-contact-title">Kontak tambahan</h2>
              <p>Opsional, untuk memudahkan komunikasi terkait sewa.</p>
            </div>
            <span className="account-optional-label">Opsional</span>
          </header>
          {profile.isPending ? (
            <div className="account-loading" role="status">
              Memuat kontak...
            </div>
          ) : profile.isError ? (
            <p className="account-unavailable">Kontak belum bisa dimuat.</p>
          ) : (
            <dl className="account-contact-grid">
              <div>
                <dt>Nomor alternatif</dt>
                <dd className={!data?.phoneAlt ? 'is-empty' : ''}>
                  {data?.phoneAlt || 'Belum ditambahkan'}
                </dd>
              </div>
              <div>
                <dt>Email kontak</dt>
                <dd className={!data?.emailContact ? 'is-empty' : ''}>
                  {data?.emailContact || 'Belum ditambahkan'}
                </dd>
              </div>
              <div>
                <dt>Instagram</dt>
                <dd className={!data?.instagram ? 'is-empty' : ''}>
                  {data?.instagram || 'Belum ditambahkan'}
                </dd>
              </div>
            </dl>
          )}
          <footer className="account-card-actions">
            <p>Kontak tambahan tidak wajib untuk booking.</p>
            <Button asChild variant="outline">
              <Link to="/app/profile">Kelola kontak</Link>
            </Button>
          </footer>
        </section>
        <div className="account-shortcut-grid">
          <section className="account-shortcut-card">
            <ReaderIcon aria-hidden="true" />
            <h2>Aktivitas sewa</h2>
            <p>
              Pantau jadwal, pembayaran, perpanjangan, dan pengembalian dari
              detail booking.
            </p>
            <Button asChild variant="outline">
              <Link to="/app/bookings">
                Booking saya
                <ChevronRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </section>
          <section className="account-shortcut-card">
            <InfoCircledIcon aria-hidden="true" />
            <h2>Ketentuan & bantuan</h2>
            <p>
              Pelajari aturan sewa. Untuk bantuan akses akun atau password,
              hubungi admin iRent.
            </p>
            <Button asChild variant="outline">
              <Link to="/terms">
                Baca ketentuan
                <ChevronRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
export function AccountPage() {
  const user = useSession().data?.user;
  if (!user) return null;
  return (
    <div className="account-page">
      <header className="page-heading account-page-heading">
        <p className="eyebrow">
          {user.role === 'admin' ? 'Admin iRent' : 'Personal'}
        </p>
        <h1>Akun saya</h1>
        <p>Informasi pribadi dan kebutuhan sewamu, dalam satu tempat.</p>
      </header>
      {user.role === 'customer' ? (
        <CustomerAccount user={user} />
      ) : (
        <>
          <LoginDetails user={user} />
          <ChangePasswordPanel admin />
        </>
      )}
    </div>
  );
}
