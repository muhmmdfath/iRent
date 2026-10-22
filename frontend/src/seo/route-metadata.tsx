import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customerApi } from '@/customer/api';
import { applyPageMetadata } from './metadata';
import { organization, publicPages, site } from './site';

export function RouteMetadata() {
  const location = useLocation();
  const path = location.pathname.replace(/\/$/, '') || '/';
  const itemId = path.match(/^\/catalog\/([0-9a-f-]{36})$/i)?.[1];
  const item = useQuery({
    queryKey: ['item', itemId || 'seo-disabled'],
    queryFn: ({ signal }) => customerApi.item(itemId!, signal),
    enabled: !!itemId,
  });
  useEffect(() => {
    const page = publicPages[path as keyof typeof publicPages];
    if (page) {
      applyPageMetadata({
        ...page,
        path,
        index: true,
        structuredData: organization,
      });
    } else if (itemId) {
      applyPageMetadata({
        title: item.data
          ? `Sewa ${item.data.name} di Semarang — iRent`
          : 'Detail Perangkat Sewa Semarang — iRent',
        description: item.data
          ? `Sewa ${item.data.name} di iRent Semarang. Lihat kelengkapan, tarif paket 6, 12, dan 24 jam, lalu cek jadwal dan booking online.`
          : 'Lihat detail perangkat, kelengkapan, dan pilihan paket sewa iRent Semarang.',
        path: item.isError ? undefined : path,
        index: !item.isError,
        image: item.data?.photoPath
          ? site.url + item.data.photoPath
          : undefined,
        structuredData: item.isError ? undefined : organization,
      });
    } else {
      applyPageMetadata({
        description: 'Area akun dan layanan iRent Semarang.',
        index: false,
      });
    }
  }, [path, location.search, itemId, item.data, item.isError]);
  return null;
}
