import { PAGE_SIZE } from '@/lib/pagination';
import { Pager } from './components';
import {
  AdminWorkspace,
  AdminHeader,
  AdminBadge,
  AdminHint,
  AdminEmpty,
  AdminModal,
  PlusIcon,
} from './workspace';
import { Input } from '@/components/ui/input';
import { SewingPinIcon } from '@radix-ui/react-icons';
import { useState } from 'react';
import { useAdminRead } from './hooks';
import { BusinessForm } from '@/components/business-form';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { rupiah } from '@/customer/format';
import { api } from '@/services/api';
interface Zone {
  id: string;
  name: string;
  fee: string;
  isActive: boolean;
}
export function ZonesPage() {
  const query = useAdminRead<Zone[]>('zones', '/admin/delivery-zones');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Zone | 'new' | null>(null);
  const matching =
    query.data?.filter((zone) =>
      zone.name
        .toLocaleLowerCase('id')
        .includes(search.toLocaleLowerCase('id')),
    ) || [];
  const shown = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <AdminWorkspace kind="zones">
      <AdminHeader
        section="Pengiriman"
        title="Zona antar-jemput"
        description="Atur wilayah layanan dan tarif antar-jemput untuk booking baru."
        actions={
          <Button disabled={!!editing} onClick={() => setEditing('new')}>
            <PlusIcon aria-hidden="true" /> Tambah zona
          </Button>
        }
      />
      <AdminHint>
        Tarif berlaku sekali per booking baru. Nonaktifkan zona untuk
        menghentikan pilihan baru; tarif transaksi lama tetap tersimpan.
      </AdminHint>
      <div className="am-search-toolbar">
        <label className="field">
          Cari kecamatan
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Contoh: Tembalang"
          />
        </label>
      </div>
      {editing && (
        <AdminModal
          title={editing === 'new' ? 'Tambah zona' : 'Ubah zona'}
          description="Atur tarif dan status layanan di wilayah ini."
          busy={saving}
          onClose={() => setEditing(null)}
        >
          <BusinessForm
            onBusy={setSaving}
            key={typeof editing === 'string' ? editing : editing.id}
            title={editing === 'new' ? 'Tambah zona' : 'Simpan zona'}
            idempotent={editing !== 'new'}
            fields={[
              {
                name: 'name',
                label: 'Nama kecamatan',
                min: 1,
                max: 100,
                value: editing === 'new' ? '' : editing.name,
              },
              {
                name: 'fee',
                label: 'Tarif antar-jemput (rupiah)',
                type: 'money',
                value: editing === 'new' ? '0' : editing.fee,
              },
              {
                name: 'isActive',
                label: 'Status zona',
                type: 'select',
                value: editing === 'new' ? 'true' : String(editing.isActive),
                options: [
                  { value: 'true', label: 'Aktif' },
                  { value: 'false', label: 'Nonaktif' },
                ],
              },
            ]}
            execute={async (input) => {
              const body = { ...input, isActive: input.isActive === 'true' };
              return editing === 'new'
                ? api.post('/admin/delivery-zones', body)
                : api.put('/admin/delivery-zones/' + editing.id, body);
            }}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        </AdminModal>
      )}
      {query.isPending ? (
        <LoadingState text="Memuat zona..." />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <section className="form-section am-zone-list">
          {matching.length ? (
            shown.map((zone) => (
              <article className="management-row" key={zone.id}>
                <span className="am-zone-icon">
                  <SewingPinIcon aria-hidden="true" />
                </span>
                <div>
                  <h2>{zone.name}</h2>
                  <p>Tarif per booking</p>
                </div>
                <strong className="am-zone-fee">{rupiah(zone.fee)}</strong>
                <AdminBadge tone={zone.isActive ? 'green' : 'neutral'}>
                  {zone.isActive ? 'Aktif' : 'Nonaktif'}
                </AdminBadge>
                <Button
                  variant="outline"
                  disabled={!!editing}
                  onClick={() => setEditing(zone)}
                >
                  Ubah {zone.name}
                </Button>
              </article>
            ))
          ) : (
            <AdminEmpty
              title={
                search
                  ? 'Tidak ada kecamatan yang sesuai'
                  : 'Belum ada zona antar-jemput.'
              }
              description="Tambahkan wilayah layanan beserta tarifnya."
            />
          )}
          <Pager page={page} total={matching.length} setPage={setPage} />
        </section>
      )}
    </AdminWorkspace>
  );
}
