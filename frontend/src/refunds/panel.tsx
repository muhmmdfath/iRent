import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage, api } from '@/services/api';
import { useOnline } from '@/hooks/use-online';
import {
  useActionKey,
  refreshBookingQueries,
} from '@/services/business-action';
import { rupiah, wib } from '@/customer/format';
import type { Booking, Financial } from '@/customer/types';
import {
  refundAction,
  refundLabels,
  type Refund,
  type RefundAction,
} from './api';

const titles: Record<RefundAction, string> = {
  cancel: 'Batalkan booking',
  recipient: 'Simpan rekening refund',
  approve: 'Setujui refund',
  reject: 'Tolak refund',
  transfer: 'Catat transfer refund',
};
export function RefundForm({
  kind,
  id,
  admin,
  refund,
  onClose,
}: {
  kind: RefundAction;
  id: string;
  admin: boolean;
  refund?: Refund;
  onClose: () => void;
}) {
  const online = useOnline();
  const key = useActionKey();
  const [review, setReview] = useState<Record<string, string> | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileToken = useRef('');
  const mutation = useMutation({
    mutationFn: (input: Record<string, string>) =>
      refundAction(
        admin,
        kind,
        id,
        input,
        file,
        key({ kind, id, input, file: fileToken.current }),
      ),
    onSuccess: async () => {
      await refreshBookingQueries();
      onClose();
    },
  });
  function prepare(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    const input: Record<string, string> = {};
    for (const [name, value] of data)
      if (typeof value === 'string' && name !== 'checked')
        input[name] = value.trim();
    if (kind === 'transfer') {
      if (
        !file ||
        !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) ||
        file.size > 2 * 1024 * 1024 ||
        file.size === 0
      ) {
        setError('Pilih bukti JPG, PNG, atau PDF maksimal 2 MB.');
        return;
      }
      const local =
        input.transferredAt.length === 16
          ? input.transferredAt + ':00'
          : input.transferredAt;
      const time = new Date(local + '+07:00');
      if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(local) ||
        !Number.isFinite(time.getTime()) ||
        new Date(time.getTime() + 7 * 3600000).toISOString().slice(0, 19) !==
          local ||
        time.getTime() > Date.now() ||
        !refund?.approvedAt ||
        time < new Date(refund.approvedAt)
      ) {
        setError(
          'Waktu transfer harus sesudah persetujuan dan tidak di masa depan. Isi detik sesuai transaksi.',
        );
        return;
      }
      input.transferredAt = local + '+07:00';
      input.amount = refund.approvedAmount!;
    }
    mutation.reset();
    setDraft(input);
    setReview(input);
  }
  const account = refund?.recipientDetails;
  return (
    <section className="refund-action form-section" aria-label={titles[kind]}>
      <h3>{titles[kind]}</h3>
      {kind === 'cancel' && (
        <p className="info-note">
          {admin
            ? 'Gunakan untuk kendala operasional toko. Semua dana yang sah dikembalikan penuh.'
            : 'Pembatalan berlaku untuk seluruh booking sebelum serah terima. Refund dana sewa mengikuti aturan saat booking. Dana berlebih atau belum diterapkan dikembalikan penuh.'}{' '}
          Nominal akhir dihitung server dari dana yang sudah diterima.
        </p>
      )}
      {kind === 'approve' && (
        <p>
          Setujui hak refund {rupiah(refund!.requestedAmount)} ke{' '}
          {account?.bankName}, {account?.accountNumber}, a.n.{' '}
          {account?.accountHolder}. Persetujuan belum mencatat uang keluar.
        </p>
      )}
      {kind === 'transfer' && (
        <p className="info-note">
          Catat setelah transfer bank benar-benar berhasil. Nominal harus{' '}
          {rupiah(refund!.approvedAmount!)} ke {account?.bankName}{' '}
          {account?.accountNumber}, a.n. {account?.accountHolder}. Periksa
          riwayat bank sebelum mengulangi transfer.
        </p>
      )}
      {review ? (
        <div className="action-review">
          <h4>Periksa sebelum menyimpan</h4>
          <dl className="price-breakdown">
            {Object.entries(review).map(([name, value]) => (
              <div key={name}>
                <dt>
                  {{
                    reason: 'Alasan',
                    bankName: 'Bank',
                    accountNumber: 'Nomor rekening',
                    accountHolder: 'Pemilik rekening',
                    amount: 'Nominal',
                    transferredAt: 'Waktu transfer',
                    transactionReference: 'Referensi transaksi',
                    note: 'Catatan',
                  }[name] || name}
                </dt>
                <dd>
                  {name === 'amount'
                    ? rupiah(value)
                    : name === 'transferredAt'
                      ? wib(value)
                      : value}
                </dd>
              </div>
            ))}
          </dl>
          {file && <p>Bukti: {file.name}</p>}
          <div className="form-actions">
            <Button
              disabled={mutation.isPending || !online}
              onClick={() => mutation.mutate(review)}
            >
              {mutation.isPending
                ? 'Menyimpan...'
                : 'Konfirmasi ' + titles[kind].toLowerCase()}
            </Button>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => {
                mutation.reset();
                setReview(null);
              }}
            >
              Ubah isian
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={prepare}>
          {(kind === 'cancel' || kind === 'reject') && (
            <label className="field-label">
              Alasan
              <textarea
                name="reason"
                required
                minLength={5}
                maxLength={1000}
                defaultValue={draft.reason}
              />
            </label>
          )}
          {kind === 'recipient' && (
            <>
              <p className="muted">
                Pastikan rekening milik penerima benar. Rekening terkunci
                setelah keputusan admin.
              </p>
              <label className="field-label">
                Nama bank
                <Input
                  name="bankName"
                  required
                  minLength={2}
                  maxLength={100}
                  defaultValue={draft.bankName ?? account?.bankName}
                />
              </label>
              <label className="field-label">
                Nomor rekening
                <Input
                  name="accountNumber"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{5,34}"
                  defaultValue={draft.accountNumber ?? account?.accountNumber}
                />
              </label>
              <label className="field-label">
                Nama pemilik rekening
                <Input
                  name="accountHolder"
                  required
                  minLength={2}
                  maxLength={150}
                  defaultValue={draft.accountHolder ?? account?.accountHolder}
                />
              </label>
            </>
          )}
          {kind === 'transfer' && (
            <>
              <label className="field-label">
                Waktu transfer (WIB)
                <Input
                  name="transferredAt"
                  type="datetime-local"
                  step="1"
                  required
                  defaultValue={draft.transferredAt?.slice(0, 19)}
                />
              </label>
              <label className="field-label">
                Referensi transaksi
                <Input
                  name="transactionReference"
                  required
                  maxLength={150}
                  defaultValue={draft.transactionReference}
                />
              </label>
              <label className="field-label">
                Catatan transfer
                <textarea
                  name="note"
                  required
                  minLength={5}
                  maxLength={1000}
                  defaultValue={draft.note}
                />
              </label>
              <label className="field-label">
                Bukti transfer
                <Input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  aria-required="true"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    fileToken.current = crypto.randomUUID();
                  }}
                />
              </label>
              {file && (
                <p className="muted text-sm">Bukti dipilih: {file.name}</p>
              )}
            </>
          )}
          <label className="checkbox-row">
            <input name="checked" type="checkbox" required />
            {kind === 'transfer'
              ? 'Saya memastikan transfer berhasil dan belum dicatat sebelumnya.'
              : admin && kind === 'recipient'
                ? 'Rekening ini sudah dikonfirmasi dengan pelanggan.'
                : 'Saya sudah memeriksa data dan memahami tindakan ini.'}
          </label>
          <Button disabled={!online} type="submit">
            Periksa {titles[kind].toLowerCase()}
          </Button>
        </form>
      )}
      {(error || mutation.isError) && (
        <p className="form-error" role="alert">
          {error || errorMessage(mutation.error)}
        </p>
      )}
      <Button variant="ghost" disabled={mutation.isPending} onClick={onClose}>
        Tutup formulir
      </Button>
    </section>
  );
}

function RefundProof({ id }: { id: string }) {
  const online = useOnline();
  const controller = useRef<AbortController | null>(null);
  const url = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  async function download() {
    setBusy(true);
    setError(null);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await api.get<Blob>(`/refunds/${id}/file`, {
        responseType: 'blob',
        signal: abort.signal,
      });
      if (abort.signal.aborted) return;
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url.current;
      link.download = `refund-${id}.${response.data.type === 'application/pdf' ? 'pdf' : response.data.type === 'image/png' ? 'png' : 'jpg'}`;
      link.click();
    } catch (cause) {
      if (!abort.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        disabled={busy || !online}
        onClick={() => void download()}
      >
        {busy ? 'Memuat bukti...' : 'Unduh bukti refund'}
      </Button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
export function RefundPanel({
  booking,
  money,
  admin = false,
  disabled = false,
  onBusy,
}: {
  booking: Booking;
  money: Financial;
  admin?: boolean;
  disabled?: boolean;
  onBusy?: (busy: boolean) => void;
}) {
  const online = useOnline();
  const [action, setAction] = useState<{
    kind: RefundAction;
    id: string;
  } | null>(null);
  useEffect(() => {
    onBusy?.(!!action);
    return () => onBusy?.(false);
  }, [action, onBusy]);
  const canCancel =
    ['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi'].includes(
      money.booking.status,
    ) &&
    !!booking.items?.length &&
    booking.items.every(
      (item) => item.useStatus === 'allocated' && !item.pickedUpAt,
    );
  const refunds = money.booking.refunds || [];
  const rules = money.booking.rulesSnapshot.rules?.values;
  return (
    <section id="refunds" className="form-section refund-panel">
      <div className="section-heading">
        <h2>Pembatalan & refund</h2>
        {canCancel && (
          <Button
            variant="outline"
            disabled={disabled || !!action || !online}
            onClick={() => setAction({ kind: 'cancel', id: booking.id })}
          >
            {admin ? 'Batalkan karena kendala toko' : 'Batalkan booking'}
          </Button>
        )}
      </div>
      {!refunds.length && (
        <p className="muted">
          Belum ada pengajuan refund. Dana baru dicatat keluar setelah transfer
          selesai.
        </p>
      )}
      {canCancel && !admin && rules && (
        <p className="muted text-sm">
          Aturan booking ini: lebih dari {rules.cancel_refund_cutoff_days} hari
          sebelum pengambilan, refund {rules.cancel_refund_percent}% DP atau{' '}
          {rules.cancel_full_refund_percent}% pembayaran penuh. Tepat pada batas
          atau kurang, refund dana sewa 0%.
        </p>
      )}
      {action?.kind === 'cancel' && (
        <RefundForm
          key={action.id + action.kind}
          {...action}
          admin={admin}
          onClose={() => setAction(null)}
        />
      )}
      {refunds.map((refund) => {
        const account = refund.recipientDetails;
        const complete =
          !!account?.bankName &&
          !!account.accountNumber &&
          !!account.accountHolder;
        return (
          <article className="refund-row" key={refund.id}>
            <div className="section-heading">
              <h3>{rupiah(refund.approvedAmount ?? refund.requestedAmount)}</h3>
              <span className="status-badge">
                {refundLabels[refund.status] || refund.status}
              </span>
            </div>
            {refund.reasonNote && <p>{refund.reasonNote}</p>}
            {refund.rejectedReason && (
              <p className="form-error">
                Alasan penolakan: {refund.rejectedReason}
              </p>
            )}
            {complete ? (
              <p>
                Tujuan: {account.bankName} · {account.accountNumber} · a.n.{' '}
                {account.accountHolder}
              </p>
            ) : (
              <p className="muted">Rekening penerima belum lengkap.</p>
            )}
            {refund.approvedAt && (
              <p className="muted text-sm">
                Disetujui {wib(refund.approvedAt)}
              </p>
            )}
            {refund.transferredAt && (
              <p className="muted text-sm">
                Ditransfer {wib(refund.transferredAt)}
              </p>
            )}
            <div className="form-actions">
              {refund.status === 'diajukan' && (
                <>
                  <Button
                    variant="outline"
                    disabled={disabled || !!action || !online}
                    onClick={() =>
                      setAction({ kind: 'recipient', id: refund.id })
                    }
                  >
                    {complete ? 'Ubah rekening' : 'Isi rekening refund'}
                  </Button>
                  {admin && (
                    <>
                      <Button
                        disabled={disabled || !!action || !online || !complete}
                        onClick={() =>
                          setAction({ kind: 'approve', id: refund.id })
                        }
                      >
                        Setujui refund
                      </Button>
                      <Button
                        variant="outline"
                        disabled={disabled || !!action || !online}
                        onClick={() =>
                          setAction({ kind: 'reject', id: refund.id })
                        }
                      >
                        Tolak refund
                      </Button>
                    </>
                  )}
                </>
              )}
              {admin && refund.status === 'disetujui' && (
                <Button
                  disabled={disabled || !!action || !online}
                  onClick={() => setAction({ kind: 'transfer', id: refund.id })}
                >
                  Catat transfer refund
                </Button>
              )}
              {refund.status === 'sudah_dikembalikan' && (
                <RefundProof id={refund.id} />
              )}
            </div>
            {action?.id === refund.id && (
              <RefundForm
                key={action.id + action.kind}
                {...action}
                admin={admin}
                refund={refund}
                onClose={() => setAction(null)}
              />
            )}
          </article>
        );
      })}
    </section>
  );
}
