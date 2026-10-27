import { site } from '@/seo/site';

export function DeliveryFeeNotice() {
  return (
    <p className="info-note delivery-fee-notice">
      Ongkir diinformasikan lewat chat dan tidak termasuk tagihan aplikasi.{' '}
      <a
        className="text-link"
        href={site.instagram}
        target="_blank"
        rel="noopener noreferrer"
      >
        Chat admin di Instagram
      </a>
    </p>
  );
}
