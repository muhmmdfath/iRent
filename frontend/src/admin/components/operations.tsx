import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { DisclosureSummary } from '@/components/ui/disclosure-summary';
import { Input } from '@/components/ui/input';
import type { BookingItem, Financial } from '@/customer/types';
import { localWib, rupiah, wib } from '@/customer/format';
import { useOnline } from '@/hooks/use-online';
import { errorMessage, api } from '@/services/api';
import type { AdminBooking, HandoverInput, ReturnInput } from '../types';
import { adminApi } from '../api';
import { useActionKey } from '../action-key';
import { refreshAdminPayments } from '../hooks';

type Operation =
  | { kind: 'handover' }
  | { kind: 'return' | 'reject' | 'correct' | 'loss'; item: BookingItem };
type LossInput = {
  lostAt: string;
  lossNote: string;
  compensationAmount: string;
  exemptions?: ReturnInput['exemptions'];
};
type Payload =
  | HandoverInput
  | (ReturnInput & { reason?: string })
  | { reason: string }
  | LossInput;
function nowWib() {
  return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 19);
}
function actualTime(value: string) {
  const result = value.length === 16 ? localWib(value) : value + '+07:00';
  const date = new Date(result);
  if (
    !Number.isFinite(date.getTime()) ||
    (value.length !== 16 &&
      new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 19) !==
        value)
  )
    throw new Error('Isi tanggal dan jam WIB yang valid.');
  if (new Date(result).getTime() > Date.now())
    throw new Error('Waktu kejadian tidak boleh di masa depan.');
  return result;
}
function note(value: string) {
  const result = value.trim();
  if (result.length < 5 || result.length > 1000)
    throw new Error('Catatan dan alasan wajib berisi 5–1000 karakter.');
  return result;
}
function OperationForm({
  booking,
  operation,
  onDone,
  onCancel,
}: {
  booking: AdminBooking;
  operation: Operation;
  onDone: (text: string) => void;
  onCancel: () => void;
}) {
  const online = useOnline();
  const actionKey = useActionKey();
  const existing =
    operation.kind === 'correct' ? operation.item.returnRecord : null;
  const toLocal = (value: string | null | undefined) =>
    value
      ? new Date(new Date(value).getTime() + 7 * 3600000)
          .toISOString()
          .slice(0, 19)
      : '';
  const [at, setAt] = useState(
    () => toLocal(existing?.receivedAtStore) || nowWib(),
  );
  const [courierAt, setCourierAt] = useState(() =>
    toLocal(existing?.receivedByCourierAt),
  );
  const [condition, setCondition] = useState<ReturnInput['condition']>('layak');
  const [conditionNote, setNote] = useState(existing?.conditionNote || '');
  const [reason, setReason] = useState('');
  const [damage, setDamage] = useState(existing?.damageAmount || '0');
  const [damageNote, setDamageNote] = useState(existing?.damageNote || '');
  const [checked, setChecked] = useState(false);
  const [exemptions, setExemptions] = useState<
    { type: 'admin' | 'courier'; from: string; to: string; reason: string }[]
  >(
    () =>
      existing?.manualExemptions?.map((value) => ({
        ...value,
        from: toLocal(value.from),
        to: toLocal(value.to),
      })) || [],
  );
  const [review, setReview] = useState<Payload | null>(null);
  const [validation, setValidation] = useState('');
  const mutation = useMutation({
    mutationFn: (input: Payload) => {
      const key = actionKey({
        kind: operation.kind,
        itemId: operation.kind === 'handover' ? null : operation.item.id,
        input,
      });
      if (operation.kind === 'handover')
        return adminApi.handover(booking.id, input as HandoverInput, key);
      if (operation.kind === 'return')
        return adminApi.verifyReturn(
          booking.id,
          operation.item.id,
          input as ReturnInput,
          key,
        );
      if (operation.kind === 'loss')
        return api
          .post<Financial>(
            `/admin/bookings/${booking.id}/items/${operation.item.id}/loss/verify`,
            input,
            { headers: { 'Idempotency-Key': key } },
          )
          .then((response) => response.data);
      if (operation.kind === 'correct') {
        const { condition: _condition, ...corrected } = input as ReturnInput & {
          reason: string;
        };
        void _condition;
        return api
          .post<Financial>(
            `/admin/bookings/${booking.id}/items/${operation.item.id}/return/correct`,
            corrected,
            { headers: { 'Idempotency-Key': key } },
          )
          .then((response) => response.data);
      }
      return adminApi.rejectReturn(
        booking.id,
        operation.item.id,
        (input as { reason: string }).reason,
        key,
      );
    },
    onSuccess: async () => {
      await refreshAdminPayments();
      onDone(
        operation.kind === 'handover'
          ? 'Serah-terima tercatat. Booking sedang disewa.'
          : operation.kind === 'return'
            ? 'Pengembalian unit diverifikasi. Status dan tagihan diperbarui.'
            : operation.kind === 'loss'
              ? 'Kehilangan dicatat. Unit, risiko dan tagihan diperbarui.'
              : operation.kind === 'correct'
                ? 'Pengembalian dikoreksi. Penyesuaian tagihan tercatat tanpa menghapus riwayat.'
                : 'Laporan ditolak. Unit tetap sedang disewa.',
      );
    },
  });
  function prepare(event: React.FormEvent) {
    event.preventDefault();
    setValidation('');
    try {
      if (!checked)
        throw new Error('Konfirmasikan hasil pemeriksaan terlebih dahulu.');
      if (operation.kind === 'reject') {
        setReview({ reason: note(reason) });
        return;
      }
      const timestamp =
        operation.kind === 'correct' &&
        existing?.receivedAtStore &&
        at === toLocal(existing.receivedAtStore)
          ? existing.receivedAtStore
          : actualTime(at);
      if (operation.kind === 'handover') {
        if (new Date(timestamp) < new Date(booking.initialStartAt))
          throw new Error(
            'Serah-terima tidak boleh sebelum jadwal pengambilan.',
          );
        const delayed =
          booking.deliveryType === 'delivery' &&
          new Date(timestamp) > new Date(booking.initialStartAt);
        setReview({
          pickedUpAt: timestamp,
          conditionNote: note(conditionNote),
          ...(delayed ? { shopDelayReason: note(reason) } : {}),
        });
        return;
      }
      if (
        operation.item.pickedUpAt &&
        new Date(timestamp) < new Date(operation.item.pickedUpAt)
      )
        throw new Error('Penerimaan tidak boleh sebelum serah-terima.');
      if (
        !/^(0|[1-9][0-9]{0,18})$/.test(damage) ||
        BigInt(damage) > 9223372036854775807n
      )
        throw new Error(
          'Biaya kerusakan harus rupiah bulat nonnegatif dalam batas yang valid.',
        );
      const courier =
        booking.deliveryType === 'delivery' && courierAt
          ? operation.kind === 'correct' &&
            existing?.receivedByCourierAt &&
            courierAt === toLocal(existing.receivedByCourierAt)
            ? existing.receivedByCourierAt
            : actualTime(courierAt)
          : undefined;
      if (
        courier &&
        (new Date(courier) > new Date(timestamp) ||
          (operation.item.pickedUpAt &&
            new Date(courier) < new Date(operation.item.pickedUpAt)))
      )
        throw new Error(
          'Waktu petugas harus antara serah-terima dan penerimaan toko.',
        );
      const intervals = exemptions.map((value) => {
        const from = actualTime(value.from),
          to = actualTime(value.to);
        if (new Date(from) >= new Date(to))
          throw new Error('Akhir pengecualian harus sesudah awal.');
        return { ...value, from, to, reason: note(value.reason) };
      });
      if (operation.kind === 'loss') {
        setReview({
          lostAt: timestamp,
          lossNote: note(conditionNote),
          compensationAmount: damage,
          ...(intervals.length ? { exemptions: intervals } : {}),
        });
        return;
      }
      setReview({
        receivedAtStore: timestamp,
        ...(courier ? { receivedByCourierAt: courier } : {}),
        condition,
        conditionNote: note(conditionNote),
        damageAmount: damage,
        ...(BigInt(damage) > 0n ? { damageNote: note(damageNote) } : {}),
        ...(operation.kind === 'correct'
          ? { reason: note(reason), exemptions: intervals }
          : intervals.length
            ? { exemptions: intervals }
            : {}),
      });
    } catch (error) {
      setValidation(
        error instanceof Error ? error.message : 'Periksa formulir.',
      );
    }
  }
  const title =
    operation.kind === 'handover'
      ? 'Catat serah-terima'
      : operation.kind === 'return'
        ? 'Verifikasi penerimaan unit'
        : operation.kind === 'loss'
          ? 'Verifikasi kehilangan unit'
          : operation.kind === 'correct'
            ? 'Koreksi pengembalian unit'
            : 'Tolak laporan pengembalian';
  return (
    <section className="admin-operation-form" aria-label={title}>
      <h3>{title}</h3>
      {review ? (
        <>
          <p className="eyebrow">Periksa sebelum menyimpan</p>
          <dl className="price-breakdown">
            <div>
              <dt>Lingkup</dt>
              <dd>
                {operation.kind === 'handover'
                  ? 'Seluruh unit booking'
                  : operation.item.unitCodeSnapshot}
              </dd>
            </div>
            {'pickedUpAt' in review && (
              <div>
                <dt>Waktu serah-terima</dt>
                <dd>{wib(review.pickedUpAt)}</dd>
              </div>
            )}
            {'receivedAtStore' in review && (
              <>
                <div>
                  <dt>Diterima toko</dt>
                  <dd>{wib(review.receivedAtStore)}</dd>
                </div>
                {review.receivedByCourierAt && (
                  <div>
                    <dt>Diterima petugas</dt>
                    <dd>{wib(review.receivedByCourierAt)}</dd>
                  </div>
                )}
                {operation.kind !== 'correct' && (
                  <div>
                    <dt>Kondisi</dt>
                    <dd>
                      {review.condition === 'layak'
                        ? 'Layak · persiapan satu jam'
                        : 'Perlu perawatan'}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Biaya kerusakan</dt>
                  <dd>{rupiah(review.damageAmount)}</dd>
                </div>
              </>
            )}
          </dl>
          {'lostAt' in review && (
            <>
              <p>Waktu hilang: {wib(review.lostAt)}</p>
              <p>Ganti rugi: {rupiah(review.compensationAmount)}</p>
              <p>{review.lossNote}</p>
            </>
          )}
          {'conditionNote' in review && <p>{review.conditionNote}</p>}
          {'shopDelayReason' in review && (
            <p>Alasan keterlambatan toko: {review.shopDelayReason}</p>
          )}
          {'damageNote' in review && <p>Kerusakan: {review.damageNote}</p>}
          {'exemptions' in review &&
            review.exemptions?.map((entry, i) => (
              <p key={i}>
                Pengecualian {entry.type === 'admin' ? 'admin' : 'petugas'}:{' '}
                {wib(entry.from)} – {wib(entry.to)}. {entry.reason}
              </p>
            ))}
          {'reason' in review && <p>{review.reason}</p>}
          <p className="info-note">
            {operation.kind === 'return'
              ? 'Denda final dihitung backend dari waktu aktual dan pengecualian. Pengembalian dapat menutup pengajuan perpanjangan pending terkait; dana yang sudah diterima mengikuti refund manual.'
              : operation.kind === 'handover'
                ? 'Backend memeriksa pelunasan, kesiapan unit, jam operasional dan benturan jadwal sebelum menyerahkan seluruh unit.'
                : operation.kind === 'loss'
                  ? 'Unit ditutup karena kehilangan tanpa pengembalian fisik. Tagihan ganti rugi/denda dan risiko booking berikutnya dihitung backend; dana perpanjangan pending mengikuti refund.'
                  : operation.kind === 'correct'
                    ? 'Koreksi mencatat penyesuaian dan audit; kesiapan fisik dan receipt asli tetap dipertahankan.'
                    : 'Penolakan laporan tidak melepas unit atau menutup sewa.'}
          </p>
          {mutation.isError && (
            <p role="alert" className="field-error">
              {errorMessage(mutation.error)}
            </p>
          )}
          <div className="form-actions">
            <Button
              disabled={!online || mutation.isPending}
              onClick={() => mutation.mutate(review)}
            >
              {mutation.isPending ? 'Menyimpan...' : 'Konfirmasi tindakan'}
            </Button>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => {
                setReview(null);
                mutation.reset();
              }}
            >
              Ubah pemeriksaan
            </Button>
          </div>
        </>
      ) : (
        <form onSubmit={prepare} className="form-stack">
          {operation.kind !== 'reject' && (
            <>
              <label>
                {operation.kind === 'handover'
                  ? 'Waktu serah-terima (WIB)'
                  : operation.kind === 'loss'
                    ? 'Waktu hilang terverifikasi (WIB)'
                    : 'Diterima toko (WIB)'}
                <Input
                  type="datetime-local"
                  step="1"
                  required
                  value={at}
                  onChange={(event) => setAt(event.target.value)}
                />
              </label>
              {['return', 'correct'].includes(operation.kind) &&
                booking.deliveryType === 'delivery' && (
                  <label>
                    Diterima petugas (WIB, opsional)
                    <Input
                      aria-label="Diterima petugas (WIB, opsional)"
                      type="datetime-local"
                      step="1"
                      value={courierAt}
                      onChange={(event) => setCourierAt(event.target.value)}
                    />
                    <span className="muted text-sm">
                      Jika diisi, waktu ini menjadi dasar berhentinya denda.
                    </span>
                  </label>
                )}
              <label>
                {operation.kind === 'loss'
                  ? 'Catatan kehilangan'
                  : 'Catatan kondisi'}
                <textarea
                  required
                  minLength={5}
                  maxLength={1000}
                  value={conditionNote}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            </>
          )}
          {(operation.kind === 'reject' ||
            operation.kind === 'correct' ||
            (operation.kind === 'handover' &&
              booking.deliveryType === 'delivery')) && (
            <label>
              {operation.kind === 'reject'
                ? 'Alasan penolakan'
                : operation.kind === 'correct'
                  ? 'Alasan koreksi'
                  : 'Alasan keterlambatan toko (wajib jika terlambat)'}
              <textarea
                required={
                  operation.kind === 'reject' || operation.kind === 'correct'
                }
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          )}
          {['return', 'correct', 'loss'].includes(operation.kind) && (
            <>
              {operation.kind === 'return' && (
                <label>
                  Kondisi unit
                  <select
                    value={condition}
                    onChange={(event) =>
                      setCondition(
                        event.target.value as ReturnInput['condition'],
                      )
                    }
                  >
                    <option value="layak">Layak · lanjut persiapan</option>
                    <option value="maintenance">Perlu perawatan</option>
                  </select>
                </label>
              )}
              <label>
                {operation.kind === 'loss'
                  ? 'Ganti rugi kehilangan (rupiah)'
                  : 'Biaya kerusakan (rupiah)'}
                <Input
                  required
                  inputMode="numeric"
                  value={damage}
                  onChange={(event) => setDamage(event.target.value)}
                />
              </label>
              {damage !== '0' && operation.kind !== 'loss' && (
                <label>
                  Catatan kerusakan
                  <textarea
                    required
                    minLength={5}
                    maxLength={1000}
                    value={damageNote}
                    onChange={(event) => setDamageNote(event.target.value)}
                  />
                </label>
              )}
              <details className="optional-fields">
                <DisclosureSummary>
                  Pengecualian keterlambatan admin/petugas
                </DisclosureSummary>
                <p className="muted text-sm">
                  Catat interval keterlambatan pihak toko. Interval yang tumpang
                  tindih dihitung sekali oleh backend.
                </p>
                {exemptions.map((entry, index) => (
                  <fieldset key={index} className="operation-exemption">
                    <legend>Pengecualian {index + 1}</legend>
                    <label>
                      Pihak
                      <select
                        value={entry.type}
                        onChange={(event) =>
                          setExemptions(
                            exemptions.map((value, i) =>
                              i === index
                                ? {
                                    ...value,
                                    type: event.target.value as
                                      'admin' | 'courier',
                                  }
                                : value,
                            ),
                          )
                        }
                      >
                        <option value="admin">Admin</option>
                        {booking.deliveryType === 'delivery' && (
                          <option value="courier">Petugas</option>
                        )}
                      </select>
                    </label>
                    {(['from', 'to'] as const).map((field) => (
                      <label key={field}>
                        {field === 'from' ? 'Awal' : 'Akhir'} pengecualian (WIB)
                        <Input
                          required
                          type="datetime-local"
                          value={entry[field]}
                          onChange={(event) =>
                            setExemptions(
                              exemptions.map((value, i) =>
                                i === index
                                  ? { ...value, [field]: event.target.value }
                                  : value,
                              ),
                            )
                          }
                        />
                      </label>
                    ))}
                    <label>
                      Alasan pengecualian
                      <textarea
                        required
                        minLength={5}
                        maxLength={1000}
                        value={entry.reason}
                        onChange={(event) =>
                          setExemptions(
                            exemptions.map((value, i) =>
                              i === index
                                ? { ...value, reason: event.target.value }
                                : value,
                            ),
                          )
                        }
                      />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setExemptions(exemptions.filter((_, i) => i !== index))
                      }
                    >
                      Hapus pengecualian {index + 1}
                    </Button>
                  </fieldset>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  disabled={exemptions.length >= 20}
                  onClick={() =>
                    setExemptions([
                      ...exemptions,
                      { type: 'admin', from: '', to: '', reason: '' },
                    ])
                  }
                >
                  Tambah pengecualian
                </Button>
              </details>
            </>
          )}
          <label className="consent-row">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
            Saya sudah memeriksa barang, waktu aktual dan catatan tindakan ini.
          </label>
          {validation && (
            <p role="alert" className="field-error">
              {validation}
            </p>
          )}
          <Button type="submit" disabled={!online}>
            Periksa tindakan
          </Button>
        </form>
      )}
      <Button variant="ghost" disabled={mutation.isPending} onClick={onCancel}>
        Batal tindakan
      </Button>
    </section>
  );
}
const useLabels: Record<string, string> = {
  allocated: 'Belum diserahkan',
  in_use: 'Sedang disewa',
  return_pending: 'Laporan menunggu pemeriksaan',
  returned: 'Sudah dikembalikan',
  lost_closed: 'Ditutup karena kehilangan',
  released: 'Alokasi dilepas',
};
export function BookingOperations({
  booking,
  money,
  paymentBusy,
  onBusy,
  onDone,
}: {
  booking: AdminBooking;
  money: Financial;
  paymentBusy: boolean;
  onBusy: (busy: boolean) => void;
  onDone: (message: string) => void;
}) {
  const online = useOnline();
  const [operation, setOperation] = useState<Operation | null>(null);
  const items = booking.items || [];
  const paid =
    BigInt(money.summary.applied) >= BigInt(booking.initialGrandTotal);
  function open(value: Operation) {
    setOperation(value);
    onBusy(true);
  }
  function close() {
    setOperation(null);
    onBusy(false);
  }
  return (
    <section className="form-section">
      <div className="section-heading">
        <h2>Serah-terima & pengembalian</h2>
        <span className="muted text-sm">Pemeriksaan fisik</span>
      </div>
      {money.booking.status === 'dikonfirmasi' && (
        <>
          {!paid && (
            <p className="info-note">
              Lunasi sewa dan ongkir sebelum menyerahkan barang.
            </p>
          )}
          <Button
            disabled={
              !online ||
              !paid ||
              paymentBusy ||
              !!operation ||
              !items.length ||
              items.some((item) => item.useStatus !== 'allocated')
            }
            onClick={() => open({ kind: 'handover' })}
          >
            Catat serah-terima
          </Button>
        </>
      )}
      {items.map((item) => (
        <article className="operation-unit" key={item.id}>
          <header className="section-heading">
            <h3>
              {item.itemNameSnapshot} · {item.unitCodeSnapshot}
            </h3>
            <span className="status-badge">
              {useLabels[item.useStatus] || item.useStatus}
            </span>
          </header>
          {item.pickedUpAt && (
            <p className="muted text-sm">Diserahkan {wib(item.pickedUpAt)}</p>
          )}
          {item.handoverNote && <p>{item.handoverNote}</p>}
          {item.returnRecord?.reportedAt && (
            <p className="muted text-sm">
              Laporan pelanggan {wib(item.returnRecord.reportedAt)}
            </p>
          )}
          {item.returnRecord?.status === 'verified' && (
            <>
              <dl className="price-breakdown">
                <div>
                  <dt>Diterima toko</dt>
                  <dd>{wib(item.returnRecord.receivedAtStore!)}</dd>
                </div>
                {item.returnRecord.receivedByCourierAt && (
                  <div>
                    <dt>Diterima petugas</dt>
                    <dd>{wib(item.returnRecord.receivedByCourierAt)}</dd>
                  </div>
                )}
                <div>
                  <dt>Denda final</dt>
                  <dd>{rupiah(item.returnRecord.lateFee)}</dd>
                </div>
                <div>
                  <dt>Kerusakan</dt>
                  <dd>{rupiah(item.returnRecord.damageAmount)}</dd>
                </div>
              </dl>
              <p>{item.returnRecord.conditionNote}</p>
              {item.returnRecord.damageNote && (
                <p>{item.returnRecord.damageNote}</p>
              )}
              <p className="muted text-sm">
                {item.returnRecord.preparationStartedAt
                  ? `Persiapan dimulai ${wib(item.returnRecord.preparationStartedAt)}. Kesiapan fisik perlu diselesaikan admin setelah satu jam.`
                  : 'Kesiapan fisik ditangani terpisah melalui perawatan/persiapan.'}
              </p>
            </>
          )}
          {money.booking.status === 'berjalan' &&
            ['in_use', 'return_pending'].includes(item.useStatus) && (
              <>
                <p className="muted text-sm">
                  Laporan belum melepas unit. Verifikasi setelah barang diterima
                  dan diperiksa.
                </p>
                <div className="form-actions">
                  <Button
                    variant="outline"
                    disabled={!online || paymentBusy || !!operation}
                    onClick={() => open({ kind: 'loss', item })}
                  >
                    Catat kehilangan {item.unitCodeSnapshot}
                  </Button>
                  <Button
                    disabled={!online || paymentBusy || !!operation}
                    onClick={() => open({ kind: 'return', item })}
                  >
                    Verifikasi pengembalian {item.unitCodeSnapshot}
                  </Button>
                  {item.useStatus === 'return_pending' && (
                    <Button
                      variant="outline"
                      disabled={!online || paymentBusy || !!operation}
                      onClick={() => open({ kind: 'reject', item })}
                    >
                      Tolak laporan {item.unitCodeSnapshot}
                    </Button>
                  )}
                </div>
              </>
            )}
          {item.returnRecord?.status === 'verified' && (
            <Button
              variant="outline"
              disabled={!online || paymentBusy || !!operation}
              onClick={() => open({ kind: 'correct', item })}
            >
              Koreksi pengembalian {item.unitCodeSnapshot}
            </Button>
          )}
        </article>
      ))}
      {operation && (
        <OperationForm
          key={
            operation.kind === 'handover'
              ? 'handover'
              : operation.kind + operation.item.id
          }
          booking={booking}
          operation={operation}
          onCancel={close}
          onDone={(text) => {
            close();
            onDone(text);
          }}
        />
      )}
    </section>
  );
}
