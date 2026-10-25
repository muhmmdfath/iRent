import { rentalDurations, durationLabel } from '../rental-duration';
import { PAGE_SIZE } from '@/lib/pagination';
import {
  ChevronLeftIcon as PaginationPreviousIcon,
  ChevronRightIcon as PaginationNextIcon,
} from '@radix-ui/react-icons';
import {
  CubeIcon,
  CalendarIcon,
  BackpackIcon,
  CheckIcon,
  Cross2Icon,
  ClockIcon,
  MinusIcon,
  PlusIcon,
} from '@radix-ui/react-icons';
import './booking-checkout.css';
import { useState, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useQuery, useQueries, useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RentalDateTimeInput } from '../components/rental-date-time-input';
import { LoadingState, ErrorState } from '@/components/feedback';
import { useSession } from '@/auth/session';
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
  const userId = useSession().data?.user.id;
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
      startAt: (() => {
        const value = params.get('startAt');
        if (!value) return defaultStart();
        const date = new Date(value);
        return Number.isFinite(date.getTime())
          ? new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 16)
          : defaultStart();
      })(),
      durationHours: rentalDurations().includes(
        Number(params.get('durationHours')),
      )
        ? Number(params.get('durationHours'))
        : 6,
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
  const stockItems = [
    ...new Map(
      [...(catalog.data?.data || []), ...selected.map((row) => row.item)].map(
        (item) => [item.id, item],
      ),
    ).values(),
  ];
  const stockQueries = useQueries({
    queries: stockItems.map((item) => ({
      queryKey: [
        'customer',
        userId,
        'booking-stock',
        item.id,
        quoteInput?.startAt,
        quoteInput?.durationHours,
      ],
      queryFn: () =>
        customerApi.availability({
          startAt: quoteInput!.startAt,
          durationHours: quoteInput!.durationHours,
          items: [{ itemId: item.id, quantity: 1 }],
          deliveryType: 'pickup' as const,
          payOption: 'full' as const,
        }),
      enabled: online && !!quoteInput && !!profile.data?.completedAt,
      retry: false,
      refetchInterval: 30000,
    })),
  });
  const stockFor = (id: string) => {
    const query = stockQueries[stockItems.findIndex((item) => item.id === id)];
    return !query || query.isFetching || query.isError || !quoteInput
      ? undefined
      : query.data?.items.find((row) => row.itemId === id)?.availableQuantity;
  };
  const updateQuantity = (id: string, quantity: number) => {
    const current = selected.find((row) => row.item.id === id)?.quantity || 1;
    const limit = stockFor(id);
    let next = Math.max(1, Math.min(100, Math.floor(quantity) || 1));
    if (next > current) {
      if (limit === undefined || limit <= current) return;
      next = Math.min(next, limit);
    }
    if (id === primary.data?.id && includePrimary) setPrimaryQuantity(next);
    else
      setExtras((current) =>
        current.map((extra) =>
          extra.item.id === id ? { ...extra, quantity: next } : extra,
        ),
      );
  };
  const selectedStockAvailable =
    selected.length > 0 &&
    selected.every((row) => {
      const count = stockFor(row.item.id);
      return count !== undefined && count >= row.quantity;
    });
  const stockError = stockQueries.find((query) => query.isError)?.error;
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
    if (create.isPending || !selectedStockAvailable) return;
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
    <div className="rental-checkout">
      <header className="page-heading checkout-heading">
        <p className="eyebrow">Booking baru</p>
        <h1>Atur jadwal sewamu.</h1>
        <p>Pilih perangkat, jadwal, lalu booking.</p>
      </header>
      <nav className="checkout-sections" aria-label="Bagian booking">
        {[
          ['checkout-devices', 'Perangkat'],
          ['checkout-schedule', 'Jadwal'],
          ['checkout-delivery', 'Pengambilan'],
          ['checkout-consent', 'Persetujuan'],
        ].map(([id, label], index) => (
          <a key={id} href={'#' + id} className="checkout-section-link">
            <span>{index + 1}</span>
            {label}
          </a>
        ))}
      </nav>
      <div className="booking-columns">
        <form
          id="rental-checkout-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            handleCheck();
          }}
        >
          <fieldset
            id="checkout-devices"
            disabled={busy}
            className="form-section checkout-block"
          >
            <legend>
              <span className="checkout-section-number">1</span>
              <CubeIcon aria-hidden="true" />
              Perangkat & aksesori
            </legend>
            <p className="checkout-section-description">
              Perangkat pilihanmu. Tambahkan aksesori jika diperlukan.
            </p>
            {stockError && (
              <div className="checkout-stock-error" role="alert">
                <p>
                  Ketersediaan belum bisa diperiksa: {errorMessage(stockError)}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    stockQueries.forEach((query) => {
                      if (query.isError) void query.refetch();
                    });
                  }}
                >
                  Periksa stok lagi
                </Button>
              </div>
            )}
            {selected.map((row) => (
              <div className="selected-item" key={row.item.id}>
                <ItemPhoto
                  path={row.item.photoPath}
                  name={row.item.name}
                  className="item-photo-thumb"
                />
                <div>
                  <h3>{row.item.name}</h3>
                  <p
                    className={
                      'checkout-stock-hint ' +
                      (stockFor(row.item.id) !== undefined &&
                      (stockFor(row.item.id) || 0) < row.quantity
                        ? 'is-short'
                        : '')
                    }
                    aria-live="polite"
                  >
                    {stockFor(row.item.id) === undefined
                      ? 'Memeriksa ketersediaan jadwal...'
                      : stockFor(row.item.id) === 0
                        ? 'Tidak tersedia pada jadwal ini. Pilih jadwal lain atau hapus item.'
                        : stockFor(row.item.id)! < row.quantity
                          ? `Hanya ${stockFor(row.item.id)} unit tersedia. Kurangi jumlah atau ubah jadwal.`
                          : `${stockFor(row.item.id)} unit tersedia pada jadwal ini`}
                  </p>
                  {row.item.category === 'iphone' ? (
                    <p className="muted text-sm">1 iPhone</p>
                  ) : (
                    <div className="quantity-field">
                      <span>Jumlah</span>
                      <div className="checkout-quantity-control">
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label={'Kurangi jumlah ' + row.item.name}
                          disabled={row.quantity <= 1}
                          onClick={() =>
                            updateQuantity(row.item.id, row.quantity - 1)
                          }
                        >
                          <MinusIcon aria-hidden="true" />
                        </Button>
                        <Input
                          aria-label={'Jumlah ' + row.item.name}
                          type="number"
                          min={1}
                          max={Math.max(1, stockFor(row.item.id) || 1)}
                          value={row.quantity}
                          onChange={(event) =>
                            updateQuantity(
                              row.item.id,
                              Number(event.target.value),
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label={'Tambah jumlah ' + row.item.name}
                          disabled={
                            !online ||
                            stockFor(row.item.id) === undefined ||
                            row.quantity >=
                              Math.min(100, stockFor(row.item.id) || 0)
                          }
                          onClick={() =>
                            updateQuantity(row.item.id, row.quantity + 1)
                          }
                        >
                          <PlusIcon aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
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
                  <Cross2Icon aria-hidden="true" />
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
                  if (
                    item &&
                    (stockFor(item.id) || 0) > 0 &&
                    !(
                      item.category === 'iphone' &&
                      selected.some((row) => row.item.category === 'iphone')
                    )
                  )
                    setExtras([...extras, { item, quantity: 1 }]);
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
                        !online ||
                        stockFor(item.id) === undefined ||
                        stockFor(item.id) === 0 ||
                        (item.category === 'iphone' &&
                          selected.some(
                            (row) => row.item.category === 'iphone',
                          ))
                      }
                    >
                      {item.name}{' '}
                      {stockFor(item.id) === undefined
                        ? '(belum diperiksa)'
                        : stockFor(item.id) === 0
                          ? '(tidak tersedia)'
                          : `(${stockFor(item.id)} tersedia)`}
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
              {catalog.data && catalog.data.total > PAGE_SIZE && (
                <div className="pagination">
                  <Button
                    className="pagination-chevron"
                    aria-label="Sebelumnya"
                    title="Sebelumnya"
                    type="button"
                    variant="ghost"
                    disabled={catalogPage === 1}
                    onClick={() => setCatalogPage(catalogPage - 1)}
                  >
                    <PaginationPreviousIcon aria-hidden="true" />
                  </Button>
                  <span>{catalogPage}</span>
                  <Button
                    className="pagination-chevron"
                    aria-label="Berikutnya"
                    title="Berikutnya"
                    type="button"
                    variant="ghost"
                    disabled={catalogPage * PAGE_SIZE >= catalog.data.total}
                    onClick={() => setCatalogPage(catalogPage + 1)}
                  >
                    <PaginationNextIcon aria-hidden="true" />
                  </Button>
                </div>
              )}
            </div>
          </fieldset>
          <fieldset
            id="checkout-schedule"
            disabled={busy}
            className="form-section checkout-block"
          >
            <legend>
              <span className="checkout-section-number">2</span>
              <CalendarIcon aria-hidden="true" />
              Jadwal sewa
            </legend>
            <p className="checkout-section-description">
              Jam kembali dihitung otomatis.
            </p>
            <div className="checkout-schedule-fields">
              <div className="field">
                <label htmlFor="startAt">
                  Tanggal dan jam pengambilan (WIB)
                </label>
                <RentalDateTimeInput
                  items={selected.map((row) => ({
                    itemId: row.item.id,
                    quantity: row.quantity,
                  }))}
                  durationHours={Number(values.durationHours)}
                  id="startAt"
                  {...form.register('startAt')}
                  value={values.startAt}
                  timeRange={{ from: rule.open_time, to: rule.close_time }}
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
                  {rentalDurations(rule.max_duration_hours).map((hours) => (
                    <option
                      key={hours}
                      value={hours}
                      disabled={
                        !validDuration(values.startAt, hours, policy.data!)
                      }
                    >
                      {durationLabel(hours)}
                      {!validDuration(values.startAt, hours, policy.data!)
                        ? ' - di luar jam layanan'
                        : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="checkout-return-preview">
              <ClockIcon aria-hidden="true" />
              <div>
                <span>Rencana kembali</span>
                <strong>
                  {quoteInput
                    ? wib(
                        new Date(
                          Date.parse(quoteInput.startAt) +
                            quoteInput.durationHours * 3600000,
                        ).toISOString(),
                      )
                    : 'Lengkapi jadwal sewa'}
                </strong>
              </div>
            </div>
          </fieldset>
          <fieldset
            id="checkout-delivery"
            disabled={busy}
            className="form-section checkout-block"
          >
            <legend>
              <span className="checkout-section-number">3</span>
              <BackpackIcon aria-hidden="true" />
              Pengambilan & pembayaran
            </legend>
            <p className="checkout-section-description">
              Pilih cara ambil dan pembayaran.
            </p>
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
          </fieldset>
          <fieldset
            id="checkout-consent"
            disabled={busy}
            className="form-section consent-section checkout-block"
          >
            <legend>
              <span className="checkout-section-number">4</span>
              <CheckIcon aria-hidden="true" />
              Persetujuan
            </legend>
            <label className="check-label">
              <input
                type="checkbox"
                checked={!!values.agreeTerms}
                onChange={(event) => {
                  for (const field of [
                    'agreeTerms',
                    'prepareIdentity',
                    'understandPayment',
                    'agreeOperatingHours',
                  ] as const)
                    form.setValue(field, event.target.checked, {
                      shouldDirty: true,
                    });
                }}
              />
              <span>
                Saya setuju{' '}
                <Link
                  className="checkout-terms-link"
                  to="/terms"
                  target="_blank"
                  rel="noreferrer"
                >
                  ketentuan sewa
                </Link>
                , membawa KTP/SIM, membayar tepat waktu, dan mengikuti jam
                layanan.
              </span>
            </label>
            {form.formState.errors.agreeTerms && (
              <p className="field-error">
                {form.formState.errors.agreeTerms.message}
              </p>
            )}
          </fieldset>
        </form>
        <aside className="quote-panel" aria-label="Ringkasan booking">
          <p className="checkout-summary-eyebrow">Booking kamu</p>
          <h2>Ringkasan biaya</h2>
          <div className="checkout-summary-items">
            {selected.map((row) => (
              <div key={row.item.id}>
                <ItemPhoto
                  path={row.item.photoPath}
                  name={row.item.name}
                  className="checkout-summary-photo"
                />
                <div>
                  <strong>{row.item.name}</strong>
                  <span>{row.quantity} unit</span>
                </div>
              </div>
            ))}
          </div>
          {quoteInput && (
            <dl className="checkout-summary-schedule">
              <div>
                <dt>Mulai</dt>
                <dd>{wib(quoteInput.startAt)}</dd>
              </div>
              <div>
                <dt>Durasi</dt>
                <dd>{durationLabel(quoteInput.durationHours)}</dd>
              </div>
              <div>
                <dt>Pengambilan</dt>
                <dd>
                  {values.deliveryType === 'delivery'
                    ? 'Antar-jemput'
                    : 'Ambil di toko'}
                </dd>
              </div>
            </dl>
          )}
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
            <div className="checkout-unchecked">
              <CalendarIcon aria-hidden="true" />
              <p>Jadwal sudah sesuai?</p>
              <span>Cek jadwal untuk melihat total biaya.</span>
            </div>
          )}
          {error && (
            <p role="alert" className="form-error">
              {errorMessage(error)}
            </p>
          )}
          <Button
            type="submit"
            form="rental-checkout-form"
            variant={
              currentPreview?.availability.available ? 'outline' : 'default'
            }
            className="checkout-check-button"
            disabled={!online || busy || !selected.length}
          >
            {check.isPending
              ? 'Memeriksa jadwal...'
              : currentPreview
                ? 'Periksa ulang jadwal & biaya'
                : 'Periksa jadwal & biaya'}
          </Button>
          <Button
            type="button"
            className="w-full"
            disabled={
              !online ||
              busy ||
              !selectedStockAvailable ||
              !currentPreview?.availability.available
            }
            onClick={handleCreate}
          >
            {create.isPending ? 'Membuat booking...' : 'Buat booking'}
          </Button>
          <p className="muted text-sm">
            Setelah booking, lanjut bayar dan upload bukti.
          </p>
        </aside>
      </div>
    </div>
  );
}
