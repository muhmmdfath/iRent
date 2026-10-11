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
  const [editing, setEditing] = useState<Zone | 'new' | null>(null);
  return (
    <>
      <header className="page-heading">
        <h1>Zona antar-jemput</h1>
        <p>
          Tarif berlaku sekali untuk booking baru. Nonaktifkan zona untuk
          menghentikan pilihan baru.
        </p>
        <Button disabled={!!editing} onClick={() => setEditing('new')}>
          Tambah zona
        </Button>
      </header>
      {editing && (
        <BusinessForm
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
      )}
      {query.isPending ? (
        <LoadingState text="Memuat zona..." />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <section className="form-section">
          {query.data.length ? (
            query.data.map((zone) => (
              <article className="management-row" key={zone.id}>
                <div>
                  <h2>{zone.name}</h2>
                  <p>
                    {rupiah(zone.fee)} · {zone.isActive ? 'Aktif' : 'Nonaktif'}
                  </p>
                </div>
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
            <p className="muted">Belum ada zona antar-jemput.</p>
          )}
        </section>
      )}
    </>
  );
}
