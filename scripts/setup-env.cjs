const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const backendEnv = path.join(root, 'backend/.env');
if (!fs.existsSync(backendEnv)) {
  const content = fs.readFileSync(path.join(root, 'backend/.env.example'), 'utf8')
    .replace(/^CSRF_SECRET=.*$/m, `CSRF_SECRET=${crypto.randomBytes(32).toString('base64')}`)
    .replace(/^NIK_KEYS=.*$/m, `NIK_KEYS=${JSON.stringify({ v1: crypto.randomBytes(32).toString('base64') })}`)
    .replace(/^CORS_ORIGINS=.*$/m, 'CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173');
  fs.writeFileSync(backendEnv, content);
  console.log('backend/.env dibuat dengan kunci lokal acak.');
}
const frontendEnv = path.join(root, 'frontend/.env');
if (!fs.existsSync(frontendEnv)) {
  fs.copyFileSync(path.join(root, 'frontend/.env.example'), frontendEnv);
  console.log('frontend/.env dibuat.');
}
