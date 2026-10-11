import { useState } from 'react';
import { useActionKey } from '../action-key';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOnline } from '@/hooks/use-online';
import { errorMessage } from '@/services/api';
import { localWib, rupiah, wib } from '@/customer/format';
import { adminApi } from '../api';
import { refreshAdminPayments } from '../hooks';
import type { ReceiptInput } from '../types';
interface ReceiptFields {
  amount: string;
  occurredAt: string;
  method: ReceiptInput['method'];
  receivingAccountReference: string;
  transactionReference: string;
  note: string;
  checked: boolean;
}
function currentWib() {
  return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 16);
}
function validateReceiptTime(value: string) {
  try {
    return (
      new Date(localWib(value)).getTime() <= Date.now() ||
      'Waktu uang masuk tidak boleh di masa depan.'
    );
  } catch {
    return 'Isi tanggal dan jam yang valid.';
  }
}
export function ReceiptForm({
  bookingId,
  proofId,
  suggestedAmount,
  onDone,
  onCancel,
}: {
  bookingId: string;
  proofId?: string;
  suggestedAmount: string;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const online = useOnline();
  const actionKey = useActionKey();
  const [review, setReview] = useState<ReceiptInput | null>(null);
  const form = useForm<ReceiptFields>({
    defaultValues: {
      amount: suggestedAmount,
      occurredAt: currentWib(),
      method: proofId ? 'transfer' : 'cash',
      receivingAccountReference: '',
      transactionReference: '',
      note: '',
      checked: false,
    },
  });
  const method = useWatch({ control: form.control, name: 'method' });
  const mutation = useMutation({
    mutationFn: (input: ReceiptInput) =>
      proofId
        ? adminApi.verify(bookingId, proofId, input, actionKey(input))
        : adminApi.settle(bookingId, input, actionKey(input)),
    onSuccess: async (result) => {
      await refreshAdminPayments();
      onDone(
        result.summary.remaining === '0'
          ? 'Pembayaran dicatat. Tagihan sudah lunas.'
          : `Pembayaran dicatat. Sisa tagihan ${rupiah(result.summary.remaining)}.`,
      );
    },
  });
  function submit(fields: ReceiptFields) {
    const occurredAt = localWib(fields.occurredAt);
    const input: ReceiptInput = {
      amount: fields.amount,
      occurredAt,
      method: fields.method,
      note: fields.note.trim(),
    };
    if (fields.method !== 'cash') {
      input.receivingAccountReference = fields.receivingAccountReference.trim();
      input.transactionReference = fields.transactionReference.trim();
    }
    mutation.reset();
    setReview(input);
  }
  const prefix = proofId || 'settlement';
  const amountId = prefix + '-amount';
  const error = (field: keyof ReceiptFields) =>
    form.formState.errors[field]?.message;
  return (
    <div className="admin-action-form">
      <h3>{proofId ? 'Verifikasi uang masuk' : 'Catat pelunasan'}</h3>
      <p className="muted text-sm">
        {proofId
          ? 'Periksa mutasi rekening. Nominal bukti belum menjadi uang terverifikasi.'
          : 'Catat uang yang benar-benar diterima untuk sisa tagihan booking ini.'}
      </p>
      {review ? (
        <section
          className="admin-action-review"
          aria-label="Konfirmasi pencatatan"
        >
          <p className="eyebrow">Periksa sebelum menyimpan</p>
          <p className="admin-review-amount">{rupiah(review.amount)}</p>
          <dl className="price-breakdown">
            <div>
              <dt>Metode</dt>
              <dd>
                {review.method === 'cash'
                  ? 'Tunai'
                  : review.method === 'qris'
                    ? 'QRIS'
                    : 'Transfer'}
              </dd>
            </div>
            <div>
              <dt>Waktu uang masuk</dt>
              <dd>{wib(review.occurredAt)}</dd>
            </div>
            {review.receivingAccountReference && (
              <div>
                <dt>Rekening penerima</dt>
                <dd>{review.receivingAccountReference}</dd>
              </div>
            )}
            {review.transactionReference && (
              <div>
                <dt>Referensi transaksi</dt>
                <dd>{review.transactionReference}</dd>
              </div>
            )}
          </dl>
          <p>{review.note}</p>
          <p className="muted text-sm">
            Nominal kurang bayar tetap menyisakan tagihan. Kelebihan pembayaran
            dicatat terpisah untuk refund.
          </p>
          <div className="form-actions">
            <Button
              type="button"
              disabled={!online || mutation.isPending || mutation.isSuccess}
              onClick={() => mutation.mutate(review)}
            >
              {mutation.isPending
                ? 'Menyimpan...'
                : mutation.isError
                  ? 'Coba simpan lagi'
                  : 'Konfirmasi pencatatan'}
            </Button>
            <Button
              type="button"
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
        </section>
      ) : (
        <form onSubmit={form.handleSubmit(submit)} noValidate>
          <div className="admin-receipt-fields">
            <div className="field">
              <label htmlFor={amountId}>Nominal uang masuk (rupiah)</label>
              <Input
                id={amountId}
                inputMode="numeric"
                aria-invalid={!!error('amount')}
                {...form.register('amount', {
                  validate: (value) =>
                    (/^[1-9][0-9]{0,18}$/.test(value) &&
                      BigInt(value) <= 9223372036854775807n) ||
                    'Isi nominal positif tanpa titik atau koma.',
                })}
              />
              {error('amount') && (
                <p className="field-error" role="alert">
                  {error('amount')}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor={prefix + '-date'}>Waktu uang masuk (WIB)</label>
              <Input
                id={prefix + '-date'}
                type="datetime-local"
                max={currentWib()}
                aria-invalid={!!error('occurredAt')}
                {...form.register('occurredAt', {
                  validate: validateReceiptTime,
                })}
              />
              {error('occurredAt') && (
                <p className="field-error" role="alert">
                  {error('occurredAt')}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor={prefix + '-method'}>Metode pembayaran</label>
              <select id={prefix + '-method'} {...form.register('method')}>
                <option value="transfer">Transfer</option>
                <option value="qris">QRIS</option>
                <option value="cash">Tunai</option>
              </select>
            </div>
            {method !== 'cash' && (
              <>
                <div className="field">
                  <label htmlFor={prefix + '-account'}>Rekening penerima</label>
                  <Input
                    id={prefix + '-account'}
                    maxLength={150}
                    aria-invalid={!!error('receivingAccountReference')}
                    {...form.register('receivingAccountReference', {
                      validate: (value) =>
                        form.getValues('method') === 'cash' ||
                        !!value.trim() ||
                        'Isi rekening penerima.',
                    })}
                  />
                  {error('receivingAccountReference') && (
                    <p className="field-error" role="alert">
                      {error('receivingAccountReference')}
                    </p>
                  )}
                </div>
                <div className="field">
                  <label htmlFor={prefix + '-reference'}>
                    Referensi transaksi
                  </label>
                  <Input
                    id={prefix + '-reference'}
                    maxLength={150}
                    aria-invalid={!!error('transactionReference')}
                    {...form.register('transactionReference', {
                      validate: (value) =>
                        form.getValues('method') === 'cash' ||
                        !!value.trim() ||
                        'Isi referensi transaksi.',
                    })}
                  />
                  {error('transactionReference') && (
                    <p className="field-error" role="alert">
                      {error('transactionReference')}
                    </p>
                  )}
                </div>
              </>
            )}
            <div className="field admin-field-wide">
              <label htmlFor={prefix + '-note'}>Catatan pemeriksaan</label>
              <textarea
                id={prefix + '-note'}
                maxLength={1000}
                aria-invalid={!!error('note')}
                {...form.register('note', {
                  validate: (value) =>
                    value.trim().length >= 5 ||
                    'Isi catatan pemeriksaan minimal 5 karakter.',
                })}
              />
              {error('note') && (
                <p className="field-error" role="alert">
                  {error('note')}
                </p>
              )}
            </div>
          </div>
          <label className="consent-row">
            <input
              type="checkbox"
              {...form.register('checked', {
                required: 'Periksa uang masuk sebelum melanjutkan.',
              })}
            />
            <span>
              Saya sudah memeriksa dan memastikan uang benar-benar diterima.
            </span>
          </label>
          {error('checked') && (
            <p className="field-error" role="alert">
              {error('checked')}
            </p>
          )}
          <div className="form-actions">
            <Button type="submit" disabled={!online}>
              Periksa pencatatan
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Batal
            </Button>
          </div>
        </form>
      )}
      {mutation.isError && (
        <p className="form-error" role="alert">
          {errorMessage(mutation.error)}
        </p>
      )}
    </div>
  );
}
export function RejectProofForm({
  bookingId,
  proofId,
  onDone,
  onCancel,
}: {
  bookingId: string;
  proofId: string;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const online = useOnline();
  const actionKey = useActionKey();
  const [review, setReview] = useState<string | null>(null);
  const form = useForm<{ reason: string }>();
  const mutation = useMutation({
    mutationFn: (reason: string) =>
      adminApi.reject(bookingId, proofId, reason, actionKey(reason)),
    onSuccess: async () => {
      await refreshAdminPayments();
      onDone('Bukti ditolak. Booking tidak dibatalkan oleh tindakan ini.');
    },
  });
  return (
    <div className="admin-action-form">
      <h3>Tolak bukti pembayaran</h3>
      <p className="muted text-sm">
        Penolakan bukti tidak membatalkan booking. Pelanggan dapat mengunggah
        ulang sesuai tenggat aslinya.
      </p>
      {review ? (
        <section className="admin-action-review">
          <p>Alasan yang akan disampaikan kepada pelanggan:</p>
          <p>{review}</p>
          <div className="form-actions">
            <Button
              variant="destructive"
              disabled={!online || mutation.isPending || mutation.isSuccess}
              onClick={() => mutation.mutate(review)}
            >
              {mutation.isPending
                ? 'Menyimpan...'
                : mutation.isError
                  ? 'Coba tolak lagi'
                  : 'Konfirmasi penolakan bukti'}
            </Button>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => {
                mutation.reset();
                setReview(null);
              }}
            >
              Ubah alasan
            </Button>
          </div>
        </section>
      ) : (
        <form
          onSubmit={form.handleSubmit(({ reason }) => setReview(reason.trim()))}
          noValidate
        >
          <div className="field">
            <label htmlFor={proofId + '-reason'}>Alasan penolakan</label>
            <textarea
              id={proofId + '-reason'}
              maxLength={1000}
              {...form.register('reason', {
                validate: (value) =>
                  value.trim().length >= 5 || 'Isi alasan minimal 5 karakter.',
              })}
            />
            {form.formState.errors.reason && (
              <p className="field-error" role="alert">
                {form.formState.errors.reason.message}
              </p>
            )}
          </div>
          <div className="form-actions">
            <Button type="submit" variant="destructive" disabled={!online}>
              Periksa penolakan
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Batal
            </Button>
          </div>
        </form>
      )}
      {mutation.isError && (
        <p className="form-error" role="alert">
          {errorMessage(mutation.error)}
        </p>
      )}
    </div>
  );
}
