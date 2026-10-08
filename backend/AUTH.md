# Autentikasi dan profil

## Kontrak API

Semua path memakai prefix /api. Mutasi memakai JSON dan Origin yang terdaftar di CORS_ORIGINS; endpoint upload bukti memakai multipart dengan Origin/CSRF yang sama. Setelah login/registrasi, sertakan cookie sesi dan X-CSRF-Token dari response. Axios memakai withCredentials: true; fetch memakai credentials: 'include'. Setelah reload, ambil CSRF dari GET /auth/session. Token sesi tidak dikirim dalam JSON atau disimpan di localStorage.

| Method/path                        | Akses dan body                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| POST /auth/register                | Publik: name, email dan/atau phone, password; selalu customer                                                                       |
| POST /auth/login                   | Publik: identity (email/HP), password                                                                                               |
| GET /auth/session                  | Pengguna aktif: user dan csrfToken                                                                                                  |
| POST /auth/logout                  | Pengguna aktif + CSRF; 204 dan hapus sesi/cookie                                                                                    |
| GET /customer/profile              | Customer; profil atau null, tanpa NIK                                                                                               |
| PUT /customer/profile              | Customer + CSRF: fullName, address, phoneActive; nik 16 digit wajib pada profil pertama; phoneAlt, instagram, emailContact opsional |
| POST /admin/accounts               | Admin + CSRF: body seperti register; membuat admin tanpa mengganti sesi pembuat                                                     |
| GET /admin/customers/:id           | Admin; detail profil dengan NIK, akses NIK diaudit                                                                                  |
| POST /admin/customers/:id/password | Admin + CSRF: password baru; 204 dan seluruh sesi pelanggan dicabut                                                                 |

Nama/alamat tidak boleh kosong setelah trim. HP dinormalisasi ke E.164; 08…/62… menjadi +62…. Email dinormalisasi lowercase. Password baru 12–128 karakter. Edit profil dapat mempertahankan NIK tanpa mengirim ulang; completedAt berasal dari server. Unknown fields, termasuk role/userId/completedAt, ditolak. Response memakai field terpilih dan Cache-Control: no-store.

## Setup kunci dan admin pertama

Salin .env.example ke .env. Jalankan berikut **dua kali** untuk mendapatkan kunci independen, lalu isi CSRF_SECRET dan kunci v1 dalam NIK_KEYS:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Format environment:

```dotenv
CSRF_SECRET=<kunci pertama>
NIK_KEYS={"v1":"<kunci kedua>"}
NIK_ACTIVE_KEY=v1
```

Placeholder bukan nilai valid. Server menolak kunci tidak valid. Simpan keyring dalam backup aman terpisah. Rotasi dengan menambahkan kunci baru ke NIK_KEYS dan mengganti NIK_ACTIVE_KEY; pertahankan kunci lama untuk ciphertext lama. Enkripsi baru memakai key aktif. Jangan menghapus key lama sebelum data lama dimigrasikan.

Setelah migrasi/build, buat admin pertama melalui environment lokal, tanpa password di argumen command:

```powershell
$env:IRENT_ADMIN_NAME = 'Admin iRent'
$env:IRENT_ADMIN_EMAIL = 'admin@example.com'
$adminPassword = Read-Host 'Password admin (12–128 karakter)' -AsSecureString
$env:IRENT_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $adminPassword).Password
try { npm run admin:create }
finally { Remove-Item Env:IRENT_ADMIN_PASSWORD }
```

DATABASE_URL dibaca dari .env; email contoh harus diganti. Nomor HP dapat memakai IRENT_ADMIN_PHONE. CLI mengambil advisory lock dan menolak bila sudah ada admin. Tidak tersedia endpoint bootstrap publik atau password default.

## Mekanisme dan deployment

Sesi absolut delapan jam, token acak 256-bit; hanya hash SHA-256 token disimpan di PostgreSQL. Cookie HttpOnly/SameSite=Lax; produksi memakai Secure dan prefix __Host-. Logout mencabut sesi; reset password menaikkan authVersion dan menghapus seluruh sesi pelanggan. Service mutasi memeriksa ulang sesi/role di bawah user lock sehingga reset tidak dilewati request yang sebelumnya sudah melewati guard.

Password memakai scrypt dengan salt acak (N=32768, r=8, p=3). NIK memakai AES-256-GCM, nonce acak, key ID, dan AAD user ID; ciphertext tidak dapat dipindah antaruser. Audit menyimpan action/metadata field, tanpa password, token, atau NIK.

Login dibatasi 30/IP dan 10/identity per 15 menit; registrasi lima/IP per jam. Counter PostgreSQL atomic berlaku lintas proses. Guard memakai IP koneksi dan tidak mempercayai X-Forwarded-For. Deployment di balik proxy perlu konfigurasi trust proxy sesuai topologi sebelum menerima trafik nyata. Worker pembersihan sesi/bucket kedaluwarsa belum dibuat; expiry sudah ditegakkan pada setiap request.

Frontend/API perlu berada pada site yang sama agar cookie SameSite=Lax berfungsi, misalnya app.example.com/api.example.com atau reverse proxy /api. Origin produksi wajib HTTPS dan masuk allowlist. Guard menerima multipart hanya pada endpoint upload bukti yang ditandai khusus, tetap dengan Origin/CSRF; endpoint lain menerima JSON.

Tes database membutuhkan database kosong khusus pengujian untuk bootstrap admin; fixture auth dibersihkan setelah tes. Cakupan: role escalation, origin/CSRF, privasi/enkripsi, bootstrap bersamaan, reset/revocation, expiry, throttle concurrent, dan HTTP 429.

Referensi: [Node.js 24 crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html), [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
