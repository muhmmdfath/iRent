import {
  AdminWorkspace,
  AdminHeader,
  AdminHint,
  AdminModal,
} from './workspace';
import {
  GearIcon,
  CalendarIcon,
  CardStackIcon,
  TimerIcon,
  ResetIcon,
  ImageIcon,
} from '@radix-ui/react-icons';
import { rupiah } from '@/customer/format';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminRead } from './hooks';
import { BusinessForm, type ActionField } from '@/components/business-form';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { api, errorMessage } from '@/services/api';
import { ItemPhoto } from '@/customer/components/item-photo';
import { PhotoForm } from '@/admin/inventory/photo-form';
type Settings = {
  revision: string;
  values: Record<string, string | number | boolean | null>;
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
const groups = [
  {
    id: 'payment',
    title: 'Pembayaran & konfirmasi',
    description: 'DP, batas bayar, dan tenggat pemeriksaan.',
    icon: CardStackIcon,
    keys: [
      'dp_amount',
      'hold_minutes',
      'urgent_threshold_minutes',
      'urgent_hold_minutes',
      'confirm_sla_hours',
      'urgent_confirm_minutes',
      'confirm_before_pickup_minutes',
      'confirmation_reminder_minutes',
      'pickup_escalation_minutes',
    ],
  },
  {
    id: 'schedule',
    title: 'Jadwal & jam layanan',
    description: 'Jam buka, durasi, dan batas pengambilan.',
    icon: CalendarIcon,
    keys: [
      'open_time',
      'close_time',
      'min_lead_minutes',
      'max_duration_hours',
      'booking_open_day',
      'no_show_minutes',
    ],
  },
  {
    id: 'operations',
    title: 'Persiapan & denda',
    description: 'Buffer unit dan biaya keterlambatan.',
    icon: TimerIcon,
    keys: ['buffer_minutes', 'late_tolerance_minutes', 'late_fee_per_hour'],
  },
  {
    id: 'refund',
    title: 'Pembatalan & refund',
    description: 'Batas waktu dan persentase pengembalian.',
    icon: ResetIcon,
    keys: [
      'cancel_refund_cutoff_days',
      'cancel_refund_percent',
      'cancel_full_refund_percent',
    ],
  },
  {
    id: 'extension',
    title: 'Perpanjangan',
    description: 'Pengajuan, pembayaran, dan persetujuan.',
    icon: GearIcon,
    keys: [
      'extension_min_lead_minutes',
      'extension_hold_minutes',
      'extension_confirm_minutes',
      'extension_confirm_before_return_minutes',
    ],
  },
  {
    id: 'qris',
    title: 'QRIS toko',
    description: 'Gambar QRIS untuk pembayaran pelanggan.',
    icon: ImageIcon,
    keys: [],
  },
];
export function SettingsPage() {
  const queryClient = useQueryClient();
  const query = useAdminRead<Settings>('settings', '/admin/settings');
  const [edit, setEdit] = useState(false);
  const [group, setGroup] = useState('payment');
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [removePhoto, setRemovePhoto] = useState(false);
  const deliveryFee = useMutation({
    mutationFn: (enabled: boolean) =>
      api.patch('/admin/settings', {
        values: { delivery_fee_enabled: enabled },
      }),
    onSuccess: async () => {
      await Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({ queryKey: ['rental-policy'] }),
      ]);
    },
  });
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
  const selected = groups.find((value) => value.id === group)!;
  const visibleFields = fields.filter((field) =>
    selected.keys.includes(field.name),
  );
  return (
    <AdminWorkspace kind="settings">
      <AdminHeader
        section="Konfigurasi"
        title="Pengaturan sewa"
        description="Atur kebijakan rental dan pembayaran tanpa mengubah kesepakatan transaksi lama."
      />
      <AdminHint>
        Perubahan berlaku untuk booking berikutnya. Harga dan aturan pada
        transaksi lama mengikuti snapshot masing-masing.
      </AdminHint>
      <section className="form-section am-delivery-fee-setting">
        <div className="am-panel-heading">
          <div>
            <h2>Ongkir dalam aplikasi</h2>
            <p>
              {values.delivery_fee_enabled !== false
                ? 'Aktif · ongkir dihitung berdasarkan zona dan masuk tagihan.'
                : 'Nonaktif · antar-jemput tetap tersedia; ongkir diinformasikan lewat chat.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Ongkir dalam aplikasi"
            aria-checked={values.delivery_fee_enabled !== false}
            disabled={deliveryFee.isPending || edit || photo || removePhoto}
            className="am-delivery-fee-switch"
            onClick={() =>
              deliveryFee.mutate(values.delivery_fee_enabled === false)
            }
          >
            <span aria-hidden="true" className="am-switch-track">
              <span />
            </span>
            {deliveryFee.isPending
              ? 'Menyimpan…'
              : values.delivery_fee_enabled !== false
                ? 'Aktif'
                : 'Nonaktif'}
          </button>
        </div>
        <p className="muted text-sm">
          Berlaku untuk booking baru. Saat nonaktif, ongkir dibayar dan dicatat
          di luar aplikasi; laporan dan refund aplikasi hanya mencakup tagihan
          di aplikasi.
        </p>
        {deliveryFee.isError && (
          <p role="alert" className="form-error">
            {errorMessage(deliveryFee.error)}
          </p>
        )}
      </section>
      <div className="am-settings-layout">
        <nav className="am-settings-nav" aria-label="Kelompok pengaturan">
          {groups.map((value) => (
            <button
              key={value.id}
              type="button"
              aria-pressed={group === value.id}
              disabled={edit || photo || removePhoto}
              onClick={() => setGroup(value.id)}
            >
              <value.icon aria-hidden="true" />
              <span>{value.title}</span>
            </button>
          ))}
        </nav>
        <div>
          {group !== 'qris' && (
            <section className="form-section">
              <header className="am-panel-heading">
                <div>
                  <h2>{selected.title}</h2>
                  <p>{selected.description}</p>
                </div>
                <Button
                  disabled={edit || photo || removePhoto}
                  onClick={() => setEdit(true)}
                >
                  Ubah pengaturan
                </Button>
              </header>
              <dl className="am-settings-values">
                {visibleFields.map((field) => (
                  <div key={field.name}>
                    <dt>{field.label}</dt>
                    <dd>
                      {field.type === 'money'
                        ? rupiah(field.value || '0')
                        : field.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {edit && (
            <AdminModal
              title="Ubah pengaturan"
              description={selected.title}
              busy={saving}
              onClose={() => setEdit(false)}
            >
              <BusinessForm
                onBusy={setSaving}
                title="Simpan pengaturan sewa"
                fields={visibleFields}
                execute={async (input) =>
                  api.patch('/admin/settings', {
                    values: Object.fromEntries(
                      Object.entries(input)
                        .filter(
                          ([name]) => String(values[name]) !== input[name],
                        )
                        .map(([name, value]) => [
                          name,
                          typeof values[name] === 'number'
                            ? Number(value)
                            : value,
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
            </AdminModal>
          )}
          {group === 'qris' && (
            <section className="form-section am-qris-panel">
              <h2>Gambar QRIS</h2>
              <p>
                Unggah QRIS resmi toko. Jangan memakai QRIS dummy untuk
                pembayaran nyata.
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
          )}
        </div>
      </div>
    </AdminWorkspace>
  );
}
