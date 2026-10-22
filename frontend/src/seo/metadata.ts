import { site } from './site';

export interface PageMetadata {
  title?: string;
  description: string;
  path?: string;
  index: boolean;
  image?: string;
  structuredData?: unknown;
}

export function applyPageMetadata(value: PageMetadata) {
  if (value.title) document.title = value.title;
  function meta(key: string, content: string, property = false) {
    const attribute = property ? 'property' : 'name';
    let element = document.head.querySelector<HTMLMetaElement>(
      `meta[${attribute}="${key}"]`,
    );
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, key);
      document.head.append(element);
    }
    element.content = content;
  }
  meta('description', value.description);
  meta('robots', value.index ? 'index,follow' : 'noindex,nofollow');
  const canonicalUrl = value.path ? site.url + value.path : null;
  document.head
    .querySelectorAll('link[rel="canonical"]')
    .forEach((link) => link.remove());
  if (canonicalUrl) {
    const link = document.createElement('link');
    link.rel = 'canonical';
    link.href = canonicalUrl;
    document.head.append(link);
  }
  const graph = document.getElementById('site-structured-data');
  graph?.remove();
  if (value.structuredData) {
    const script = document.createElement('script');
    script.id = 'site-structured-data';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(value.structuredData).replaceAll(
      '<',
      '\\u003c',
    );
    document.head.append(script);
  }
  for (const name of [
    'og:title',
    'og:description',
    'og:image',
    'og:image:alt',
    'og:url',
    'og:type',
    'og:site_name',
    'og:locale',
  ]) {
    document.head
      .querySelectorAll(`meta[property="${name}"]`)
      .forEach((tag) => tag.remove());
  }
  for (const name of [
    'twitter:card',
    'twitter:title',
    'twitter:description',
    'twitter:image',
  ]) {
    document.head
      .querySelectorAll(`meta[name="${name}"]`)
      .forEach((tag) => tag.remove());
  }
  if (value.index) {
    const image = value.image || site.url + site.image;
    meta('og:title', value.title || site.name, true);
    meta('og:description', value.description, true);
    meta('og:type', 'website', true);
    meta('og:site_name', site.name, true);
    meta('og:locale', 'id_ID', true);
    meta('og:image', image, true);
    meta('og:image:alt', 'iRent Semarang — sewa iPhone dan aksesori', true);
    if (canonicalUrl) meta('og:url', canonicalUrl, true);
    meta('twitter:card', 'summary_large_image');
    meta('twitter:title', value.title || site.name);
    meta('twitter:description', value.description);
    meta('twitter:image', image);
  }
}
