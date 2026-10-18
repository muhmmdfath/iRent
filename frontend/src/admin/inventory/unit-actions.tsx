import { InventoryActionMenu } from './action-menu';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOnline } from '@/hooks/use-online';
import { wib } from '@/customer/format';
import { inventoryApi } from './api';
import { InventoryConfirm } from './confirm';
import { useInventoryClock } from './hooks';
import type { InventoryItem, InventoryUnit } from './types';
const physicalLabels: Record<InventoryUnit['physicalStatus'], string> = {
  ready: 'Siap secara fisik',
  in_use: 'Sedang digunakan',
  awaiting_check: 'Menunggu pemeriksaan/perawatan',
  in_transit: 'Dalam perjalanan',
  preparing: 'Dalam persiapan',
  lost: 'Hilang',
};
export function AddUnitsForm({
  item,
  onDone,
  onCancel,
  onBusy,
}: {
  item: InventoryItem;
  onDone: () => void;
  onCancel: () => void;
  onBusy?: (busy: boolean) => void;
}) {
  const online = useOnline();
  const [value, setValue] = useState(''),
    [error, setError] = useState(''),
    [review, setReview] = useState<
      { codes: string[] } | { quantity: number } | null
    >(null);
  function prepare(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (item.category === 'accessory') {
      const quantity = Number(value);
      if (
        !/^\d+$/.test(value) ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 100
      ) {
        setError('Jumlah unit harus 1–100.');
        return;
      }
      setReview({ quantity });
    } else {
      const codes = value
        .split('\n')
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean);
      if (
        !codes.length ||
        codes.length > 100 ||
        codes.some(
          (code) => !/^[A-Z0-9-]{1,64}$/.test(code) || /^ACC[0-9]+$/.test(code),
        )
      ) {
        setError(
          'Isi 1–100 kode valid, satu per baris. Kode ACC numerik khusus aksesori.',
        );
        return;
      }
      if (new Set(codes).size !== codes.length) {
        setError('Kode unit tidak boleh duplikat.');
        return;
      }
      setReview({ codes });
    }
  }
  if (review)
    return (
      <InventoryConfirm
        createsRecords
        onBusy={onBusy}
        save={() => inventoryApi.addUnits(item.id, review)}
        onSaved={onDone}
        onCancel={() => setReview(null)}
      >
        <h2>Tambah unit · {item.name}</h2>
        <p>
          {'codes' in review
            ? review.codes.join(', ')
            : `${review.quantity} unit aksesori dengan kode otomatis.`}
        </p>
      </InventoryConfirm>
    );
  return (
    <form className="form-stack inventory-edit" onSubmit={prepare}>
      <h2>Tambah unit</h2>
      {item.category === 'iphone' ? (
        <label>
          Kode unit iPhone (satu per baris)
          <textarea
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
      ) : (
        <label>
          Jumlah unit aksesori
          <Input
            required
            inputMode="numeric"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button type="submit" disabled={!online}>
          Periksa unit baru
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Batal tambah unit
        </Button>
      </div>
    </form>
  );
}
type Action = 'active' | 'start' | 'maintenance' | 'preparation';
function UnitAction({
  unit,
  action,
  onDone,
  onCancel,
}: {
  unit: InventoryUnit;
  action: Action;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState(''),
    [checked, setChecked] = useState(false),
    [review, setReview] = useState(action !== 'start'),
    [error, setError] = useState('');
  function save() {
    if (action === 'active')
      return inventoryApi.activeUnit(unit.id, !unit.isActive);
    if (action === 'start')
      return inventoryApi.maintenance(unit.id, reason.trim());
    if (action === 'maintenance')
      return inventoryApi.completeMaintenance(unit.id);
    return inventoryApi.completePreparation(unit.id);
  }
  if (!review)
    return (
      <form
        className="form-stack inventory-edit"
        onSubmit={(event) => {
          event.preventDefault();
          if (!reason.trim()) {
            setError('Alasan perawatan wajib diisi.');
            return;
          }
          setReview(true);
        }}
      >
        <h3>Mulai perawatan · {unit.code}</h3>
        <label>
          Alasan perawatan
          <textarea
            required
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button type="submit">Periksa perawatan</Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Batal perawatan
          </Button>
        </div>
      </form>
    );
  const title =
    action === 'active'
      ? unit.isActive
        ? 'Nonaktifkan unit'
        : 'Aktifkan unit'
      : action === 'start'
        ? 'Mulai perawatan'
        : action === 'maintenance'
          ? 'Selesaikan perawatan'
          : 'Selesaikan persiapan';
  return (
    <InventoryConfirm
      save={async () => {
        if (!checked)
          throw new Error('Konfirmasikan pemeriksaan kondisi unit.');
        return save();
      }}
      onSaved={onDone}
      onCancel={onCancel}
    >
      <h3>
        {title} · {unit.code}
      </h3>
      <p>
        {action === 'maintenance'
          ? 'Unit akan masuk persiapan satu jam sejak pencatatan ini.'
          : action === 'preparation'
            ? 'Unit akan siap secara fisik. Ketersediaan jadwal tetap diperiksa saat booking.'
            : action === 'start'
              ? reason
              : 'Status aktif unit berubah; riwayat transaksi tetap disimpan.'}
      </p>
      <label className="consent-row">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
        Saya sudah memeriksa kondisi fisik dan tindakan untuk unit ini.
      </label>
    </InventoryConfirm>
  );
}
export function UnitRows({
  units,
  busy,
  onBusy,
  onDone,
}: {
  units: InventoryUnit[];
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onDone: (text: string) => void;
}) {
  const online = useOnline(),
    now = useInventoryClock();
  const [selection, setSelection] = useState<{
    unit: InventoryUnit;
    action: Action;
  } | null>(null);
  useEffect(() => () => onBusy(false), [onBusy]);
  function select(unit: InventoryUnit, action: Action) {
    setSelection({ unit, action });
    onBusy(true);
  }
  function close() {
    setSelection(null);
    onBusy(false);
  }
  return (
    <div className="inventory-units">
      {units.map((unit) => {
        const free =
          unit.conditionStatus === 'layak' &&
          unit.physicalStatus === 'ready' &&
          unit.activeAllocationCount === 0 &&
          unit.unreturnedBookingCount === 0;
        const canPrepare =
          unit.conditionStatus === 'layak' &&
          unit.physicalStatus === 'preparing' &&
          unit.preparationUntil !== null &&
          new Date(unit.preparationUntil).getTime() <= now &&
          unit.unreturnedBookingCount === 0;
        const disabled = !online || busy || !!selection;
        return (
          <article className="inventory-unit" key={unit.id}>
            <header className="inv-unit-header">
              <div className="inv-unit-title">
                <h3>{unit.code}</h3>
                <span
                  className={
                    'inv-unit-status is-' +
                    (unit.conditionStatus === 'maintenance'
                      ? 'maintenance'
                      : unit.physicalStatus)
                  }
                >
                  <i />
                  {unit.conditionStatus === 'maintenance'
                    ? 'Dalam perawatan'
                    : physicalLabels[unit.physicalStatus]}
                </span>
              </div>
              <div className="inv-unit-actions">
                {' '}
                {unit.conditionStatus === 'maintenance' &&
                  unit.physicalStatus === 'awaiting_check' && (
                    <Button
                      variant="outline"
                      disabled={disabled}
                      aria-label={'Selesaikan perawatan ' + unit.code}
                      onClick={() => select(unit, 'maintenance')}
                    >
                      Selesaikan perawatan
                    </Button>
                  )}
                {unit.conditionStatus === 'layak' &&
                  unit.physicalStatus === 'preparing' && (
                    <Button
                      variant="outline"
                      disabled={disabled || !canPrepare}
                      aria-label={'Selesaikan persiapan ' + unit.code}
                      onClick={() => select(unit, 'preparation')}
                    >
                      Tandai siap
                    </Button>
                  )}
                {unit.conditionStatus === 'layak' &&
                  unit.physicalStatus === 'ready' && (
                    <InventoryActionMenu
                      label={'Tindakan unit ' + unit.code}
                      disabled={disabled}
                    >
                      <Button
                        variant="outline"
                        disabled={disabled || !free}
                        aria-label={
                          (unit.isActive ? 'Nonaktifkan' : 'Aktifkan') +
                          ' ' +
                          unit.code
                        }
                        onClick={() => select(unit, 'active')}
                      >
                        {unit.isActive ? 'Nonaktifkan unit' : 'Aktifkan unit'}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={disabled || !free}
                        aria-label={'Mulai perawatan ' + unit.code}
                        onClick={() => select(unit, 'start')}
                      >
                        Mulai perawatan
                      </Button>
                    </InventoryActionMenu>
                  )}
              </div>
            </header>
            <p className="muted text-sm">
              {unit.isActive ? 'Unit aktif' : 'Unit nonaktif'} · Kondisi{' '}
              {unit.conditionStatus === 'layak'
                ? 'layak'
                : unit.conditionStatus === 'lost'
                  ? 'hilang'
                  : 'perawatan'}{' '}
              · {unit.activeAllocationCount} alokasi aktif
            </p>
            {unit.notes && <p>{unit.notes}</p>}
            {unit.preparationUntil && (
              <p>Persiapan paling awal selesai {wib(unit.preparationUntil)}</p>
            )}
            {unit.unreturnedBookingCount > 0 && (
              <p className="info-note">
                Pengembalian unit belum diverifikasi. Selesaikan pemeriksaan di
                detail booking.
              </p>
            )}
            {selection?.unit.id === unit.id && (
              <UnitAction
                key={selection.action}
                unit={selection.unit}
                action={selection.action}
                onCancel={close}
                onDone={() => {
                  close();
                  onDone(
                    'Kondisi unit diperbarui. Periksa status dan batas persiapan terbaru.',
                  );
                }}
              />
            )}
          </article>
        );
      })}
    </div>
  );
}
