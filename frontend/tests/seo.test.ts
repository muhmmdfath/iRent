import { describe, expect, it } from 'vitest';
import { applyPageMetadata } from '@/seo/metadata';
import { organization, publicPages, site } from '@/seo/site';

describe('public search metadata', () => {
  it('updates one canonical without query parameters and clears stale public metadata on private pages', () => {
    applyPageMetadata({
      ...publicPages['/'],
      path: '/',
      index: true,
      structuredData: organization,
    });
    expect(document.title).toBe(publicPages['/'].title);
    expect(document.querySelector('meta[property="og:url"]')).toHaveAttribute(
      'content',
      site.url + '/',
    );
    applyPageMetadata({
      ...publicPages['/catalog'],
      path: '/catalog',
      index: true,
      structuredData: organization,
    });
    expect(
      document.head.querySelectorAll('link[rel="canonical"]'),
    ).toHaveLength(1);
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      site.url + '/catalog',
    );
    expect(
      JSON.parse(document.getElementById('site-structured-data')!.textContent!),
    ).toEqual(organization);
    applyPageMetadata({
      description: 'Area akun dan layanan iRent Semarang.',
      index: false,
    });
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex,nofollow',
    );
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('meta[property="og:url"]')).toBeNull();
    expect(document.querySelector('meta[name="twitter:image"]')).toBeNull();
    expect(document.getElementById('site-structured-data')).toBeNull();
  });
  it('serializes structured text without introducing executable markup', () => {
    applyPageMetadata({
      description: 'Deskripsi',
      path: '/',
      index: true,
      structuredData: { name: '</script><script>example</script>' },
    });
    const script = document.getElementById('site-structured-data')!;
    expect(script.textContent).not.toContain('<');
    expect(JSON.parse(script.textContent!)).toEqual({
      name: '</script><script>example</script>',
    });
    expect(organization['@graph'][0].sameAs).toEqual([
      'https://www.instagram.com/irent_semarang/',
    ]);
  });
});
