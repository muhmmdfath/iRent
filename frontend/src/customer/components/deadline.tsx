import { useEffect, useState } from 'react';
import { wib } from '../format';
export function Deadline({ at, label }: { at: string; label: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = new Date(at).getTime() - now;
  const minutes = Math.max(0, Math.ceil(remaining / 60000));
  return (
    <div className={'deadline ' + (remaining < 0 ? 'deadline-overdue' : '')}>
      <p>{label}</p>
      <strong>{wib(at)}</strong>
      <span>
        {remaining < 0
          ? 'Tenggat terlewati'
          : minutes >= 60
            ? Math.floor(minutes / 60) +
              ' jam ' +
              (minutes % 60) +
              ' menit tersisa'
            : minutes + ' menit tersisa'}
      </span>
    </div>
  );
}
