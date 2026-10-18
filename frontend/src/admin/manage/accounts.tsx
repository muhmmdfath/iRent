import { PAGE_SIZE } from '@/lib/pagination';
import {
  AdminWorkspace,
  AdminHeader,
  AdminBadge,
  AdminHint,
  AdminEmpty,
  AdminModal,
  PlusIcon,
} from './workspace';
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
  const [saving, setSaving] = useState(false);
  const query = useAdminRead<Page<Account>>(
    admins ? 'accounts' : 'customers',
    admins ? '/admin/accounts' : '/admin/customers',
    { search: term || undefined, page, limit: PAGE_SIZE },
  );
  return (
    <AdminWorkspace kind={admins ? 'accounts' : 'customers'}>
      <AdminHeader
        section="Manajemen akun"
        title={admins ? 'Admin' : 'Data penyewa'}
        description={
          admins
            ? 'Kelola akun petugas. Setiap admin memakai identitas login sendiri.'
            : 'Temukan informasi kontak, kelengkapan profil, dan riwayat sewa.'
        }
        actions={
          admins && (
            <Button disabled={create} onClick={() => setCreate(true)}>
              <PlusIcon aria-hidden="true" /> Tambah admin
            </Button>
          )
        }
      />
      <AdminHint>
        {admins
          ? 'Semua petugas memiliki hak admin yang sama. Gunakan akun masing-masing agar aktivitas dapat ditelusuri.'
          : 'Data identitas tidak ditampilkan dalam daftar. Buka detail penyewa untuk pemeriksaan yang diaudit.'}
      </AdminHint>
      {create && (
        <AdminModal
          title="Tambah admin"
          description="Buat akun petugas dengan identitas login sendiri."
          busy={saving}
          onClose={() => setCreate(false)}
        >
          <BusinessForm
            onBusy={setSaving}
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
        </AdminModal>
      )}
      <form
        className="management-filter am-search-toolbar"
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
          <section className="form-section am-directory">
            <header className="am-panel-heading">
              <h2>{admins ? 'Daftar petugas' : 'Direktori penyewa'}</h2>
              <span>{query.data.total} akun</span>
            </header>
            {query.data.data.length ? (
              query.data.data.map((account) => (
                <article className="am-person-row" key={account.id}>
                  <span className="am-avatar" aria-hidden="true">
                    {account.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="am-person-info">
                    <h2>{account.name}</h2>
                    <p>
                      {account.email ||
                        account.phone ||
                        'Kontak belum tersedia'}
                    </p>
                  </div>
                  <div className="am-person-state">
                    <AdminBadge tone={account.isActive ? 'green' : 'neutral'}>
                      {account.isActive ? 'Aktif' : 'Nonaktif'}
                    </AdminBadge>
                    <small>
                      {admins
                        ? 'Administrator'
                        : account.profile?.completedAt
                          ? 'Profil lengkap'
                          : 'Profil belum lengkap'}
                    </small>
                  </div>
                  {!admins && (
                    <div className="am-person-count">
                      <strong>{account._count.bookings}</strong>
                      <span>booking</span>
                    </div>
                  )}
                  {!admins && (
                    <Button variant="outline" asChild>
                      <Link to={'/admin/customers/' + account.id}>
                        Detail penyewa
                      </Link>
                    </Button>
                  )}
                </article>
              ))
            ) : (
              <AdminEmpty
                title="Belum ada akun yang sesuai."
                description="Coba nama, email, atau nomor telepon lain."
              />
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
    </AdminWorkspace>
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
    <AdminWorkspace kind="customer-detail">
      <Link className="back-link" to="/admin/customers">
        Data penyewa
      </Link>
      <AdminHeader
        section="Data penyewa"
        title={customer.name}
        description={
          customer.email || customer.phone || 'Kontak belum tersedia'
        }
      />
      <div className="am-detail-columns">
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
      </div>
      <Link className="text-link" to={`/admin/bookings?customerId=${id}`}>
        Riwayat booking penyewa
      </Link>
    </AdminWorkspace>
  );
}
