import { useState } from 'react';
export function ItemPhoto({
  path,
  name,
  className = '',
}: {
  path: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  let src = path;
  if (
    path?.startsWith('/media/') &&
    import.meta.env.VITE_API_BASE_URL?.startsWith('http')
  )
    src = new URL(path, import.meta.env.VITE_API_BASE_URL).href;
  return (
    <div className={'item-photo ' + className}>
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>Foto belum tersedia</span>
      )}
    </div>
  );
}
