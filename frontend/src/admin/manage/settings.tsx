import { useState } from 'react';
import { useAdminRead } from './hooks';
import { BusinessForm, type ActionField } from '@/components/business-form';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { api } from '@/services/api';
import { ItemPhoto } from '@/customer/components/item-photo';
import { PhotoForm } from '@/admin/inventory/photo-form';
type Settings = {
  revision: string;
  values: Record<string, string | number | null>;
};
const labels: Record<string, string> = {
  dp_amount: 'DP (rupiah)',
  hold_minutes: 'Batas bayar reguler (menit)',
  urgent_threshold_minutes: 'Batas booking mendadak (menit)',
  urgent_hold_minutes: 'Batas bayar mendadak (menit)',
  min_lead_minutes: 'Jarak minimal pengambilan (menit)',
  confirm_sla_hours: 'Batas konfirmasi reguler (jam)',
  urgent_confirm_minutes: 'Batas konfirmasi mendadak (menit)',
  confirm_before_pickup_minutes: 'Konfirmasi sebelum pengambilan (menit)',
  confirmation_reminder_minutes: 'Pengingat konfirmasi (menit)',
  pickup_escalation_minutes: 'Eskalasi pengambilan (menit)',
  buffer_minutes: 'Persiapan unit (menit)',
  late_tolerance_minutes: 'Toleransi terlambat (menit)',
  late_fee_per_hour: 'Denda per jam (rupiah)',
  open_time: 'Jam buka (WIB)',
  close_time: 'Jam tutup (WIB)',
  max_duration_hours: 'Durasi maksimal (jam)',
  booking_open_day: 'Tanggal pembukaan booking bulan depan',
  no_show_minutes: 'Batas no-show (menit)',
  cancel_refund_cutoff_days: 'Batas refund pembatalan (hari)',
  cancel_refund_percent: 'Refund DP (%)',
  cancel_full_refund_percent: 'Refund lunas (%)',
  extension_min_lead_minutes: 'Batas pengajuan perpanjangan (menit)',
  extension_hold_minutes: 'Batas bayar perpanjangan (menit)',
  extension_confirm_minutes: 'Konfirmasi perpanjangan (menit)',
  extension_confirm_before_return_minutes: 'Konfirmasi sebelum kembali (menit)',
};
export function SettingsPage() {
  const query = useAdminRead<Settings>('settings', '/admin/settings');
  const [edit, setEdit] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [removePhoto, setRemovePhoto] = useState(false);
  if (query.isPending) return <LoadingState text="Memuat pengaturan..." />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const values = query.data.values;
  const fields: ActionField[] = Object.entries(labels).map(([name, label]) => ({
    name,
    label,
    value: String(values[name] ?? ''),
    type: name.endsWith('_time')
      ? 'time'
      : name === 'dp_amount' || name === 'late_fee_per_hour'
        ? 'money'
        : 'number',
    min: 0,
    max: name.includes('percent')
      ? 100
      : name === 'booking_open_day'
        ? 28
        : 2147483647,
  }));
  return (
    <>
      <header className="page-heading">
        <h1>Pengaturan sewa</h1>
        <p>
          Perubahan berlaku untuk transaksi berikutnya. Snapshot booking lama
          tetap dipakai.
        </p>
      </header>
      <section className="form-section">
        <div className="section-heading">
          <h2>Aturan bisnis</h2>
          <Button
            disabled={edit || photo || removePhoto}
            onClick={() => setEdit(true)}
          >
            Ubah pengaturan
          </Button>
        </div>
        <dl className="settings-values">
          {fields.map((field) => (
            <div key={field.name}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      </section>
      {edit && (
        <BusinessForm
          title="Simpan pengaturan sewa"
          fields={fields}
          execute={async (input) =>
            api.patch('/admin/settings', {
              values: Object.fromEntries(
                Object.entries(input)
                  .filter(([name]) => String(values[name]) !== input[name])
                  .map(([name, value]) => [
                    name,
                    typeof values[name] === 'number' ? Number(value) : value,
                  ]),
              ),
            })
          }
          validate={(input) => {
            if (
              !Object.keys(input).some(
                (name) => String(values[name]) !== input[name],
              )
            )
              throw new Error('Belum ada pengaturan yang berubah.');
          }}
          onDone={() => {
            setEdit(false);
            void query.refetch();
          }}
          onCancel={() => setEdit(false)}
        />
      )}
      <section className="form-section">
        <h2>Gambar QRIS</h2>
        <p>
          Unggah QRIS resmi toko. Jangan memakai QRIS dummy untuk pembayaran
          nyata.
        </p>
        {values.qris_image_path && (
          <ItemPhoto
            path={String(values.qris_image_path)}
            name="QRIS toko"
            className="qris-image"
          />
        )}
        <Button
          variant="outline"
          disabled={photo || edit || removePhoto}
          onClick={() => setPhoto(true)}
        >
          Upload QRIS
        </Button>
        {values.qris_image_path && (
          <Button
            variant="outline"
            disabled={photo || edit || removePhoto}
            onClick={() => setRemovePhoto(true)}
          >
            Hapus QRIS
          </Button>
        )}
        {removePhoto && (
          <BusinessForm
            title="Hapus QRIS toko"
            description="QRIS tidak akan ditampilkan untuk pembayaran berikutnya."
            execute={async () =>
              api.patch('/admin/settings', {
                values: { qris_image_path: null },
              })
            }
            onDone={() => {
              setRemovePhoto(false);
              void query.refetch();
            }}
            onCancel={() => setRemovePhoto(false)}
          />
        )}
        {photo && (
          <PhotoForm
            id="qris"
            qris
            onDone={() => {
              setPhoto(false);
              void query.refetch();
            }}
            onCancel={() => setPhoto(false)}
          />
        )}
      </section>
    </>
  );
}
