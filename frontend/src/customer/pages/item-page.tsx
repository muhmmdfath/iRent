import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckIcon,
  ClockIcon,
  CubeIcon,
  ChevronLeftIcon,
  CalendarIcon,
} from '@radix-ui/react-icons';
import { Button } from '@/components/ui/button';
import { LoadingState, ErrorState } from '@/components/feedback';
import { customerApi } from '../api';
import { ItemPhoto } from '../components/item-photo';
import { rupiah, defaultStart, localWib, wib } from '../format';
import { DateTimeInput } from '@/components/ui/date-time-input';
import { usePolicy } from '../hooks';
import './item-detail.css';
export function ItemPage() {
  const policy = usePolicy();
  const serviceHours = {
    from: policy.data?.values.open_time || '08:00',
    to: policy.data?.values.close_time || '22:00',
  };
  const { id = '' } = useParams();
  const [duration, setDuration] = useState<6 | 12 | 24>(6);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [start, setStart] = useState(defaultStart);
  const query = useQuery({
    queryKey: ['item', id],
    queryFn: ({ signal }) => customerApi.item(id, signal),
  });
  if (query.isPending) return <LoadingState text="Memuat perangkat..." />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const item = query.data;
  const price =
    duration === 6
      ? item.price6h
      : duration === 12
        ? item.price12h
        : item.price24h;
  let startAt = '';
  let endAt = '';
  let scheduleError = '';
  try {
    startAt = localWib(start);
    const end = new Date(Date.parse(startAt) + duration * 3600000);
    endAt = end.toISOString();
    const endTime = new Date(end.getTime() + 7 * 3600000)
      .toISOString()
      .slice(11, 16);
    if (Date.parse(startAt) < Date.now() + 2 * 3600000)
      scheduleError = 'Pilih waktu mulai minimal 2 jam dari sekarang.';
    else if (
      start.slice(11) < serviceHours.from ||
      start.slice(11) > serviceHours.to ||
      endTime < serviceHours.from ||
      endTime > serviceHours.to
    )
      scheduleError = `Waktu ambil dan kembali harus pukul ${serviceHours.from}–${serviceHours.to} WIB.`;
  } catch {
    scheduleError = 'Pilih tanggal dan jam yang valid.';
  }
  return (
    <div className="rental-product-page">
      <nav className="rental-product-nav" aria-label="Navigasi perangkat">
        <Link className="product-nav-link" to="/catalog">
          <ChevronLeftIcon aria-hidden="true" />
          Katalog perangkat
        </Link>
        <span>/</span>
        <span>{item.name}</span>
      </nav>
      <div className="rental-product-layout">
        <div className="rental-product-content">
          <div className="rental-product-stage">
            <span className="rental-product-category">
              {item.category === 'iphone' ? 'iPhone' : 'Aksesori'}
            </span>
            <ItemPhoto
              key={item.photoPath}
              path={item.photoPath}
              name={item.name}
              className="rental-product-photo"
            />
            <span className="rental-product-location">iRent Semarang</span>
          </div>
          <section
            className="rental-product-package"
            aria-labelledby="product-package-title"
          >
            <div className="rental-product-section-title">
              <CubeIcon aria-hidden="true" />
              <h2 id="product-package-title">Dalam paket sewa</h2>
            </div>
            <p>Kelengkapan yang tercantum untuk {item.name}.</p>
            {item.includes.length ? (
              <ul>
                {item.includes.map((text, index) => (
                  <li key={index}>
                    <span>
                      <CheckIcon aria-hidden="true" />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Belum ada kelengkapan tambahan yang tercantum.</p>
            )}
          </section>
        </div>
        <aside
          className="rental-product-booking"
          aria-label="Pilihan paket sewa"
        >
          <header>
            <p className="rental-product-eyebrow">
              {item.category === 'iphone' ? 'Sewa iPhone' : 'Sewa aksesori'}
            </p>
            <h1>{item.name}</h1>
            <p className="rental-product-intro">
              Pilih paket dan jadwal sewa yang sesuai dengan kebutuhanmu.
            </p>
          </header>
          <div className="rental-product-price" aria-live="polite">
            <strong>{rupiah(price)}</strong>
            <span>/ {duration} jam</span>
          </div>
          <div className="rental-product-plan">
            <h2>Pilih durasi</h2>
            <div
              className="rental-product-options"
              aria-label="Durasi paket sewa"
            >
              {([6, 12, 24] as const).map((hours) => (
                <button
                  key={hours}
                  type="button"
                  aria-pressed={duration === hours}
                  onClick={() => setDuration(hours)}
                >
                  <span>{hours} jam</span>
                  <small>
                    {hours === 24
                      ? 'Sehari penuh'
                      : hours === 12
                        ? 'Lebih lama'
                        : 'Singkat'}
                  </small>
                </button>
              ))}
            </div>
            <p>Tarif sama setiap hari, termasuk akhir pekan.</p>
          </div>
          <Button
            type="button"
            variant={scheduleOpen ? 'outline' : 'default'}
            className="rental-product-cta"
            aria-expanded={scheduleOpen}
            aria-controls="product-schedule"
            onClick={() => setScheduleOpen(!scheduleOpen)}
          >
            <CalendarIcon aria-hidden="true" />
            {scheduleOpen ? 'Tutup pilihan jadwal' : 'Pilih jadwal'}
          </Button>
          {scheduleOpen && (
            <div id="product-schedule" className="product-schedule-panel">
              <label htmlFor="product-start">Mulai sewa (WIB)</label>
              <DateTimeInput
                id="product-start"
                name="productStart"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                initiallyOpen
                timeRange={serviceHours}
              />
              <div className="product-schedule-return">
                <span>Jadwal kembali</span>
                <strong>{endAt ? wib(endAt) : 'Pilih jadwal mulai'}</strong>
              </div>
              {scheduleError && (
                <p className="product-schedule-error" role="alert">
                  {scheduleError}
                </p>
              )}
              <Button
                asChild
                disabled={!!scheduleError}
                className="rental-product-cta"
              >
                <Link
                  aria-disabled={!!scheduleError}
                  onClick={(event) => {
                    if (scheduleError) event.preventDefault();
                  }}
                  to={
                    '/app/new?' +
                    new URLSearchParams({
                      itemId: item.id,
                      durationHours: String(duration),
                      startAt,
                    })
                  }
                >
                  Lanjut booking
                </Link>
              </Button>
            </div>
          )}
          <p className="rental-product-availability">
            Ketersediaan diperiksa sesuai tanggal dan jam pilihan. Belum ada
            unit yang dipesan pada tahap ini.
          </p>
          <div className="rental-product-notes">
            <div>
              <ClockIcon aria-hidden="true" />
              <p>
                <strong>Butuh lebih dari satu hari?</strong>
                <span>
                  Paket kelipatan 24 jam hingga 7 hari tersedia saat memilih
                  jadwal.
                </span>
              </p>
            </div>
            <div>
              <CheckIcon aria-hidden="true" />
              <p>
                <strong>Pengambilan sesuai kebutuhan</strong>
                <span>
                  Ambil sendiri atau pilih antar-jemput sesuai zona yang
                  tersedia.
                </span>
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
