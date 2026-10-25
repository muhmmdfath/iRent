import { durationPrice } from '../rental-duration';
import { Link } from 'react-router-dom';
import { PlusIcon } from '@radix-ui/react-icons';
import { rupiah } from '../format';
import { ItemPhoto } from './item-photo';
import type { Item } from '../types';
import type { RentalWindow } from './rental-date-filter';
export function HomeDeviceCard({
  item,
  window,
  count,
  pending = false,
  failed = false,
}: {
  item: Item;
  window: RentalWindow | null;
  count?: number;
  pending?: boolean;
  failed?: boolean;
}) {
  const canBook = !!window && !failed && !!count;
  const params = new URLSearchParams({ itemId: item.id });
  if (window) {
    params.set('startAt', window.startAt);
    params.set('durationHours', String(window.durationHours));
  }
  const hours = window?.durationHours || 6;
  const price = durationPrice(item, hours);
  return (
    <article className="customer-device">
      <Link
        className="home-device-visual"
        to={canBook ? '/app/new?' + params : '/catalog/' + item.id}
        aria-label={canBook ? 'Pilih jadwal ini' : 'Lihat perangkat'}
        title={
          canBook
            ? 'Pilih ' + item.name + ' untuk jadwal ini'
            : 'Lihat ' + item.name
        }
      >
        <ItemPhoto
          path={item.photoPath}
          name={item.name}
          className="customer-device-photo"
        />
        {window && (
          <span
            className={
              'home-device-badge ' +
              (pending
                ? 'is-checking'
                : failed
                  ? 'is-unknown'
                  : count
                    ? 'is-available'
                    : 'is-unavailable')
            }
          >
            <span aria-hidden="true" />
            {pending
              ? 'Memeriksa'
              : failed
                ? 'Belum terperiksa'
                : count
                  ? `${count} unit tersedia`
                  : 'Tidak tersedia pada jadwal ini'}
          </span>
        )}
        <span className="home-device-open" aria-hidden="true">
          <PlusIcon />
        </span>
      </Link>
      <div className="home-device-caption">
        <p className="customer-device-category">
          {item.category === 'iphone' ? 'iPhone' : 'Aksesori'}
        </p>
        <h3>{item.name}</h3>
        <p className="customer-device-price">
          {rupiah(price)} <span>/ {hours} jam</span>
        </p>
      </div>
    </article>
  );
}
