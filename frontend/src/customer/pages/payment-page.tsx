import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState, ErrorState } from '@/components/feedback';
import { useOnline } from '@/hooks/use-online';
import { useSession } from '@/auth/session';
import { queryClient } from '@/services/query-client';
import { errorMessage } from '@/services/api';
import { customerApi } from '../api';
import { useFinancial } from '../hooks';
import { rupiah, statusLabels, wib } from '../format';
import { ItemPhoto } from '../components/item-photo';
import { Deadline } from '../components/deadline';
import type { Financial, Obligation } from '../types';
export function PaymentPage() {
  const { id = '' } = useParams();
  const query = useFinancial(id);
  const options = useQuery({
    queryKey: ['payment-options'],
    queryFn: ({ signal }) => customerApi.paymentOptions(signal),
  });
  const userId = useSession().data!.user.id;
  const online = useOnline();
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const settlementKey = useRef<string | null>(null);
  const settlement = useMutation({
    mutationFn: () =>
      customerApi.settlement(
        id,
        settlementKey.current || (settlementKey.current = crypto.randomUUID()),
      ),
    onSuccess: async (data) => {
      queryClient.setQueryData(['customer', userId, 'financial', id], data);
      await queryClient.invalidateQueries({ queryKey: ['customer', userId] });
    },
  });
  if (query.isPending) return <LoadingState text="Memuat pembayaran..." />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const financial = query.data;
  const booking = financial.booking;
  const terminal = ['kedaluwarsa', 'ditolak', 'dibatalkan'].includes(
    booking.status,
  );
  const obligation = booking.obligations.find(
    (row) =>
      row.extensionId === null &&
      ['open', 'proof_pending'].includes(row.status),
  );
  const pending =
    obligation?.status === 'proof_pending' || !!obligation?.pendingProofId;
  const completed = financial.summary.paymentStatus === 'lunas';
  const refresh = async (data?: Financial) => {
    if (data)
      queryClient.setQueryData(['customer', userId, 'financial', id], data);
    await queryClient.invalidateQueries({ queryKey: ['customer', userId] });
  };
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">{booking.code}</p>
        <h1>Pembayaran booking</h1>
        <p>
          <span className="status-badge">{statusLabels[booking.status]}</span>
        </p>
      </header>
      <div className="payment-columns">
        <section>
          <div className="payment-overview">
            {booking.items?.[0] && (
              <ItemPhoto
                path={booking.items[0].item?.photoPath || null}
                name={booking.items[0].itemNameSnapshot}
                className="item-photo-thumb"
              />
            )}
            <div>
              <h2>
                {booking.items?.[0]?.itemNameSnapshot ||
                  'Booking ' + booking.code}
              </h2>
              <p className="muted">Pengambilan {wib(booking.initialStartAt)}</p>
            </div>
          </div>
          {terminal ? (
            <p className="info-note">
              Booking telah {statusLabels[booking.status].toLowerCase()}. Jangan
              melakukan pembayaran baru untuk booking ini.
            </p>
          ) : pending ? (
            <>
              <p className="success-note">
                Bukti sudah diterima. Menunggu pemeriksaan uang masuk oleh
                admin.
              </p>
              {booking.confirmationDueAt && (
                <Deadline
                  at={booking.confirmationDueAt}
                  label="Batas konfirmasi admin"
                />
              )}
              {financial.confirmationOverdue && (
                <p className="info-note">
                  Konfirmasi admin terlambat. Booking tetap menunggu
                  pemeriksaan.
                </p>
              )}
            </>
          ) : BigInt(financial.summary.bill) === 0n ? (
            <p className="info-note">
              Tidak ada tagihan pembayaran.
              {booking.status === 'menunggu_pembayaran'
                ? ' Admin masih perlu mengonfirmasi booking.'
                : ''}
            </p>
          ) : completed ? (
            <p className="success-note">
              Pembayaran telah lunas dan terverifikasi.
            </p>
          ) : obligation ? (
            <div className="amount-focus">
              <p>
                {obligation.purpose === 'initial_dp'
                  ? 'Bayar DP sekarang'
                  : 'Bayar sekarang'}
              </p>
              <strong>
                {rupiah(obligation.remainingAmount ?? obligation.amountDue)}
              </strong>
              {obligation.expiresAt && (
                <Deadline
                  at={obligation.expiresAt}
                  label="Batas upload bukti"
                />
              )}
            </div>
          ) : (
            <p className="info-note">
              Booking telah dikonfirmasi. Sisa biaya perlu dilunasi sebelum
              serah terima.
            </p>
          )}
          {!terminal && obligation && !pending && (
            <>
              <section className="form-section">
                <h2>Pembayaran QRIS</h2>
                {options.isPending ? (
                  <p className="muted">Memuat QRIS...</p>
                ) : options.isError ? (
                  <p className="form-error">
                    {errorMessage(options.error)}{' '}
                    <button
                      className="text-link"
                      onClick={() => void options.refetch()}
                    >
                      Coba lagi
                    </button>
                  </p>
                ) : options.data.qrisImagePath ? (
                  <ItemPhoto
                    path={options.data.qrisImagePath}
                    name="QRIS iRent"
                    className="qris-image"
                  />
                ) : (
                  <p className="muted">
                    QRIS belum tersedia. Hubungi admin iRent untuk instruksi
                    pembayaran.
                  </p>
                )}
                <p className="muted text-sm">
                  Bayar sesuai nominal, lalu upload bukti. Admin akan memeriksa
                  uang yang benar-benar masuk.
                </p>
              </section>
              <UploadForm
                key={obligation.id}
                bookingId={id}
                obligation={obligation}
                refresh={refresh}
              />
            </>
          )}
          {!terminal &&
            !obligation &&
            !completed &&
            ['dikonfirmasi', 'berjalan', 'selesai'].includes(
              booking.status,
            ) && (
              <div className="form-section">
                <h2>Pelunasan</h2>
                <p className="muted">
                  Sisa tagihan {rupiah(financial.summary.remaining)}.
                </p>
                <Button
                  disabled={!online || settlement.isPending}
                  onClick={() => settlement.mutate()}
                >
                  {settlement.isPending
                    ? 'Menyiapkan pembayaran...'
                    : 'Bayar pelunasan'}
                </Button>
                {settlement.isError && (
                  <p role="alert" className="form-error">
                    {errorMessage(settlement.error)}
                  </p>
                )}
              </div>
            )}
          <section className="form-section">
            <h2>Riwayat bukti</h2>
            {booking.obligations.flatMap((row) => row.proofs || []).length ===
            0 ? (
              <p className="muted">Belum ada bukti yang diunggah.</p>
            ) : (
              booking.obligations
                .flatMap((row) => row.proofs || [])
                .map((proof) => (
                  <div className="proof-row" key={proof.id}>
                    <div>
                      <p>{rupiah(proof.claimedAmount)}</p>
                      <p className="muted text-sm">{wib(proof.uploadedAt)}</p>
                      <p className="text-sm">
                        {proof.status === 'pending'
                          ? 'Menunggu verifikasi'
                          : proof.status === 'verified'
                            ? 'Diverifikasi'
                            : 'Ditolak'}
                      </p>
                      {proof.rejectedReason && (
                        <p className="field-error">{proof.rejectedReason}</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      disabled={!!downloading || !online}
                      onClick={async () => {
                        setDownloadError(null);
                        setDownloading(proof.id);
                        try {
                          const blob = await customerApi.downloadProof(
                            proof.id,
                          );
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download =
                            'bukti-' +
                            proof.id +
                            '.' +
                            (proof.mime === 'application/pdf'
                              ? 'pdf'
                              : proof.mime === 'image/png'
                                ? 'png'
                                : 'jpg');
                          link.click();
                          window.setTimeout(
                            () => URL.revokeObjectURL(url),
                            1000,
                          );
                        } catch (error) {
                          setDownloadError(errorMessage(error));
                        } finally {
                          setDownloading(null);
                        }
                      }}
                    >
                      {downloading === proof.id
                        ? 'Mengunduh...'
                        : 'Unduh bukti'}
                    </Button>
                  </div>
                ))
            )}
            {downloadError && (
              <p className="form-error" role="alert">
                {downloadError}
              </p>
            )}
          </section>
        </section>
        <aside className="quote-panel">
          <h2>Rincian pembayaran</h2>
          <dl className="price-breakdown">
            <div>
              <dt>Total tagihan</dt>
              <dd>{rupiah(financial.summary.bill)}</dd>
            </div>
            <div>
              <dt>Sudah diterapkan</dt>
              <dd>{rupiah(financial.summary.applied)}</dd>
            </div>
            {BigInt(financial.summary.reserved) > 0n && (
              <div>
                <dt>Dana menunggu penerapan</dt>
                <dd>{rupiah(financial.summary.reserved)}</dd>
              </div>
            )}
            <div>
              <dt>Sisa tagihan</dt>
              <dd>{rupiah(financial.summary.remaining)}</dd>
            </div>
          </dl>
          <p className="muted text-sm">
            Nominal pada bukti belum dihitung sebagai pembayaran terverifikasi.
          </p>
          <Button asChild variant="outline">
            <Link to={'/app/bookings/' + id}>Detail booking</Link>
          </Button>
          <button
            className="text-link"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            Perbarui status
          </button>
        </aside>
      </div>
    </>
  );
}
function UploadForm({
  bookingId,
  obligation,
  refresh,
}: {
  bookingId: string;
  obligation: Obligation;
  refresh: (data?: Financial) => Promise<void>;
}) {
  const online = useOnline();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const action = useRef<{ file: File; amount: string; key: string } | null>(
    null,
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ claimedAmount: string }>({
    defaultValues: {
      claimedAmount: obligation.remainingAmount ?? obligation.amountDue,
    },
  });
  const mutation = useMutation({
    mutationFn: ({
      file,
      amount,
      key,
    }: {
      file: File;
      amount: string;
      key: string;
    }) => customerApi.upload(bookingId, obligation.id, file, amount, key),
    onSuccess: async (data) => {
      setFile(null);
      setUploaded(true);
      await refresh(data);
    },
  });
  return (
    <section className="form-section">
      <h2>Upload bukti pembayaran</h2>
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(async (values) => {
            setFileError(null);
            setUploaded(false);
            if (!file) {
              setFileError('Pilih file bukti pembayaran.');
              return;
            }
            if (
              file.size > 2 * 1024 * 1024 ||
              !['image/jpeg', 'image/png', 'application/pdf'].includes(
                file.type,
              )
            ) {
              setFileError('Gunakan JPG, PNG, atau PDF maksimal 2 MB.');
              return;
            }
            const amount = values.claimedAmount.trim();
            if (
              action.current?.file !== file ||
              action.current.amount !== amount
            )
              action.current = { file, amount, key: crypto.randomUUID() };
            await mutation
              .mutateAsync({ file, amount, key: action.current.key })
              .catch(() => undefined);
          })(event);
        }}
      >
        <div className="field">
          <label htmlFor="claimedAmount">
            Nominal yang ditransfer (rupiah)
          </label>
          <Input
            id="claimedAmount"
            disabled={mutation.isPending || isSubmitting}
            inputMode="numeric"
            aria-invalid={!!errors.claimedAmount}
            {...register('claimedAmount', {
              validate: (value) =>
                (/^\d+$/.test(value.trim()) && BigInt(value.trim()) > 0n) ||
                'Isi nominal rupiah bulat yang positif.',
            })}
          />
          {errors.claimedAmount && (
            <p className="field-error">{errors.claimedAmount.message}</p>
          )}
        </div>
        <div className="field">
          <label htmlFor="proofFile">Bukti pembayaran</label>
          <Input
            id="proofFile"
            disabled={mutation.isPending || isSubmitting}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setFileError(null);
              mutation.reset();
            }}
          />
          <p className="muted text-sm mt-2">
            JPG, PNG, atau PDF. Maksimal 2 MB.
          </p>
          {fileError && (
            <p className="field-error" role="alert">
              {fileError}
            </p>
          )}
        </div>
        {mutation.isError && (
          <p className="form-error" role="alert">
            {errorMessage(mutation.error)}
          </p>
        )}
        {uploaded && (
          <p className="success-note" role="status">
            Bukti berhasil diunggah.
          </p>
        )}
        <Button disabled={!online || isSubmitting || mutation.isPending}>
          {mutation.isPending ? 'Mengunggah...' : 'Upload bukti pembayaran'}
        </Button>
      </form>
    </section>
  );
}
