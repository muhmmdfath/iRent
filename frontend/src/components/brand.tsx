import { Link } from 'react-router-dom';
export function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="brand" aria-label="iRent Semarang - beranda">
      <img
        className="brand-logo"
        src="/brand/irent-logo.png"
        width="150"
        height="72"
        alt="iRent Semarang"
      />
    </Link>
  );
}
