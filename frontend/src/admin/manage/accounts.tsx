import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/services/api';
import { useAdminRead, type Page } from './hooks';
import { Pager } from './components';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BusinessForm } from '@/components/business-form';
import { LoadingState, ErrorState } from '@/components/feedback';
import { wib } from '@/customer/format';
interface Account {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  profile: { completedAt: string | null } | null;
  _count: { bookings: number };
}
interface Customer extends Omit<Account, 'profile'> {
  profile: {
    fullName: string;
    address: string;
    phoneActive: string;
    phoneAlt: string | null;
    instagram: string | null;
    emailContact: string | null;
    nik: string;
    completedAt: string;
  } | null;
}
export function AccountsPage({ admins = false }: { admins?: boolean }) {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [create, setCreate] = useState(false);
  const query = useAdminRead<Page<Account>>(
    admins ? 'accounts' : 'customers',
    admins ? '/admin/accounts' : '/admin/customers',
    { search: term || undefined, page, limit: 20 },
  );
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Akun iRent</p>
        <h1>{admins ? 'Admin' : 'Data penyewa'}</h1>
        <p>
          {admins
            ? 'Setiap petugas memakai akun sendiri dengan hak admin yang sama.'
            : 'Profil dan riwayat penyewa. NIK hanya tersedia pada detail yang diaudit.'}
        </p>
        {admins && (
          <Button disabled={create} onClick={() => setCreate(true)}>
            Tambah admin
          </Button>
        )}
      </header>
      {create && (
        <BusinessForm
          title="Buat akun admin"
          description="Simpan password baru secara aman dan sampaikan kepada petugas terkait."
          idempotent={false}
          fields={[
            { name: 'name', label: 'Nama', min: 1, max: 100 },
            { name: 'email', label: 'Email', type: 'email', max: 254 },
            {
              name: 'password',
              label: 'Password baru',
              type: 'password',
              min: 12,
              max: 128,
            },
          ]}
          execute={async (input) => api.post('/admin/accounts', input)}
          onDone={() => setCreate(false)}
          onCancel={() => setCreate(false)}
        />
      )}
      <form
        className="management-filter"
        onSubmit={(event) => {
          event.preventDefault();
          setTerm(search);
          setPage(1);
        }}
      >
        <label className="field">
          Cari nama, email atau telepon
          <Input
            value={search}
            maxLength={150}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <Button>Cari</Button>
      </form>
      {query.isPending ? (
        <LoadingState text="Memuat akun..." />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <section className="form-section">
            {query.data.data.length ? (
              query.data.data.map((account) => (
                <article className="management-row" key={account.id}>
                  <div>
                    <h2>{account.name}</h2>
                    <p>{account.email || account.phone}</p>
                    <p className="muted">
                      {account.isActive ? 'Aktif' : 'Nonaktif'}
                      {!admins
                        ? ` · ${account._count.bookings} booking · ${account.profile?.completedAt ? 'Profil lengkap' : 'Profil belum lengkap'}`
                        : ''}
                    </p>
                  </div>
                  {!admins && (
                    <Link
                      className="text-link"
                      to={'/admin/customers/' + account.id}
                    >
                      Detail penyewa
                    </Link>
                  )}
                </article>
              ))
            ) : (
              <p className="muted">Belum ada akun yang sesuai.</p>
            )}
          </section>
          <Pager
            page={page}
            total={query.data.total}
            setPage={setPage}
            busy={query.isFetching}
          />
        </>
      )}
    </>
  );
}
export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const query = useAdminRead<Customer>(
    'customer-' + id,
    '/admin/customers/' + id,
  );
  const [reset, setReset] = useState(false);
  const [showNik, setShowNik] = useState(false);
  const [done, setDone] = useState(false);
  if (query.isPending) return <LoadingState text="Memuat profil penyewa..." />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const customer = query.data;
  const profile = customer.profile;
  return (
    <>
      <Link className="back-link" to="/admin/customers">
        Data penyewa
      </Link>
      <header className="page-heading">
        <h1>{customer.name}</h1>
        <p>{customer.email || customer.phone}</p>
      </header>
      <section className="form-section">
        <h2>Profil penyewa</h2>
        {profile ? (
          <>
            <dl className="price-breakdown">
              <div>
                <dt>Alamat</dt>
                <dd>{profile.address}</dd>
              </div>
              <div>
                <dt>Nomor aktif</dt>
                <dd>{profile.phoneActive}</dd>
              </div>
              <div>
                <dt>Nomor alternatif</dt>
                <dd>{profile.phoneAlt || '—'}</dd>
              </div>
              <div>
                <dt>Email kontak</dt>
                <dd>{profile.emailContact || '—'}</dd>
              </div>
              <div>
                <dt>Instagram</dt>
                <dd>{profile.instagram || '—'}</dd>
              </div>
              <div>
                <dt>Profil lengkap</dt>
                <dd>{wib(profile.completedAt)}</dd>
              </div>
            </dl>
            <Button variant="outline" onClick={() => setShowNik(!showNik)}>
              {showNik ? 'Sembunyikan NIK' : 'Tampilkan NIK'}
            </Button>
            {showNik && <p className="info-note">NIK: {profile.nik}</p>}
          </>
        ) : (
          <p className="muted">Profil belum dilengkapi.</p>
        )}
      </section>
      <section className="form-section">
        <h2>Akses akun</h2>
        <p>Reset password mengakhiri seluruh sesi pelanggan.</p>
        {done && (
          <p className="success-note" role="status">
            Password berhasil diganti.
          </p>
        )}
        <Button
          variant="outline"
          disabled={reset}
          onClick={() => {
            setDone(false);
            setReset(true);
          }}
        >
          Ganti password pelanggan
        </Button>
        {reset && (
          <BusinessForm
            title="Ganti password pelanggan"
            fields={[
              {
                name: 'password',
                label: 'Password baru',
                type: 'password',
                min: 12,
                max: 128,
              },
            ]}
            execute={async (input) =>
              api.post(`/admin/customers/${id}/password`, input)
            }
            onDone={() => {
              setReset(false);
              setDone(true);
            }}
            onCancel={() => setReset(false)}
          />
        )}
      </section>
      <Link className="text-link" to={`/admin/bookings?customerId=${id}`}>
        Riwayat booking penyewa
      </Link>
    </>
  );
}
