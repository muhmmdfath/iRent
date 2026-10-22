import type { Plugin } from 'vite';
import { organization, publicPages, site } from './src/seo/site';

const escape = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

// Public entry pages carry useful content and metadata before JavaScript runs.
// Live inventory, prices, and business settings are always loaded by the app.
export function seoFiles(): Plugin {
  return {
    name: 'irent-public-seo',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset')
        throw new Error('Missing application HTML');
      const template = String(index.source);
      for (const [route, page] of Object.entries(publicPages)) {
        const canonical = site.url + route;
        const head = [
          `<meta name="robots" content="index,follow">`,
          `<link rel="canonical" href="${canonical}">`,
          `<meta property="og:title" content="${escape(page.title)}">`,
          `<meta property="og:description" content="${escape(page.description)}">`,
          `<meta property="og:url" content="${canonical}">`,
          `<meta property="og:type" content="website">`,
          `<meta property="og:site_name" content="${site.name}">`,
          `<meta property="og:locale" content="id_ID">`,
          `<meta property="og:image" content="${site.url + site.image}">`,
          `<meta property="og:image:alt" content="iRent Semarang — sewa iPhone dan aksesori">`,
          `<meta name="twitter:card" content="summary_large_image">`,
          `<meta name="twitter:title" content="${escape(page.title)}">`,
          `<meta name="twitter:description" content="${escape(page.description)}">`,
          `<meta name="twitter:image" content="${site.url + site.image}">`,
          `<script type="application/ld+json" id="site-structured-data">${JSON.stringify(organization).replaceAll('<', '\\u003c')}</script>`,
          route === '/'
            ? '<link rel="preload" as="image" href="/images/iphone-cinematic-1280.webp" imagesrcset="/images/iphone-cinematic-640.webp 640w, /images/iphone-cinematic-1280.webp 1280w" imagesizes="(max-width: 767px) calc(100vw - 40px), 520px">'
            : '',
        ].join('\n');
        const content = `<main id="main-content" style="max-width:960px;margin:0 auto;padding:32px 24px;font-family:Poppins,sans-serif"><a href="/"><img src="${site.logo}" width="150" height="150" alt="iRent Semarang"></a><h1>${page.heading}</h1><p>${page.description}</p>${route === '/' ? '<h2>Booking online, ambil atau diantar</h2><p>Pilih perangkat dan jadwal, lengkapi profil, lalu unggah bukti pembayaran. Admin memeriksa uang masuk sebelum konfirmasi. Pelunasan sewa dan ongkir dilakukan sebelum serah-terima.</p><p>Pilihan paket 6, 12, dan 24 jam, dengan harga yang sama pada weekday dan weekend. Ketersediaan mengikuti unit dan jadwal yang dipilih.</p>' : ''}<nav aria-label="Navigasi website"><a href="/catalog">Katalog perangkat</a> · <a href="/terms">Panduan dan ketentuan sewa</a> · <a href="${site.instagram}" rel="noopener noreferrer">@irent_semarang</a></nav><p>Katalog dan informasi operasional terbaru dimuat oleh aplikasi. Aktifkan JavaScript untuk melanjutkan booking.</p></main>`;
        const html = template
          .replace(
            /<title>.*?<\/title>/s,
            `<title>${escape(page.title)}</title>`,
          )
          .replace(
            /<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/s,
            `<meta name="description" content="${escape(page.description)}">`,
          )
          .replace('</head>', head + '\n</head>')
          .replace('<div id="root"></div>', `<div id="root">${content}</div>`);
        if (route === '/') index.source = html;
        else
          this.emitFile({
            type: 'asset',
            fileName: route.slice(1) + '.html',
            source: html,
          });
      }
      // Deep links get a neutral shell, never the homepage canonical.
      this.emitFile({
        type: 'asset',
        fileName: 'app-shell.html',
        source: template,
      });
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(
        publicPages,
      )
        .map((route) => `<url><loc>${site.url + route}</loc></url>`)
        .join('')}</urlset>\n`;
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: sitemap,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /app\nDisallow: /login\nDisallow: /register\n\nSitemap: ${site.url}/sitemap.xml\n`,
      });
    },
  };
}
