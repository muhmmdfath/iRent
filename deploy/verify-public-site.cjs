// Read-only browser and static SEO verification. No production login required.
const { chromium, expect: baseExpect } = require('../frontend/node_modules/@playwright/test');
const expect = baseExpect.configure({ timeout: 20_000 });
const { mkdirSync, readFileSync } = require('node:fs');
const path = require('node:path');
const origin = process.argv[2] || 'http://127.0.0.1:5180';
const output = path.resolve(__dirname, '../backend/storage/deployment/brand-seo-review');
async function main() {
  mkdirSync(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // No session is needed for branding and public navigation checks.
    await page.route('**/api/auth/session', (route) => route.fulfill({ status: 401, json: { message: 'Not signed in' } }));
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + '/', { waitUntil: 'networkidle' });
      await expect(page).toHaveTitle('iRent Semarang — Sewa iPhone & Aksesori');
      await expect(page.locator('.brand-logo').first()).toBeVisible();
      await expect(page.locator('.landing-cinematic img')).toBeVisible();
      expect(await page.locator('.landing-cinematic img').evaluate((element) => element.naturalWidth)).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('a[href="https://www.instagram.com/irent_semarang/"]')).toHaveCount(2);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index,follow');
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://irentsmg.tech/');
      await page.screenshot({ path: path.join(output, `home-${width}.png`), fullPage: true });
      await page.screenshot({ path: path.join(output, `home-${width}-viewport.png`) });
    }
    await page.getByRole('link', { name: 'Cari perangkat', exact: true }).click();
    await expect(page).toHaveURL(/\/catalog$/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://irentsmg.tech/catalog');
    await expect(page).toHaveTitle('Katalog Sewa iPhone & Aksesori Semarang — iRent');
    await page.goto(origin + '/login');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
    const root = path.resolve(__dirname, '../frontend/dist');
    for (const [file, canonical] of [['index.html', '/'], ['catalog.html', '/catalog'], ['terms.html', '/terms']]) {
      const html = readFileSync(path.join(root, file), 'utf8');
      expect(html).toContain(`rel="canonical" href="https://irentsmg.tech${canonical}"`);
      expect(html).toContain('<h1>');
      expect(html).toContain('application/ld+json');
      expect(html).toContain('https://www.instagram.com/irent_semarang/');
    }
    expect(readFileSync(path.join(root, 'app-shell.html'), 'utf8')).not.toContain('rel="canonical"');
    expect(readFileSync(path.join(root, 'sitemap.xml'), 'utf8')).not.toContain('/admin');
    if (origin.startsWith('https://')) {
      for (const route of ['/', '/catalog', '/terms']) {
        const response = await fetch(origin + route);
        const html = await response.text();
        expect(response.status).toBe(200);
        expect(html).toContain(`rel="canonical" href="https://irentsmg.tech${route}"`);
        expect(html).toContain('<h1>');
        expect(html).toContain('application/ld+json');
      }
      const sitemap = await fetch(origin + '/sitemap.xml');
      expect(sitemap.headers.get('content-type')).toContain('xml');
      expect(await sitemap.text()).toContain('<loc>https://irentsmg.tech/catalog</loc>');
      const robots = await fetch(origin + '/robots.txt');
      expect(robots.headers.get('content-type')).toContain('text/plain');
      expect(await robots.text()).toContain('Sitemap: https://irentsmg.tech/sitemap.xml');
      const login = await fetch(origin + '/login');
      expect(login.headers.get('x-robots-tag')).toContain('noindex');
      const missing = await fetch(origin + '/images/does-not-exist.webp');
      expect(missing.status).toBe(404);
    }
    expect(errors).toEqual([]);
    console.log(JSON.stringify({ result: 'PASS', widths: [360, 390, 768, 1440], checks: 'Brand, cinematic image, navigation, canonical, robots, private-page cleanup, static HTML and Instagram', screenshots: output }));
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
