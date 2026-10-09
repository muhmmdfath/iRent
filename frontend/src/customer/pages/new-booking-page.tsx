import { useState, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState, ErrorState } from '@/components/feedback';
import { useOnline } from '@/hooks/use-online';
import { errorMessage } from '@/services/api';
import { queryClient } from '@/services/query-client';
import { useProfile, usePolicy } from '../hooks';
import { customerApi } from '../api';
import { ItemPhoto } from '../components/item-photo';
import { defaultStart, localWib, rupiah, wib } from '../format';
import type {
  Item,
  QuoteInput,
  Quote,
  Availability,
  BookingInput,
  Policy,
} from '../types';
interface Fields {
  startAt: string;
  durationHours: number;
  deliveryType: 'pickup' | 'delivery';
  deliveryZoneId: string;
  deliveryAddress: string;
  payOption: 'dp' | 'full';
  agreeTerms: boolean;
  prepareIdentity: boolean;
  understandPayment: boolean;
  agreeOperatingHours: boolean;
}
function validDuration(local: string, hours: number, policy: Policy) {
  try {
    const end = new Date(
      new Date(localWib(local)).getTime() + (hours + 7) * 3600000,
    )
      .toISOString()
      .slice(11, 16);
    return end >= policy.values.open_time && end <= policy.values.close_time;
  } catch {
    return true;
  }
}
export function NewBookingPage() {
  const [params] = useSearchParams();
  const initialId = params.get('itemId') || '';
  const navigate = useNavigate();
  const online = useOnline();
  const profile = useProfile();
  const policy = usePolicy();
  const primary = useQuery({
    queryKey: ['item', initialId],
    queryFn: ({ signal }) => customerApi.item(initialId, signal),
    enabled: !!initialId,
  });
  const [catalogPage, setCatalogPage] = useState(1);
  const catalog = useQuery({
    queryKey: ['catalog', catalogPage],
    queryFn: ({ signal }) => customerApi.catalog(catalogPage, signal),
  });
  const zones = useQuery({
    queryKey: ['delivery-zones'],
    queryFn: ({ signal }) => customerApi.zones(signal),
  });
  const [primaryQuantity, setPrimaryQuantity] = useState(1);
  const [includePrimary, setIncludePrimary] = useState(true);
  const [extras, setExtras] = useState<{ item: Item; quantity: number }[]>([]);
  const selected = [
    ...(includePrimary && primary.data
      ? [{ item: primary.data, quantity: primaryQuantity }]
      : []),
    ...extras,
  ];
  const form = useForm<Fields>({
    defaultValues: {
      startAt: defaultStart(),
      durationHours: 6,
      deliveryType: 'pickup',
      deliveryZoneId: '',
      deliveryAddress: '',
      payOption: 'dp',
      agreeTerms: false,
      prepareIdentity: false,
      understandPayment: false,
      agreeOperatingHours: false,
    },
  });
  const values = {
    ...form.getValues(),
    ...useWatch({ control: form.control }),
  };
  let quoteInput: QuoteInput | null = null;
  try {
    quoteInput = {
      startAt: localWib(values.startAt),
      durationHours: Number(values.durationHours),
      items: selected.map((row) => ({
        itemId: row.item.id,
        quantity: row.quantity,
      })),
      deliveryType: values.deliveryType,
      payOption: values.payOption,
      ...(values.deliveryType === 'delivery'
        ? { deliveryZoneId: values.deliveryZoneId }
        : {}),
    };
  } catch {
    /* User is still entering the schedule. */
  }
  const fingerprint = JSON.stringify({
    quoteInput,
    address:
      values.deliveryType === 'delivery' ? values.deliveryAddress.trim() : null,
  });
  const [preview, setPreview] = useState<{
    fingerprint: string;
    quote: Quote;
    availability: Availability;
  } | null>(null);
  const check = useMutation({
    mutationFn: async ({
      input,
      fingerprint,
    }: {
      input: QuoteInput;
      fingerprint: string;
    }) => {
      const [quote, availability] = await Promise.all([
        customerApi.quote(input),
        customerApi.availability(input),
      ]);
      return { quote, availability, fingerprint };
    },
    onSuccess: setPreview,
  });
  const action = useRef<{ fingerprint: string; key: string } | null>(null);
  const create = useMutation({
    mutationFn: ({ input, key }: { input: BookingInput; key: string }) =>
      customerApi.create(input, key),
    onSuccess: async (booking) => {
      await queryClient.invalidateQueries({ queryKey: ['customer'] });
      navigate('/app/bookings/' + booking.id + '/payment', { replace: true });
    },
  });
  const currentPreview = preview?.fingerprint === fingerprint ? preview : null;
  if (profile.isPending || policy.isPending || (initialId && primary.isPending))
    return <LoadingState text="Menyiapkan booking..." />;
  if (profile.isError || policy.isError || (initialId && primary.isError))
    return (
      <ErrorState
        error={profile.error || policy.error || primary.error}
        retry={() => {
          void profile.refetch();
          void policy.refetch();
          if (initialId) void primary.refetch();
        }}
      />
    );
  if (!profile.data?.completedAt)
    return (
      <>
        <header className="page-heading">
          <h1>Lengkapi profil dahulu</h1>
          <p>Data penyewa diperlukan sebelum membuat booking.</p>
        </header>
        <Button asChild>
          <Link
            to={
              '/app/profile?returnTo=' +
              encodeURIComponent(
                '/app/new' +
                  (initialId ? '?itemId=' + encodeURIComponent(initialId) : ''),
              )
            }
          >
            Lengkapi profil
          </Link>
        </Button>
      </>
    );
  const rule = policy.data!.values;
  const busy = check.isPending || create.isPending;
  const error = check.error || create.error;
  const handleCheck = () => {
    form.clearErrors();
    setPreview(null);
    check.reset();
    create.reset();
    if (!selected.length) {
      form.setError('startAt', { message: 'Pilih minimal satu item.' });
      return;
    }
    if (!quoteInput) {
      form.setError('startAt', {
        message: 'Pilih tanggal dan jam yang valid.',
      });
      return;
    }
    check.mutate({ input: quoteInput, fingerprint });
  };
  const handleCreate = () => {
    if (create.isPending) return;
    if (!currentPreview?.availability.available || !quoteInput) return;
    if (
      !values.agreeTerms ||
      !values.prepareIdentity ||
      !values.understandPayment ||
      !values.agreeOperatingHours
    ) {
      form.setError('agreeTerms', {
        message: 'Lengkapi seluruh persetujuan sebelum membuat booking.',
      });
      return;
    }
    if (
      values.deliveryType === 'delivery' &&
      values.deliveryAddress.trim().length < 5
    ) {
      form.setError('deliveryAddress', {
        message: 'Isi alamat antar-jemput lengkap.',
      });
      return;
    }
    const input: BookingInput = {
      ...quoteInput,
      termsVersion: policy.data!.termsVersion,
      agreeTerms: true,
      prepareIdentity: true,
      understandPayment: true,
      agreeOperatingHours: true,
      ...(values.deliveryType === 'delivery'
        ? { deliveryAddress: values.deliveryAddress.trim() }
        : {}),
    };
    const payload = JSON.stringify(input);
    if (action.current?.fingerprint !== payload)
      action.current = { fingerprint: payload, key: crypto.randomUUID() };
    create.mutate({ input, key: action.current.key });
  };
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Booking baru</p>
        <h1>Atur jadwal sewamu.</h1>
        <p>Periksa jadwal dan biaya sebelum membuat booking.</p>
      </header>
      <div className="booking-columns">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            handleCheck();
          }}
        >
          <fieldset disabled={busy} className="form-section">
            <legend>Perangkat & aksesori</legend>
            {selected.map((row) => (
              <div className="selected-item" key={row.item.id}>
                <ItemPhoto
                  path={row.item.photoPath}
                  name={row.item.name}
                  className="item-photo-thumb"
                />
                <div>
                  <h3>{row.item.name}</h3>
                  {row.item.category === 'iphone' ? (
                    <p className="muted text-sm">1 iPhone</p>
                  ) : (
                    <label className="quantity-field">
                      Jumlah
                      <Input
                        aria-label={'Jumlah ' + row.item.name}
                        type="number"
                        min={1}
                        max={100}
                        value={row.quantity}
                        onChange={(event) => {
                          if (
                            row.item.id === primary.data?.id &&
                            includePrimary
                          )
                            setPrimaryQuantity(Number(event.target.value));
                          else
                            setExtras(
                              extras.map((extra) =>
                                extra.item.id === row.item.id
                                  ? {
                                      ...extra,
                                      quantity: Number(event.target.value),
                                    }
                                  : extra,
                              ),
                            );
                        }}
                      />
                    </label>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={'Hapus ' + row.item.name}
                  onClick={() => {
                    if (row.item.id === primary.data?.id && includePrimary)
                      setIncludePrimary(false);
                    else
                      setExtras(
                        extras.filter((extra) => extra.item.id !== row.item.id),
                      );
                  }}
                >
                  Hapus
                </Button>
              </div>
            ))}
            <div className="field">
              <label htmlFor="add-item">Tambah perangkat atau aksesori</label>
              <select
                id="add-item"
                value=""
                className="select-input"
                disabled={catalog.isPending || catalog.isError}
                onChange={(event) => {
                  const item = catalog.data?.data.find(
                    (item) => item.id === event.target.value,
                  );
                  if (item) setExtras([...extras, { item, quantity: 1 }]);
                }}
              >
                <option value="">Pilih item</option>
                {catalog.data?.data
                  .filter(
                    (item) => !selected.some((row) => row.item.id === item.id),
                  )
                  .map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                      disabled={
                        item.category === 'iphone' &&
                        selected.some((row) => row.item.category === 'iphone')
                      }
                    >
                      {item.name}
                    </option>
                  ))}
              </select>
              {catalog.isError && (
                <p className="field-error">
                  {errorMessage(catalog.error)}{' '}
                  <button
                    type="button"
                    onClick={() => void catalog.refetch()}
                    className="text-link"
                  >
                    Coba lagi
                  </button>
                </p>
              )}
              {catalog.data && catalog.data.total > 12 && (
                <div className="pagination">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={catalogPage === 1}
                    onClick={() => setCatalogPage(catalogPage - 1)}
                  >
                    Sebelumnya
                  </Button>
                  <span>{catalogPage}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={catalogPage * 12 >= catalog.data.total}
                    onClick={() => setCatalogPage(catalogPage + 1)}
                  >
                    Berikutnya
                  </Button>
                </div>
              )}
            </div>
          </fieldset>
          <fieldset disabled={busy} className="form-section">
            <legend>Jadwal & pengambilan</legend>
            <div className="field">
              <label htmlFor="startAt">Tanggal dan jam pengambilan (WIB)</label>
              <Input
                id="startAt"
                type="datetime-local"
                {...form.register('startAt')}
              />
              {form.formState.errors.startAt && (
                <p className="field-error">
                  {form.formState.errors.startAt.message}
                </p>
              )}
              <p className="muted text-sm mt-2">
                Ambil dan kembali {rule.open_time}-{rule.close_time} WIB.
                Minimal {rule.min_lead_minutes / 60} jam sebelum pengambilan.
              </p>
            </div>
            <div className="field">
              <label htmlFor="duration">Durasi sewa</label>
              <select
                id="duration"
                className="select-input"
                {...form.register('durationHours', { valueAsNumber: true })}
              >
                {[
                  6,
                  12,
                  ...Array.from(
                    { length: Math.floor(rule.max_duration_hours / 24) },
                    (_, index) => (index + 1) * 24,
                  ),
                ].map((hours) => (
                  <option
                    key={hours}
                    value={hours}
                    disabled={
                      !validDuration(values.startAt, hours, policy.data!)
                    }
                  >
                    {hours} jam
                    {!validDuration(values.startAt, hours, policy.data!)
                      ? ' - kembali di luar jam operasional'
                      : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="deliveryType">Cara pengambilan</label>
              <select
                id="deliveryType"
                className="select-input"
                {...form.register('deliveryType')}
              >
                <option value="pickup">Ambil di toko</option>
                <option value="delivery">Antar-jemput</option>
              </select>
            </div>
            {values.deliveryType === 'delivery' && (
              <>
                <div className="field">
                  <label htmlFor="deliveryZone">Zona antar-jemput</label>
                  <select
                    id="deliveryZone"
                    className="select-input"
                    {...form.register('deliveryZoneId')}
                  >
                    <option value="">Pilih zona</option>
                    {zones.data?.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name} - {rupiah(zone.fee)}
                      </option>
                    ))}
                  </select>
                  {zones.isError && (
                    <p className="field-error">
                      {errorMessage(zones.error)}{' '}
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => void zones.refetch()}
                      >
                        Coba lagi
                      </button>
                    </p>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="deliveryAddress">Alamat antar-jemput</label>
                  <textarea
                    id="deliveryAddress"
                    rows={3}
                    maxLength={1000}
                    className="text-area"
                    {...form.register('deliveryAddress')}
                  />
                  {form.formState.errors.deliveryAddress && (
                    <p className="field-error">
                      {form.formState.errors.deliveryAddress.message}
                    </p>
                  )}
                </div>
              </>
            )}
            <div className="field">
              <label htmlFor="payOption">Pembayaran awal</label>
              <select
                id="payOption"
                className="select-input"
                {...form.register('payOption')}
              >
                <option value="dp">DP</option>
                <option value="full">Lunas</option>
              </select>
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={!online || !selected.length}
            >
              Periksa jadwal & biaya
            </Button>
          </fieldset>
          <fieldset disabled={busy} className="form-section consent-section">
            <legend>Persetujuan</legend>
            <label className="check-label">
              <input type="checkbox" {...form.register('agreeTerms')} />
              <span>
                Saya menyetujui{' '}
                <Link
                  className="text-link"
                  to="/terms"
                  target="_blank"
                  rel="noreferrer"
                >
                  ketentuan sewa
                </Link>
                .
              </span>
            </label>
            <label className="check-label">
              <input type="checkbox" {...form.register('prepareIdentity')} />
              Saya menyiapkan KTP/SIM saat pengambilan.
            </label>
            <label className="check-label">
              <input type="checkbox" {...form.register('understandPayment')} />
              Saya memahami pembayaran dan bukti harus diselesaikan sesuai
              tenggat.
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                {...form.register('agreeOperatingHours')}
              />
              Saya menyetujui jam operasional pengambilan dan pengembalian.
            </label>
            {form.formState.errors.agreeTerms && (
              <p className="field-error">
                {form.formState.errors.agreeTerms.message}
              </p>
            )}
          </fieldset>
        </form>
        <aside className="quote-panel" aria-label="Ringkasan booking">
          <h2>Ringkasan biaya</h2>
          {currentPreview ? (
            <>
              <dl className="price-breakdown">
                {currentPreview.quote.lines.map((line) => (
                  <div key={line.itemId}>
                    <dt>
                      {line.itemName} ({line.quantity})
                    </dt>
                    <dd>{rupiah(line.subtotal)}</dd>
                  </div>
                ))}
                <div>
                  <dt>Antar-jemput</dt>
                  <dd>{rupiah(currentPreview.quote.deliveryFee)}</dd>
                </div>
                <div>
                  <dt>Total sewa</dt>
                  <dd>{rupiah(currentPreview.quote.grandTotal)}</dd>
                </div>
              </dl>
              <div className="amount-focus">
                <p>Bayar setelah booking</p>
                <strong>{rupiah(currentPreview.quote.amountDueNow)}</strong>
              </div>
              <p className="muted text-sm">
                Kembali {wib(currentPreview.quote.endAt)}
              </p>
              {currentPreview.quote.mustPayFull && (
                <p className="info-note">
                  Total tidak melebihi DP. Pembayaran wajib lunas.
                </p>
              )}
              <p
                className={
                  currentPreview.availability.available
                    ? 'success-note'
                    : 'form-error'
                }
              >
                {currentPreview.availability.available
                  ? 'Jadwal tersedia saat diperiksa'
                  : 'Item tidak tersedia pada jadwal ini. Pilih jadwal atau item lain.'}
              </p>
            </>
          ) : (
            <p className="muted">
              Periksa jadwal untuk melihat biaya dan ketersediaan terbaru.
            </p>
          )}
          {error && (
            <p role="alert" className="form-error">
              {errorMessage(error)}
            </p>
          )}
          <Button
            type="button"
            className="w-full"
            disabled={
              !online || busy || !currentPreview?.availability.available
            }
            onClick={handleCreate}
          >
            {create.isPending ? 'Membuat booking...' : 'Buat booking'}
          </Button>
          <p className="muted text-sm">
            Harga dan stok diperiksa ulang saat booking dibuat. Setelah
            berhasil, kamu dapat langsung upload bukti pembayaran.
          </p>
        </aside>
      </div>
    </>
  );
}
