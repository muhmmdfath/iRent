import { Link } from 'react-router-dom';
export function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="brand" aria-label="iRent Semarang - beranda">
      <span className="brand-symbol" aria-hidden="true">
        iR
      </span>
      <span>
        iRent<span className="brand-location">Semarang</span>
      </span>
    </Link>
  );
}
