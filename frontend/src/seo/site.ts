export const site = {
  name: 'iRent Semarang',
  url: 'https://irentsmg.tech',
  instagram: 'https://www.instagram.com/irent_semarang/',
  logo: '/brand/irent-logo.png',
  image: '/images/iphone-cinematic-1280.webp',
  description:
    'Sewa iPhone dan aksesori di Semarang untuk konten, perjalanan, dan acara. Pilih paket 6, 12, atau 24 jam, booking online, serta pickup atau antar-jemput sesuai zona.',
} as const;

export const publicPages = {
  '/': {
    title: 'iRent Semarang — Sewa iPhone & Aksesori',
    description: site.description,
    heading: 'Sewa iPhone dan aksesori di Semarang',
  },
  '/catalog': {
    title: 'Katalog Sewa iPhone & Aksesori Semarang — iRent',
    description:
      'Lihat koleksi iPhone dan aksesori iRent Semarang. Bandingkan tarif paket 6, 12, dan 24 jam, lalu cek ketersediaan sesuai jadwal sebelum booking online.',
    heading: 'Katalog perangkat iRent Semarang',
  },
  '/terms': {
    title: 'Panduan & Ketentuan Sewa iPhone Semarang — iRent',
    description:
      'Baca panduan sewa iRent Semarang: booking online, pembayaran, serah-terima, pengembalian, perpanjangan, dan refund sebelum memilih jadwal sewa.',
    heading: 'Panduan dan ketentuan sewa iRent Semarang',
  },
} as const;

export const organization = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': site.url + '/#organization',
      name: site.name,
      url: site.url + '/',
      logo: site.url + site.logo,
      description: site.description,
      sameAs: [site.instagram],
      areaServed: { '@type': 'City', name: 'Semarang' },
    },
    {
      '@type': 'WebSite',
      '@id': site.url + '/#website',
      name: site.name,
      url: site.url + '/',
      inLanguage: 'id-ID',
      publisher: { '@id': site.url + '/#organization' },
    },
  ],
};
