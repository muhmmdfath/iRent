// Upload supplied QRIS using the regular authenticated admin endpoint.
// Credentials stay in an ignored private file and are never printed.
const { readFileSync } = require('node:fs');
const path = require('node:path');
async function main() {
  const [origin, credentialPath, imagePath] = process.argv.slice(2);
  const url = new URL(origin);
  if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Use HTTPS or localhost');
  const credentials = Object.fromEntries(readFileSync(credentialPath, 'utf8').trim().split(/\r?\n/).map((line) => {
    const offset = line.indexOf('=');
    return [line.slice(0, offset), line.slice(offset + 1)];
  }));
  const image = readFileSync(imagePath);
  if (image.length > 5 * 1024 * 1024) throw new Error('QRIS exceeds 5 MB');
  const type = /\.png$/i.test(imagePath) ? 'image/png' : /\.jpe?g$/i.test(imagePath) ? 'image/jpeg' : null;
  if (!type) throw new Error('Use the supplied JPG or PNG');
  const response = await fetch(url.origin + '/api/auth/login', {
    method: 'POST',
    headers: { Origin: url.origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: credentials.IRENT_ADMIN_EMAIL || credentials.IRENT_ADMIN_PHONE, password: credentials.IRENT_ADMIN_PASSWORD }),
  });
  if (!response.ok) throw new Error(`Admin login failed (${response.status}); no QRIS changed`);
  const session = await response.json();
  if (session.user.role !== 'admin') throw new Error('Admin account required');
  const cookie = response.headers.getSetCookie().map((entry) => entry.split(';')[0]).join('; ');
  const headers = { Origin: url.origin, Cookie: cookie, 'X-CSRF-Token': session.csrfToken };
  try {
    const form = new FormData();
    form.append('file', new Blob([image], { type }), path.basename(imagePath));
    const upload = await fetch(url.origin + '/api/admin/settings/qris-image', { method: 'POST', headers, body: form });
    if (!upload.ok) throw new Error(`QRIS upload failed (${upload.status})`);
    const result = await upload.json();
    const options = await fetch(url.origin + '/api/payment-options').then((value) => value.json());
    if (options.qrisImagePath !== result.path) throw new Error('QRIS setting verification failed');
    const saved = await fetch(url.origin + result.path);
    if (!saved.ok || !saved.headers.get('content-type')?.startsWith('image/')) throw new Error('QRIS image unavailable');
    console.log(JSON.stringify({ result: 'QRIS updated and publicly verified', path: result.path }));
  } finally {
    await fetch(url.origin + '/api/auth/logout', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' });
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
