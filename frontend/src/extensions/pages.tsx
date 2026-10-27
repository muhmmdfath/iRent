import { deliveryViaChat } from '@/customer/delivery-fee';
import { DeliveryFeeNotice } from '@/customer/components/delivery-fee-notice';
import { PAGE_SIZE } from '@/lib/pagination';
import {
  AdminWorkspace,
  AdminHeader,
  AdminBadge,
  AdminHint,
  AdminTabs,
  AdminEmpty,
} from '@/admin/manage/workspace';
import { reasonField } from '@/components/action-fields';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '@/auth/session';
import { api } from '@/services/api';
import { customerApi } from '@/customer/api';
import { BusinessForm } from '@/components/business-form';
import { ExtensionRequestForm } from './components/extension-request-form';
import {
  receiptFields,
  validateSimpleReceipt,
} from '@/components/receipt-fields';
import { DownloadButton } from '@/components/download-button';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { ProofViewer } from '@/admin/components/proof-viewer';
import { ItemPhoto } from '@/customer/components/item-photo';
import { rupiah, wib } from '@/customer/format';
import { useInventoryClock } from '@/admin/inventory/hooks';
import type { Extension, ExtensionDetail } from './types';
import { extensionLabels, pendingExtension } from './types';
import { useAdminRead, type Page } from '@/admin/manage/hooks';
import { Pager } from '@/admin/manage/components';
function useExtensionContext(id: string, extensionId?: string) {
  const user = useSession().data?.user;
  const mode = user?.role === 'admin' ? 'admin' : 'customer';
  const money = useQuery({
    queryKey: [mode, user?.id, 'financial', id],
    enabled: !!user && !!id,
    refetchInterval: 15000,
    queryFn: ({ signal }) => customerApi.financial(id, signal),
  });
  const detail = useQuery({
    queryKey: [mode, user?.id, 'extension', id, extensionId],
    enabled: !!user && !!id && !!extensionId,
    refetchInterval: 15000,
    queryFn: async ({ signal }) =>
      (
        await api.get<ExtensionDetail>(
          `/bookings/${id}/extensions/${extensionId}`,
          { signal },
        )
      ).data,
  });
  return { money, detail, admin: mode === 'admin' };
}
export function NewExtensionPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { money } = useExtensionContext(id);
  if (money.isPending) return <LoadingState text="Memuat unit sewa..." />;
  if (money.isError)
    return (
      <ErrorState error={money.error} retry={() => void money.refetch()} />
    );
  return (
    <>
      <Link className="back-link" to={'/app/bookings/' + id}>
        Detail booking
      </Link>
      <header className="page-heading">
        <h1>Perpanjang sewa</h1>
        <p>
          Pilih unit dan paket tambahan. Pengajuan paling lambat dua jam sebelum
          jadwal kembali setiap unit.
        </p>
      </header>
      <ExtensionRequestForm
        booking={money.data.booking}
        onDone={(extensionId) =>
          navigate(`/app/bookings/${id}/extensions/${extensionId}`)
        }
        onCancel={() => navigate('/app/bookings/' + id)}
      />
    </>
  );
}
export function ExtensionDetailPage() {
  const { id = '', extensionId = '' } = useParams();
  const { money, detail, admin } = useExtensionContext(id, extensionId);
  const [action, setAction] = useState<string | null>(null);
  const options = useQuery({
    queryKey: ['payment-options'],
    queryFn: ({ signal }) => customerApi.paymentOptions(signal),
  });
  const now = useInventoryClock();
  if (money.isPending || detail.isPending)
    return <LoadingState text="Memuat perpanjangan..." />;
  if (money.isError)
    return (
      <ErrorState error={money.error} retry={() => void money.refetch()} />
    );
  if (detail.isError)
    return (
      <ErrorState error={detail.error} retry={() => void detail.refetch()} />
    );
  const extension = detail.data.extension;
  const parent = money.data.booking;
  const pending = pendingExtension(extension.status);
  const obligation = parent.obligations.find(
    (value) => value.extensionId === extensionId,
  );
  const credited = BigInt(obligation?.creditedAmount ?? '0');
  const owed =
    BigInt(extension.amountDue) > credited
      ? BigInt(extension.amountDue) - credited
      : 0n;
  const pendingProof = obligation?.proofs?.find(
    (proof) =>
      proof.id === obligation.pendingProofId && proof.status === 'pending',
  );
  const prefix = `${admin ? '/admin' : ''}/bookings/${id}/extensions/${extensionId}`;
  const terminal = ['ditolak', 'dibatalkan', 'kedaluwarsa'].includes(
    extension.status,
  );
  const canUpload =
    !admin &&
    !pendingProof &&
    ['menunggu_pembayaran', 'menunggu_konfirmasi'].includes(extension.status) &&
    !!extension.expiresAt &&
    new Date(extension.expiresAt).getTime() >= now;
  const done = () => {
    setAction(null);
    void detail.refetch();
    void money.refetch();
  };
  function post(path: string, input: unknown, key: string) {
    return api.post(prefix + path, input, {
      headers: { 'Idempotency-Key': key },
    });
  }
  return (
    <div className={admin ? 'admin-workspace am-extension-detail' : undefined}>
      <Link
        className="back-link"
        to={`${admin ? '/admin' : '/app'}/bookings/${id}`}
      >
        {parent.code}
      </Link>
      <header className="page-heading">
        <p className="eyebrow">{parent.code}</p>
        <h1>Detail perpanjangan</h1>
        <span className="status-badge">
          {extensionLabels[extension.status]}
        </span>
        <p>Jadwal sewa berubah setelah persetujuan seluruh unit.</p>
      </header>
      {detail.data.confirmationOverdue && (
        <p className="form-error">
          Konfirmasi terlambat; pengajuan tetap memerlukan keputusan admin.
        </p>
      )}
      {extension.rejectedReason && (
        <p className="info-note">
          Alasan penolakan: {extension.rejectedReason}
        </p>
      )}
      {extension.cancelReason && (
        <p className="info-note">Alasan pembatalan: {extension.cancelReason}</p>
      )}
      <section className="form-section">
        <h2>Unit & jadwal tambahan</h2>
        {extension.items.map((item) => {
          const unit = parent.items?.find(
            (value) => value.id === item.bookingItemId,
          );
          return (
            <article className="management-row" key={item.id}>
              <div>
                <h3>
                  {unit?.itemNameSnapshot || 'Unit sewa'} ·{' '}
                  {unit?.unitCodeSnapshot}
                </h3>
                <p>Lama: {wib(item.oldEndAt)}</p>
                <p>
                  Usulan baru: {wib(item.proposedEndAt)} · +{item.addedHours}{' '}
                  jam
                </p>
              </div>
            </article>
          );
        })}
      </section>
      <section className="form-section">
        <h2>Biaya perpanjangan</h2>
        {deliveryViaChat(parent) && <DeliveryFeeNotice />}
        <dl className="price-breakdown">
          <div>
            <dt>Sewa tambahan</dt>
            <dd>{rupiah(extension.rentalQuoteTotal)}</dd>
          </div>
          <div>
            <dt>Ongkir tambahan</dt>
            <dd>
              {deliveryViaChat(parent)
                ? 'Diinfokan lewat chat'
                : extension.extraDeliveryQuote === null
                  ? 'Menunggu quotation'
                  : rupiah(extension.extraDeliveryQuote)}
            </dd>
          </div>
          <div>
            <dt>Total pengajuan</dt>
            <dd>{rupiah(extension.amountDue)}</dd>
          </div>
          <div>
            <dt>Dana sudah diterima untuk kewajiban</dt>
            <dd>{rupiah(credited.toString())}</dd>
          </div>
        </dl>
        {extension.deliveryQuoteNote && <p>{extension.deliveryQuoteNote}</p>}
        {!terminal && extension.status !== 'draft_quote' && (
          <p className="amount-focus">
            {extension.status === 'disetujui'
              ? 'Sisa tagihan'
              : 'Pembayaran yang perlu dilengkapi'}{' '}
            {rupiah(
              extension.status === 'disetujui'
                ? detail.data.summary.remaining
                : owed.toString(),
            )}
          </p>
        )}
        {extension.expiresAt && (
          <p>
            Batas upload {wib(extension.expiresAt)}{' '}
            {new Date(extension.expiresAt).getTime() < now
              ? '· Sudah lewat'
              : ''}
          </p>
        )}
        {extension.confirmationDueAt && (
          <p className="muted">
            Batas konfirmasi {wib(extension.confirmationDueAt)}
          </p>
        )}
      </section>
      <div className="form-actions">
        {admin &&
          extension.status === 'disetujui' &&
          BigInt(detail.data.summary.remaining) > 0n && (
            <Button disabled={!!action} onClick={() => setAction('settlement')}>
              Catat pelunasan perpanjangan
            </Button>
          )}
        {!admin && extension.status === 'draft_quote' && extension.quotedAt && (
          <Button disabled={!!action} onClick={() => setAction('submit')}>
            Setujui ongkir & lanjut bayar
          </Button>
        )}
        {!admin && pending && (
          <Button
            variant="outline"
            disabled={!!action}
            onClick={() => setAction('cancel')}
          >
            Batalkan pengajuan
          </Button>
        )}
        {canUpload && (
          <Button disabled={!!action} onClick={() => setAction('upload')}>
            Upload bukti perpanjangan
          </Button>
        )}
        {admin && extension.status === 'draft_quote' && (
          <Button disabled={!!action} onClick={() => setAction('quote')}>
            Tentukan ongkir tambahan
          </Button>
        )}
        {admin && pending && (
          <Button
            variant="outline"
            disabled={!!action}
            onClick={() => setAction('reject')}
          >
            Tolak pengajuan
          </Button>
        )}
        {admin &&
          ['menunggu_pembayaran', 'menunggu_konfirmasi'].includes(
            extension.status,
          ) &&
          !pendingProof &&
          owed === 0n && (
            <Button disabled={!!action} onClick={() => setAction('approve')}>
              Setujui seluruh unit
            </Button>
          )}
      </div>
      {canUpload && (
        <section className="form-section">
          <h2>Bayar perpanjangan</h2>
          {options.isPending ? (
            <LoadingState text="Memuat QRIS..." />
          ) : options.isError ? (
            <ErrorState
              error={options.error}
              retry={() => void options.refetch()}
            />
          ) : options.data.qrisImagePath ? (
            <ItemPhoto
              path={options.data.qrisImagePath}
              name="QRIS toko"
              className="qris-image"
            />
          ) : (
            <p className="muted">
              QRIS belum tersedia. Hubungi toko untuk petunjuk pembayaran.
            </p>
          )}
          <p>
            Pastikan kode booking {parent.code} dan nominal pengajuan sebelum
            membayar.
          </p>
        </section>
      )}
      {action === 'settlement' && (
        <BusinessForm
          title="Catat pelunasan perpanjangan"
          fields={receiptFields(detail.data.summary.remaining, true)}
          validate={validateSimpleReceipt}
          execute={async (input, key) =>
            api.post(
              `/admin/bookings/${id}/settlement`,
              { ...input, extensionId },
              { headers: { 'Idempotency-Key': key } },
            )
          }
          onDone={done}
          onCancel={() => setAction(null)}
        />
      )}
      {action === 'submit' && (
        <BusinessForm
          title="Setujui ongkir perpanjangan"
          description={`Ongkir tambahan ${rupiah(extension.extraDeliveryQuote ?? '0')}. Stok dan batas pengajuan diperiksa ulang; quotation tidak menjamin slot.`}
          execute={async (_, key) =>
            post(
              '/submit',
              {
                agreeExtraDelivery: true,
                expectedExtraDeliveryQuote: extension.extraDeliveryQuote,
              },
              key,
            )
          }
          onDone={done}
          onCancel={() => setAction(null)}
        />
      )}
      {action === 'quote' && (
        <BusinessForm
          title="Simpan quotation ongkir"
          fields={[
            {
              name: 'extraDeliveryQuote',
              label: 'Ongkir tambahan (rupiah)',
              type: 'money',
              value: extension.extraDeliveryQuote ?? '0',
            },
            { name: 'note', label: 'Alasan ongkir', type: 'textarea' },
          ]}
          execute={async (input, key) => post('/quote', input, key)}
          onDone={done}
          onCancel={() => setAction(null)}
        />
      )}
      {['cancel', 'reject'].includes(action || '') && (
        <BusinessForm
          title={action === 'cancel' ? 'Batalkan pengajuan' : 'Tolak pengajuan'}
          fields={[reasonField]}
          description="Jadwal sewa awal tetap berlaku. Dana yang sudah diterima ditangani melalui refund manual."
          execute={async (input, key) => post('/' + action, input, key)}
          onDone={done}
          onCancel={() => setAction(null)}
        />
      )}
      {action === 'approve' && (
        <BusinessForm
          title="Setujui seluruh unit"
          description="Persetujuan memeriksa seluruh unit dan menerapkan jadwal/biaya secara atomik."
          execute={async (_, key) => post('/approve', {}, key)}
          onDone={done}
          onCancel={() => setAction(null)}
        />
      )}
      {action === 'upload' && (
        <BusinessForm
          title="Upload bukti perpanjangan"
          file
          fields={[
            {
              name: 'claimedAmount',
              label: 'Nominal pada bukti (rupiah)',
              type: 'money',
              value: owed.toString(),
            },
          ]}
          execute={async (input, key, file) => {
            const body = new FormData();
            body.append('claimedAmount', input.claimedAmount);
            body.append('file', file!, file!.name);
            return post('/proofs', body, key);
          }}
          onDone={done}
          onCancel={() => setAction(null)}
        />
      )}
      <section className="form-section">
        <h2>Bukti pembayaran perpanjangan</h2>
        {!obligation?.proofs?.length && (
          <p className="muted">Belum ada bukti pembayaran.</p>
        )}
        {obligation?.proofs?.map((proof) => (
          <article className="admin-proof" key={proof.id}>
            <p>
              {rupiah(proof.claimedAmount)} ·{' '}
              {proof.status === 'pending'
                ? 'Menunggu verifikasi'
                : proof.status === 'verified'
                  ? 'Diverifikasi'
                  : 'Ditolak'}
            </p>
            <p className="muted">Diunggah {wib(proof.uploadedAt)}</p>
            {proof.rejectedReason && <p>Alasan: {proof.rejectedReason}</p>}
            {admin ? (
              <ProofViewer proof={proof} />
            ) : (
              <DownloadButton
                path={`/payment-proofs/${proof.id}/file`}
                filename={`bukti-${proof.id}.${proof.mime === 'application/pdf' ? 'pdf' : proof.mime === 'image/png' ? 'png' : 'jpg'}`}
                label="Unduh bukti perpanjangan"
              />
            )}
            {admin && proof.status === 'pending' && !terminal && (
              <div className="form-actions">
                <Button
                  disabled={!!action}
                  onClick={() => setAction('verify:' + proof.id)}
                >
                  Verifikasi uang perpanjangan
                </Button>
                <Button
                  variant="outline"
                  disabled={!!action}
                  onClick={() => setAction('rejectProof:' + proof.id)}
                >
                  Tolak bukti perpanjangan
                </Button>
              </div>
            )}
            {action === 'verify:' + proof.id && (
              <BusinessForm
                title="Verifikasi uang perpanjangan"
                description="Pastikan uang sudah masuk."
                fields={receiptFields(proof.claimedAmount, true)}
                validate={validateSimpleReceipt}
                execute={async (input, key) =>
                  post('/payments/verify', { ...input, proofId: proof.id }, key)
                }
                onDone={done}
                onCancel={() => setAction(null)}
              />
            )}
            {action === 'rejectProof:' + proof.id && (
              <BusinessForm
                title="Tolak bukti perpanjangan"
                fields={[reasonField]}
                execute={async (input, key) =>
                  post(`/proofs/${proof.id}/reject`, input, key)
                }
                onDone={done}
                onCancel={() => setAction(null)}
              />
            )}
          </article>
        ))}
      </section>
      {admin && obligation && (
        <section className="form-section">
          <h2>Rekonsiliasi dana tambahan</h2>
          <p>
            Catat uang aktual yang belum tercatat dari bukti ditolak atau
            pengajuan yang ditutup. Rekonsiliasi tidak mengaktifkan pengajuan
            kembali.
          </p>
          <Button
            variant="outline"
            disabled={!!action}
            onClick={() => setAction('reconcile')}
          >
            Rekonsiliasi uang perpanjangan
          </Button>
          {action === 'reconcile' && (
            <BusinessForm
              title="Rekonsiliasi uang perpanjangan"
              fields={[
                ...receiptFields(),
                {
                  name: 'proofId',
                  label: 'Bukti sumber',
                  type: 'select',
                  optional: true,
                  options: [
                    { value: '', label: 'Tanpa bukti unggahan' },
                    ...(obligation.proofs || [])
                      .filter(
                        (proof) =>
                          proof.status === 'rejected' ||
                          (terminal && proof.status === 'pending'),
                      )
                      .map((proof) => ({
                        value: proof.id,
                        label: `${wib(proof.uploadedAt)} · ${rupiah(proof.claimedAmount)}`,
                      })),
                  ],
                },
              ]}
              validate={validateSimpleReceipt}
              execute={async (input, key) =>
                post(
                  '/payments/reconcile',
                  { ...input, obligationId: obligation.id },
                  key,
                )
              }
              onDone={done}
              onCancel={() => setAction(null)}
            />
          )}
        </section>
      )}
    </div>
  );
}
export function ExtensionQueuePage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const query = useAdminRead<
    Page<Extension & { booking: { code: string; customer: { name: string } } }>
  >(
    'extensions',
    '/admin/extensions',
    { status: status || undefined, page, limit: PAGE_SIZE },
    true,
  );
  function filter(value: string) {
    setStatus(value);
    setPage(1);
  }
  return (
    <AdminWorkspace kind="extensions">
      <AdminHeader
        title="Perpanjangan"
        description="Periksa ongkir tambahan, pembayaran, dan usulan jadwal setiap unit."
      />
      <AdminHint>
        Jadwal awal tetap berlaku sampai perpanjangan disetujui. Quotation
        ongkir belum menahan slot unit.
      </AdminHint>
      <AdminTabs
        value={status}
        onChange={filter}
        label="Filter cepat perpanjangan"
        options={[
          { value: '', label: 'Semua pengajuan' },
          { value: 'draft_quote', label: 'Perlu ongkir' },
          { value: 'menunggu_konfirmasi', label: 'Perlu verifikasi' },
          { value: 'disetujui', label: 'Disetujui' },
        ]}
      />
      <div className="am-queue-filter">
        <label className="field">
          Status pengajuan
          <select
            className="select-input"
            value={status}
            onChange={(event) => filter(event.target.value)}
          >
            <option value="">Semua status</option>
            {Object.entries(extensionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {query.data && <p>{query.data.total} pengajuan sesuai filter</p>}
      </div>
      {query.isPending ? (
        <LoadingState text="Memuat perpanjangan..." />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <section className="form-section">
            <header className="am-panel-heading">
              <h2>Antrean pengajuan</h2>
              <span>Jadwal & pembayaran tambahan</span>
            </header>
            {query.data.data.map((extension) => (
              <article className="am-queue-row" key={extension.id}>
                <div>
                  <h2>{extension.booking.customer.name}</h2>
                  <p>{extension.booking.code}</p>
                  <small>{extension.items.length} unit diajukan</small>
                </div>
                <div>
                  <AdminBadge
                    tone={
                      extension.status === 'disetujui'
                        ? 'green'
                        : extension.status === 'menunggu_konfirmasi'
                          ? 'pink'
                          : extension.status === 'draft_quote'
                            ? 'amber'
                            : 'neutral'
                    }
                  >
                    {extensionLabels[extension.status]}
                  </AdminBadge>
                  {extension.confirmationDueAt && (
                    <small>
                      Batas konfirmasi {wib(extension.confirmationDueAt)}
                    </small>
                  )}
                </div>
                <div className="am-queue-amount">
                  <strong>{rupiah(extension.amountDue)}</strong>
                  <small>Nominal pengajuan</small>
                </div>
                <Button variant="outline" asChild>
                  <Link
                    to={`/admin/bookings/${extension.bookingId}/extensions/${extension.id}`}
                  >
                    Periksa perpanjangan
                  </Link>
                </Button>
              </article>
            ))}
            {!query.data.data.length && (
              <AdminEmpty
                title="Belum ada pengajuan yang sesuai."
                description="Pengajuan baru akan muncul di antrean sesuai statusnya."
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
