## Perapihan panduan admin (22 Oktober 2026)

- [x] Audit halaman lama dan referensi Shopify Help/Stripe Docs; pola kartu paragraf diganti navigasi topik dan satu artikel dengan langkah bernomor.
- [x] Sembilan topik dalam tiga kelompok, judul 24/22 px dan isi sekitar 12 px, satu catatan penting, aksi menuju halaman operasional serta navigasi sebelumnya/selanjutnya.
- [x] Dropdown topik di HP, query URL yang bertahan saat reload/history, keyboard, ikon chevron, tombol pink/hover hitam dan footer ringkas khusus panduan.
- [x] Build/typecheck/lint/format dan enam tes browser pada 360/390/768/1024/1440 px lulus. Domain online diperiksa dengan sesi admin simulasi; API/database tetap sehat. Tidak mengubah aturan bisnis atau data produksi.
- [x] Diterapkan pada `https://irentsmg.tech/admin/guide`. [Acuan desain dan verifikasi](docs/frontend/admin-guide-redesign.md), [desktop](docs/frontend/admin-guide-1440.png), [mobile](docs/frontend/admin-guide-390.png).
- Belum otomatis commit/push.

## Ganti password sendiri (22 Oktober 2026)

- [x] Admin dan pelanggan: Akun saya → Keamanan akun → Ganti password, modal ringkas dengan password lama, password baru 8–128 karakter, konfirmasi dan ikon mata.
- [x] `POST /api/auth/password`: otorisasi/CSRF, verifikasi password lama, batas lima percobaan per 15 menit, password baru berbeda, dan user lock untuk perubahan bersamaan.
- [x] Keberhasilan mencabut seluruh sesi/langganan push, menghapus cookie dan cache privat, lalu kembali ke login. Audit tidak menyimpan password/hash; salah password lama tidak mengakhiri sesi.
- [x] Build/typecheck/lint, 27 tes unit backend, tiga tes PostgreSQL/HTTP pada database sementara, serta 29 tes frontend lulus. Browser live memeriksa modal desktop/mobile, ikon mata, Escape, pengosongan draft dan akses login/logout.
- [x] Diterapkan pada `https://irentsmg.tech`; tidak ada migrasi schema dan password admin produksi tidak diubah oleh pengujian. Database QA sudah dihapus.
- Kode dan dokumentasi masih working tree; belum otomatis commit/push.

## Deployment pertama dan password minimum (22 Oktober 2026)

- [x] Password baru 8–128 karakter: registrasi, reset pelanggan, akun admin dan bootstrap admin; form, OpenAPI serta PRD disamakan.
- [x] Deployment satu VPS untuk `https://irentsmg.tech`: build, migrasi database kosong, settings, admin pertama, HTTPS dan storage persisten.
- [x] Worker aktif, IP pelanggan melalui satu proxy, database privat/port API loopback, firewall dan restart policy.
- [x] Backup harian dan satu salinan di laptop; checksum serta restore database sementara lulus.
- [x] 27 tes backend, 25 tes frontend, serta pemeriksaan browser live login/logout, cookie, akses privat, mobile dan aset PWA lulus.
- [ ] Penyalinan backup eksternal berkala/retensi, data usaha/item/QRIS asli, uji beban dan Web Push pada HP nyata.
- Detail dan batas verifikasi: [laporan deployment](docs/deployment/2026-10-22-deployment.md). Sumber deployment mencakup perubahan working tree; belum otomatis commit/push.

## Komposisi detail inventaris (18 Oktober 2026)

- [x] Tombol kembali Inventaris dihapus dari detail; navigasi sidebar tetap tersedia.
- [x] Kode unit 14-15px, badge 10px, metadata 11px; badge status fisik memakai warna semantik yang ringan.
- [x] Aksi foto/katalog dan aktif/perawatan unit dipindahkan ke menu titik tiga; aksi penyelesaian perawatan/persiapan tetap terlihat sesuai status.
- [x] Menu mendukung klik luar/Escape, kondisi disabled dan nama aksesibel; semua guard alokasi/pengembalian dan persiapan dipertahankan.
- Verifikasi: typecheck/lint, 7 browser tests dan 11 inventory tests lulus. Detail asli dicek pada 390/1440px tanpa overflow; screenshot admin-inventory-detail-composition-*.

## Rombak seluruh halaman manajemen admin (18 Oktober 2026)

- [x] Jadwal unit: timeline sewa/buffer, filter rentang/model dan kondisi fisik.
- [x] Perpanjangan/refund: antrean status, identitas, nominal dan tindakan detail.
- [x] Risiko: penyebab risiko dan tindak lanjut delivery dipisahkan.
- [x] Data penyewa/admin: direktori, pencarian, detail dan tambah admin modal.
- [x] Laporan: ringkasan kas, mutasi, transaksi berhasil dan item populer.
- [x] Zona ongkir: daftar tarif/status, pencarian dan modal tambah/ubah.
- [x] Notifikasi PWA: kesiapan perangkat dan riwayat pengiriman.
- [x] Pengaturan: kelompok aturan sewa dan QRIS.
- [x] Verifikasi behavior, responsive dan screenshot tiap halaman.

- Verifikasi: build/typecheck dan lint lulus; 6 browser tests mencakup sepuluh halaman pada 390/1440px beserta filter, modal dan penyimpanan; 5 management tests serta 13 tests perpanjangan/refund lulus. Pengecekan data lokal dan 20 screenshot tidak menemukan overflow.
- Referensi per halaman: [docs/frontend/admin-management-references.md](docs/frontend/admin-management-references.md).

## Rombak inventaris dan modal tambah (18 Oktober 2026)

- [x] Kartu foto perangkat, tarif 6/12/24 jam, badge aktif dan stok fisik; kategori cepat, pencarian/status server dan pagination dipertahankan.
- [x] Ringkasan membedakan total hasil pencarian dari hitungan unit pada halaman yang tampil. Stok fisik tidak diklaim sebagai ketersediaan tanggal.
- [x] Tambah model dan unit memakai native dialog; Escape/klik luar, focus trap dan pengembalian fokus, scroll lock, serta penguncian tutup selama simpan.
- [x] Pemeriksaan sebelum submit, validasi nominal BigInt, kode unit unik dan guard hasil simpan tidak pasti tetap berlaku. URL /admin/inventory/new membuka modal di atas daftar.
- [x] Ukuran teks, kartu detail, hover tab, mobile dan kondisi loading/empty/error disesuaikan dengan palet pengguna.
- Referensi: [Square Item Library](https://squareup.com/help/us/en/article/8335-create-and-edit-items), [Shopify product search/filter](https://help.shopify.com/en/manual/products/searching-filtering).
- Verifikasi: 12 browser scenarios (daftar/detail, maintenance, foto, modal, keyboard, pending save, 360-1440px) dan 11 inventory tests lulus. Build/typecheck dan lint diperiksa. Screenshot docs/frontend/admin-inventory-redesign-* dan admin-inventory-add-modal-*.

## Rombak booking dan pembayaran admin (18 Oktober 2026)

- [x] Daftar transaksi dengan kolom penyewa/perangkat, jadwal, badge status, total awal dan akses detail yang ringkas; berubah menjadi kartu pada ponsel.
- [x] Filter cepat status, pencarian/sort server, reset dan pagination tetap memakai query URL. Tidak menampilkan total global dari hitungan satu halaman.
- [x] Banner antrean bukti memakai jumlah aktual API tasks; daftar bukti mendesak mencakup pembayaran awal, pelunasan dan perpanjangan.
- [x] Detail menempatkan identitas/perangkat berdampingan, bukti sebelum operasional, navigasi bagian dan ringkasan keuangan sticky desktop. Validasi uang aktual, konfirmasi, idempotency dan kontrol akses dipertahankan.
- [x] Palet putih, hitam dan #FF4081, Poppins, teks data 11-13px, judul bagian 14-16px; loading, empty dan error punya pemulihan.
- Referensi: [Shopify order filters](https://help.shopify.com/en/manual/fulfillment/managing-orders/viewing-orders/filtering-orders), [Stripe payment tracking](https://stripe.com/resources/more/how-to-track-payments-in-real-time-and-resolve-issues-faster).
- Verifikasi: build/typecheck dan lint lulus; 7 browser tests (360/390/768/1024/1440px, filter/pencarian/antrean/error/empty/verifikasi) dan 9 tests aturan pembayaran lulus. Screenshot data lokal tersedia di docs/frontend/admin-bookings-redesign-* dan admin-booking-detail-redesign-*.

## Perapian login dan daftar (18 Oktober 2026)

- [x] Kartu form putih, panel brand pastel dengan ilustrasi perangkat berbasis CSS, dan spacing konsisten.
- [x] Input, focus, helper/error, tombol utama dan link pink mengikuti palet/ukuran teks pilihan pengguna.
- [x] Responsif; ilustrasi disembunyikan pada ponsel agar form tetap menjadi fokus.
- Verifikasi: build/typecheck dan lint komponen lulus; 6 browser tests pada 360/768/1440px memeriksa validasi, toggle password, link teks, serta overflow.

## Perapian halaman akun (18 Oktober 2026)

- [x] Ringkasan identitas dan checklist kelengkapan profil; status lengkap tidak diklaim sebagai identitas terverifikasi.
- [x] Kartu informasi login, profil/alamat, kontak tambahan opsional, aktivitas sewa, serta ketentuan/bantuan.
- [x] Data berasal dari sesi dan API profil; tidak ada field wajib baru, migrasi, atau perubahan data pelanggan.
- [x] Loading/error/empty handling; halaman admin tetap memakai informasi akun tanpa meminta profil pelanggan.
- Referensi: Airbnb account settings, Shopify customer accounts dan Grover account management.
- Verifikasi: build/typecheck dan lint lulus; 4 browser tests untuk responsive links, profil kosong/error, serta isolasi admin. Data asli dicek pada 390/768/1440px tanpa overflow.

## Halaman Booking saya (17 Oktober 2026)

- [x] Kartu booking konsisten dengan beranda, shared styles diekstrak ke recent-booking-cards.css.
- [x] Filter status server dan pagination dengan query URL, termasuk empty/loading/error states.
- [x] Grid dua kolom desktop, satu kolom ponsel; badge status, foto, jadwal tiap booking dan CTA sesuai status.
- Verifikasi: typecheck, 2 browser tests filter/payment link/empty reset/overflow, dan pengecekan data asli desktop/ponsel lulus.
- Referensi: Airbnb reservations dan Shopify customer accounts.

## Toast dan kotak masuk notifikasi (17 Oktober 2026)

- [x] Toast pojok kanan bawah untuk respons aksi sukses/gagal; tersedia juga varian info/warning, dismiss dan auto-close.
- [x] Lonceng navbar pelanggan/admin, badge unread, panel berhalaman, tautan booking dan tandai semua dibaca.
- [x] GET /api/notifications mengambil event bisnis dari outbox dengan batas kepemilikan; pelanggan hanya melihat booking sendiri. Payload privat tidak dikirim.
- [x] POST /api/notifications/:id/read dan /read-all menyimpan read marker per akun, idempotent. Migration 20261017140000_notification_inbox_reads diterapkan ke PostgreSQL lokal.
- [x] Polling 30 detik dan invalidasi setelah aksi; cache dan toast dibersihkan saat sesi berganti.
- Verifikasi: build frontend/backend; browser desktop/ponsel untuk inbox, mark-read, outside click dan toast sukses/gagal. API data asli: isolasi booking, penolakan mark-read milik pengguna lain (404), read marker persisten dan idempotent.

## Validasi stok otomatis pada booking (17 Oktober 2026)

- [x] Periksa unit tersedia per item/jadwal melalui API availability, termasuk item yang belum dipilih.
- [x] Tombol plus dan input manual dibatasi stok terbaru; item kosong/hasil belum diketahui tidak bisa ditambahkan.
- [x] Jadwal berubah memicu query baru; stok kurang memberi peringatan dan memblokir pembuatan booking, tanpa menghapus pilihan diam-diam.
- [x] Refresh stok 30 detik; server tetap memeriksa ulang saat transaksi booking.
- Verifikasi: typecheck dan browser test batas plus/manual, stok kosong, serta pergantian jadwal lulus.

## Form booking - fase 3 (17 Oktober 2026)

- [x] Empat bagian bernomor dengan pintasan: perangkat, jadwal, pengambilan, persetujuan.
- [x] Perangkat memakai foto/quantity dan tombol hapus ikon. Panel ringkasan visual menampilkan perangkat, jadwal, dan biaya terverifikasi.
- [x] Cek biaya dipindahkan ke panel ringkasan dengan submit form terkait. Validasi, fingerprint preview dan idempotency booking dipertahankan.
- [x] Perkiraan waktu kembali otomatis; panel sticky desktop dan satu kolom ponsel. Label/isian tetap mengikuti tipografi global.
- Referensi: Baymard checkout summaries dan Sharetribe calendar booking.
- Verifikasi browser dengan data asli: cek harga/ketersediaan pada 390/768/1440px lulus tanpa overflow. Typecheck lulus.

## Detail perangkat - fase 2 (17 Oktober 2026)

- [x] Foto utama lega, panel pemesanan sticky desktop, dan isi paket terpisah.
- [x] Pilihan 6/12/24 jam memperbarui harga serta diteruskan ke form booking.
- [x] Layout ponsel menempatkan foto, panel tarif, lalu kelengkapan paket.
- Verifikasi: typecheck lulus; browser data asli pada 390/768/1440px, pilihan durasi dan tautan booking tanpa overflow.
- Referensi: Lensrentals Canon EOS R5 dan ShareGrid Sony FX3; palet iRent tetap berlaku.

## Perapian kartu katalog beranda (17 Oktober 2026)

- Foto sebagai satu area aksi, ikon tambah ringkas, badge ketersediaan kecil dan jarak kartu diperlebar.
- Error ketersediaan disatukan di atas grid; tidak lagi ada pesan dan retry besar per kartu.
- Harga mengikuti durasi filter. Pemilihan tanggal mulai memperhitungkan lead time 2 jam dan batas bulan pemesanan.
- Referensi arah: Grover smartphone catalog dan Lensrentals catalog. Palet iRent dipertahankan.
- Preview data asli: docs/frontend/customer-catalog-refined-desktop.png dan customer-catalog-refined-mobile.png.

## Filter ketersediaan beranda (17 Oktober 2026)

- [x] Ikon kalender membuka pemilih rentang tanggal; klik mulai lalu akhir langsung mengecek. Awal 10.00 WIB, tanggal sama 6 jam, beda tanggal kelipatan 24 jam maksimal 7 hari; jam dapat diubah saat booking.
- [x] Kartu perangkat memeriksa ketersediaan melalui API booking per item, termasuk buffer/alokasi yang sudah diterapkan backend.
- [x] Loading, error/retry, jumlah unit tersedia, tidak tersedia, dan reset filter.
- [x] Jadwal pilihan diteruskan ke form booking; cek bukan reservasi dan tetap diperiksa ulang sebelum booking.

## Pembaruan beranda pelanggan - fase 1 (17 Oktober 2026)

- [x] Layout konten utama dan panel informasi sewa, terinspirasi pembagian konten Peduly.
- [x] Pintasan kategori, enam perangkat dari katalog asli, serta booking terbaru.
- [x] Pembayaran tertunda diprioritaskan, profil dan panduan tetap tersedia; panel berpindah pada layar kecil.
- Verifikasi: build/typecheck dan lint lulus; 3 browser tests lulus (360/1440px, pembayaran, kategori, empty state, retry katalog). Preview browser memakai fixture pengujian.
- [x] Fase 2: detail perangkat.
- [x] Fase 3: form booking dan ringkasan.
- [ ] Fase 4: instruksi pembayaran dan status verifikasi.

# Implementasi iRent

## Beranda admin operasional - 15 Oktober 2026

- [x] Empat indikator aktual: booking terjadwal hari ini, booking berjalan, unit siap fisik dan unit terlambat.
- [x] Jadwal WIB dengan tab pengambilan/pengembalian, navigasi keyboard dan akses detail booking.
- [x] Satu antrean tugas berdasarkan tenggat; hapus pengulangan pembayaran, pertahankan filter/pagination, pengingat suara dan pengakuan versi lokal.
- [x] Distribusi status booking dan lima booking terbaru dari API, lengkap dengan pelanggan, status, jadwal dan nominal string rupiah.
- [x] Refresh, waktu pembaruan, loading/error/empty state; angka gagal tidak ditampilkan sebagai nol. Footer khusus dashboard dipadatkan.
- [x] Preview API nyata pada 360/390/768/1024/1440px tanpa overflow atau error JavaScript.
- [x] Build/TypeScript/lint lulus, 81 tes frontend dan 13 tes browser terkait lulus. Lima skenario dashboard diuji ulang setelah fixture navigasi dilengkapi.

Tidak ada perubahan backend, migrasi atau data simulasi.

- [x] Kembalikan ikon fungsional untuk mundur/maju/logout dengan label aksesibel dan tooltip. Panah dekoratif pada CTA tetap dihilangkan. Wordmark footer memakai lapisan blur progresif yang tidak menutupi tautan.

- [x] Hover tombol hitam/putih/abu memakai isian pink solid yang lebih pekat dan teks gelap; kondisi normal, logo, sidebar dan tombol disabled tetap netral.

## Penyesuaian footer dan Poppins

- [x] Semua font antarmuka memakai Poppins, termasuk shortcut, logo dan wordmark; bobot 400/500/600/700 dimuat lokal.
- [x] Panel footer diturunkan 40px di desktop, 32px di tablet dan 24px di HP, tanpa menaikkan kembali wordmark.

## Koreksi warna kontrol dan footer - 15 Oktober 2026

- [x] Tombol normal/hover/fokus, logo dan sidebar kembali netral hitam-putih/abu; pink hanya aksen dekoratif. Logo dikecualikan dari styling tautan aksi.
- [x] Wordmark footer diposisikan pada tepi bawah dengan bagian bawah terpotong, sehingga hanya sekitar setengah bagian atas terlihat.
- [x] Preview desktop/mobile memastikan logo transparan, menu aktif abu dan tombol netral tanpa overflow.

## Pink pastel dan motion beranda - 15 Oktober 2026

- [x] Palet putih dominan dengan teks hitam dan aksen pink pastel pada navigasi, filter, foto produk dan tombol.
- [x] Navbar fixed dan transparan dengan backdrop blur untuk beranda serta workspace desktop/mobile.
- [x] Hero dengan perangkat mengambang, parallax ringan, reveal berbasis viewport dan indikator progres scroll.
- [x] Pusatkan judul/alur tiga langkah, tambahkan CTA nyata, dan hormati prefers-reduced-motion.
- [x] Perjelas wordmark footer dan tampilkan tautan aksi sebagai tombol; navigasi tetap memakai anchor agar keyboard/open-tab bekerja.
- [x] Verifikasi build/lint, 78 tes frontend dan 48 tes browser; lima tes khusus API nyata dilewati pada konfigurasi default. Kasus baru memeriksa fixed navbar, blur, scroll reveal/progress, teks alur terpusat dan reduced motion. Screenshot API nyata disertakan.

## PostgreSQL lokal - 15 Oktober 2026

- [x] Backup database Docker dan environment sebelum pemindahan.
- [x] Restore database ke PostgreSQL lokal :5432 dengan role aplikasi khusus tanpa superuser.
- [x] Bandingkan jumlah dan hash seluruh baris pada 31 tabel; foto/bukti dan kunci enkripsi tetap.
- [x] Default setup lokal tanpa Docker, pemeriksaan koneksi, dan dokumentasi.
- [x] Verifikasi API, login admin/pelanggan, katalog, tujuh gambar dan migrasi dengan Docker mati. Lima migrasi sudah terpasang tanpa pending migration.

## Perapihan bertahap 15 Oktober 2026

- [x] Footer bersama sesuai referensi baru: panel membulat, tautan halaman nyata, copyright dan wordmark samar. Preview browser pada halaman utama/katalog di lima ukuran layar lulus tanpa overflow.

- [x] Ganti sidebar dan navbar publik/pelanggan/admin mengikuti referensi baru.
- [x] Perbarui kartu katalog, kategori dan kontrol durasi.
- [x] Sambungkan pencarian dan filter kategori ke API publik tanpa membuka item nonaktif.
- [x] Hentikan acuan DESIGN.md dan STITCH_REDESIGN.md; seluruh ekspor Stitch dihapus dari repositori.
- [x] Verifikasi tampilan desktop/mobile, navigasi, build dan regresi terkait.

Verifikasi: 78 tes frontend lulus; 43 skenario browser unik tercakup (42 lulus pada regresi awal, kasus pagination inventaris diperbaiki dan diverifikasi ulang dalam 12 tes inventaris/workspace yang lulus). Lima tes API nyata khusus dilewati pada suite simulasi. Delapan tes PostgreSQL inventaris lulus, termasuk pencarian publik case-insensitive, kategori dan penyembunyian item nonaktif. Preview API nyata memeriksa pencarian katalog dan sidebar admin; screenshot tersedia di docs/frontend/. Tidak ada migrasi atau perubahan data dummy.

Catatan desain pada bagian historis di bawah menggambarkan tahap sebelumnya.

## Status terkini - 12 Oktober 2026

UI phase 1 pelanggan/admin dan integrasi API sudah tersedia, termasuk perpanjangan, refund, operasional per unit, inventaris, pengelolaan dan kontrol notifikasi. Bagian tahap di bawah menyimpan hasil pada waktu masing-masing tahap; kalimat "berikutnya" di sana bukan daftar pekerjaan terkini.

Yang belum selesai: pengujian Web Push pada perangkat fisik dengan HTTPS/VAPID, acceptance operasional toko dan deployment produksi. WhatsApp tetap ditunda. Pengujian browser dengan API simulasi, audit halaman demo API nyata dan tes PostgreSQL memiliki cakupan berbeda; jangan menyamakan audit tampilan dengan keberhasilan semua mutasi end-to-end.

### Perapihan modul dan dokumentasi

- [x] Pisahkan daftar perpanjangan bersama dari halaman/form yang dimuat dinamis.
- [x] Selaraskan status README, PWA dan checklist dengan cakupan terbaru.
- [x] Verifikasi bundle, TypeScript, lint, tes UI dan navigasi browser terkait.

Verifikasi refactor 12 Oktober 2026: build/typecheck/lint dan format file yang berubah lulus; 76 tes Vitest/MSW serta 12 tes Chromium pada bundle produksi lulus. Browser menguji katalog/booking/pembayaran pelanggan, review receipt admin dan navigasi/reload detail perpanjangan. Warning import dinamis tidak efektif sudah hilang; bundle utama turun dari 405.04 KB menjadi 385.03 KB (sebelum gzip). Backend, schema dan aturan bisnis tidak berubah.

## Penyelesaian frontend menyeluruh — permintaan 11 Oktober 2026

- [x] Perpanjangan pelanggan/admin: proposal, quotation, consent, upload, keputusan dan rekonsiliasi.
- [x] Laporan pengembalian pelanggan dan tindakan lanjutan admin: kehilangan, penggantian, no-show, koreksi pengembalian/receipt.
- [x] Kalender, antrean seluruh tugas/risiko, data pelanggan/admin dan reset password.
- [x] Pengaturan, QRIS, zona ongkir, laporan dan ekspor Excel.
- [x] Aktivasi push/suara, pengakuan tugas, riwayat notifikasi dan lifecycle sesi.
- [x] Audit halaman publik/pelanggan/admin, aksesibilitas dan responsivitas.
- [x] Seed dummy berulang dengan foto item dan skenario transaksi untuk seluruh UI.
- [x] Verifikasi frontend/backend, dokumentasi demo, commit dan push main.

Verifikasi akhir 12 Oktober 2026: build, TypeScript dan lint frontend/backend lulus; 76 tes frontend, 26 tes backend tanpa DB, 188 tes PostgreSQL/HTTP pada database baru, serta 36 tes browser API simulasi lulus. Lima tes browser berkonfigurasi khusus dilewati pada regresi default; audit demo API nyata dijalankan terpisah dan lulus (88 kunjungan halaman pada viewport 360-1440 px). Screenshot desktop/mobile dan petunjuk seed disertakan. Database demo berisi 7 model bergambar, 56 unit, 18 booking, 4 perpanjangan dan 3 refund; 17 entri skenario tercatat. Tidak ada migrasi baru. Web Push pada perangkat fisik masih memerlukan HTTPS/VAPID dan uji perangkat; QRIS resmi disediakan toko.

PRD menjadi acuan fungsi; arah visual mengikuti pilihan pengguna dan UI aplikasi saat ini. Backend/data dikerjakan sebelum UI. Checklist ini adalah satu tempat pelacakan implementasi, bukan pengganti 65 skenario PRD.

## Tahap 1 — fondasi backend dan struktur data

- [x] NestJS/Express, TypeScript strict, konfigurasi environment, validasi request, health API.
- [x] Schema Prisma seluruh entitas PRD dan migrasi PostgreSQL awal.
- [x] Constraint, indeks, timestamp WIB, dan rupiah tanpa kehilangan presisi.
- [x] Pengujian fondasi, validasi schema, build, lint, dan pemeriksaan migrasi.
- [x] Dokumentasi setup dan batas fitur yang tersedia.

Verifikasi 8 Oktober 2026: build/typecheck/lint/format dan tes fondasi lulus; migrasi diterapkan dari database kosong PostgreSQL 17.11, Prisma diff tanpa drift, seed berulang mempertahankan perubahan settings, serta tes constraint/riwayat/WIB/BIGINT dan health API lulus. Audit npm menunjukkan nol kerentanan. Ini belum mencakup tes konkurensi booking atau seluruh skenario PRD.

## Tahap 2 — fitur backend

- [x] Autentikasi iRent, profil/NIK terenkripsi, akses pelanggan/admin dan pembuatan admin pertama.
- [x] Settings, katalog/unit, zona ongkir, pricing dan snapshot.
- [x] Booking/alokasi atomik, lock pelanggan/unit, FCFS dan idempotensi.
- [x] Upload bukti privat, receipt awal/pelunasan, verifikasi/approval, rekonsiliasi untuk refund dan expiry booking.
- [x] Pembatalan booking penuh sebelum serah terima, kebijakan refund snapshot, approval/penolakan dan pencatatan transfer manual privat.
- [x] No-show pickup/delivery, verifikasi kegagalan pelanggan, pengecualian keterlambatan toko dan antrean tindak lanjut admin.
- [x] Pengajuan/perpanjangan per unit, quotation ongkir, hold, pembayaran/approval atomik, expiry, refund dan koreksi denda akibat keterlambatan admin.
- [x] Koreksi receipt masuk: reversal/pengganti immutable, audit, saldo/refund dan pelunasan scope; prosedur disetujui pengguna.
- [x] Serah terima/pelunasan admin, pengembalian per unit, persiapan/perawatan satu jam, dan denda keterlambatan/kerusakan final.
- [x] Kehilangan/kompensasi, penggantian dan tindak lanjut risiko booking mendatang.
- [x] Outbox notifikasi, scheduler deadline, deduplikasi, retry dan recovery lease PostgreSQL.
- [x] Backend Web Push/VAPID dan aset PWA admin; integrasi UI/perangkat nyata mengikuti tahap 3.
- [ ] WhatsApp ditunda dari phase 1; provider/akun/template/penerima diselesaikan saat dilanjutkan.
- [x] Laporan kas harian/bulanan dan Excel dengan precision/correction trail.
- [x] Upload/serving foto item dan QRIS tersanitasi, storage publik terpisah dari bukti privat.
- [x] Daftar pelanggan/admin/refund/perpanjangan, antrean pekerjaan dari state bisnis dan kalender per unit.
- [x] Koreksi pengembalian terverifikasi, debit/credit adjustment, audit dan snapshot pengecualian.
- [x] Aturan backend skenario PRD diuji dengan PostgreSQL/HTTP/otorisasi; matriks dan batas integrasi di backend/ACCEPTANCE.md.

Auth sudah diverifikasi melalui HTTP dan PostgreSQL: registrasi/login/logout, role escalation, CSRF/origin, NIK privat, field profil wajib/opsional, bootstrap admin bersamaan, reset semua sesi termasuk konteks request lama, expiry/nonaktif, serta throttle concurrent/HTTP 429. Detail setup dan batas deployment di [backend/AUTH.md](backend/AUTH.md).

Katalog/settings/pricing sudah diverifikasi: kode aksesori global bersamaan, counter tidak berubah pada quantity invalid, otorisasi admin, cache lintas instance, perlindungan alokasi, snapshot tarif booking, perawatan/persiapan, jadwal WIB, tarif 6/12/24/48/168, ongkir sekali, dan DP flat/wajib lunas. Kontrak di [backend/INVENTORY_PRICING.md](backend/INVENTORY_PRICING.md). Quote tidak menahan stok atau membuktikan ketersediaan kalender. Upload media katalog dan worker notifikasi masih belum tersedia.

Booking/alokasi sudah diverifikasi di PostgreSQL: perebutan unit terakhir, batas satu iPhone lintas item, idempotensi concurrent dan normalisasi payload, rollback pesanan beberapa item, buffer tepat satu jam, deadline inklusif, hold kedaluwarsa tanpa menunggu worker, perlindungan pending verifikasi/perpanjangan, keterlambatan/persiapan, waktu setelah lock, retry lock timeout nyata, counter harian dan otorisasi HTTP. Kontrak serta batas tahap di [backend/BOOKINGS.md](backend/BOOKINGS.md). Pengiriman outbox masih tahap berikutnya.

Verifikasi tahap booking 8 Oktober 2026: build, typecheck, lint, format, 13 tes tanpa database, dan suite PostgreSQL dengan 50 tes lulus. Pengujian lock timeout nyata berhasil retry tanpa duplikasi booking/outbox. Ini belum berarti seluruh 65 skenario aplikasi PRD selesai.

Pembayaran/expiry tersedia: multipart JPG/PNG/PDF privat, otorisasi download, deduplikasi proof/receipt, deadline upload/konfirmasi, dana kurang/lebih, aplikasi DP/pelunasan, ledger dan penutupan kewajiban, refund requested untuk dana gagal/berlebih, serta worker expiry tiap menit. Kontrak/configuration dan batas tahap di [backend/PAYMENTS.md](backend/PAYMENTS.md). Approval dan transfer refund tersedia melalui [backend/REFUNDS.md](backend/REFUNDS.md); event notifikasi baru tersimpan, belum dikirim.

Verifikasi tahap pembayaran 8 Oktober 2026: build/typecheck/lint/format, 13 tes tanpa DB dan 73 tes PostgreSQL lulus. Cakupan tambahan mencakup HTTP multipart/download privat, file invalid/oversize, throttle 429, upload terlambat setelah penyimpanan/pencatatan, idempotensi file, reviewer dan worker bersamaan, bank reference lintas pelanggan, dana kurang/lebih/lunas, kegagalan persetujuan yang tetap mencatat uang, rekonsiliasi, serta isolasi kegagalan batch expiry. Schema/migrasi tidak berubah pada tahap ini.

Pembatalan/refund manual tersedia: seluruh booking sebelum serah terima, snapshot cutoff dan kategori dari applied funds, adjustment tanpa piutang fiktif, rekening penerima, review admin, transfer privat dan pencatatan uang keluar atomik. Pembulatan sekali pada total BIGINT, dana pelunasan sebagian/kelebihan dipisahkan, dan bukti pending dapat direkonsiliasi tanpa mengaktifkan booking kembali. Kontrak di [backend/REFUNDS.md](backend/REFUNDS.md). No-show tersedia melalui [backend/NO_SHOW.md](backend/NO_SHOW.md).

Verifikasi tahap pembatalan/refund 8 Oktober 2026: build/typecheck/lint/format, 15 tes tanpa DB dan 90 tes PostgreSQL lulus. Cakupan baru meliputi batas tepat 48 jam, DP menjadi lunas, booking kecil/rounding, partial settlement/kelebihan, pembatalan toko, larangan batal setelah handover, otorisasi/bukti privat HTTP, idempotensi, reviewer/transfer bersamaan, sumber dana yang bersaing, bank reference lintas pelanggan, rekonsiliasi bukti booking batal, dan refund expiry. Schema/migrasi tidak berubah.

No-show tersedia: hanya booking dikonfirmasi sebelum serah terima, deadline snapshot inklusif, penahanan DP aktual, refund sisa tanpa piutang fiktif, delivery wajib bukti admin dan pengecualian keterlambatan toko. Worker setiap menit dengan batch pembatalan/tindak lanjut terpisah, audit/outbox terdeduplikasi, dan isolasi kegagalan per booking. Kontrak/configuration di [backend/NO_SHOW.md](backend/NO_SHOW.md). API serah terima tersedia melalui [backend/OPERATIONS.md](backend/OPERATIONS.md). Backend pengirim PWA kini tersedia; WhatsApp ditunda.

Verifikasi tahap no-show 9 Oktober 2026: build/typecheck/lint/format, 16 tes tanpa DB dan 107 tes PostgreSQL lulus. Tambahan mencakup deadline tepat tiga jam, refund penuh di atas DP, booking kecil, pelunasan sebagian/kelebihan termasuk refund terdahulu, rekonsiliasi settlement pending setelah penutupan, delivery tanpa bukti, keterlambatan toko, role/CSRF/idempotensi, worker bersamaan, benturan dengan transaksi fixture serah terima, kemajuan batch tindak lanjut dan isolasi kegagalan. Schema/migrasi tidak berubah.

Serah terima/pengembalian tersedia: pelunasan admin aktual, pemeriksaan fisik dan kalender sebelum handover, kompensasi keterlambatan delivery, laporan pelanggan tanpa pelepasan stok, verifikasi per unit, denda/kerusakan final, pengembalian sebagian, dan persiapan/perawatan satu jam dengan penyelesaian admin. Pengembalian membatalkan seluruh proposal perpanjangan pending terkait dan menyiapkan refund 100% untuk receipt tambahannya; jadwal awal unit lain tetap berlaku. Kontrak dan batas tahap di [backend/OPERATIONS.md](backend/OPERATIONS.md). Perpanjangan tersedia melalui [backend/EXTENSIONS.md](backend/EXTENSIONS.md). Kehilangan/penggantian dan risiko booking mendatang tersedia melalui [backend/LOSS_RISKS.md](backend/LOSS_RISKS.md). Pengiriman notifikasi tetap tahap berikutnya.

Verifikasi tahap serah terima/pengembalian 9 Oktober 2026: build/typecheck/lint/format, 18 tes tanpa DB dan 122 tes PostgreSQL lulus. Tambahan mencakup pelunasan admin sebagian/lebih dan retry concurrent, kesiapan fisik dan timestamp, handover/no-show nyata bersamaan, kompensasi delivery yang bertabrakan, laporan/review, return sebagian, denda/kerusakan sekali, pengecualian beririsan, waktu petugas, maintenance/persiapan tepat satu jam, kewajiban/proof pelunasan sebelum denda baru, pembatalan seluruh proposal perpanjangan beserta refund aktual, dan HTTP role/CSRF/DTO. Schema/migrasi tidak berubah.

Perpanjangan per unit tersedia: paket snapshot 6/12/24 tanpa perbedaan hari, batas dua jam/tujuh hari, quotation ongkir untuk penjemputan terpisah, hold 30 menit, proof/receipt privat, dana kurang/lebih, approval multi-unit atomik, expiry dan rekonsiliasi/refund manual. Kalender dan sewa awal tetap terlindungi; approval/pengembalian diserialisasi. Keterlambatan admin dengan dana timely terverifikasi mendapat pengecualian denda, termasuk credit/refund jika barang sudah kembali. Reminder/overdue tersimpan terdeduplikasi, pengirim PWA kini tersedia, WhatsApp ditunda. Kontrak dan configuration di [backend/EXTENSIONS.md](backend/EXTENSIONS.md).

Verifikasi tahap perpanjangan 9 Oktober 2026: build/typecheck/lint/format, 18 tes tanpa DB dan 143 tes PostgreSQL lulus. Tambahan mencakup snapshot tarif, idempotensi/konkurensi proposal, kontensi kalender dengan booking baru, batas dua jam/jam operasional/tujuh hari, hold/upload/konfirmasi, quotation/consent, pembayaran kurang/lebih, rollback approval multi-unit setelah receipt, approval/pengembalian bersamaan, approval admin terlambat, koreksi/refund denda yang sudah dibayar, expiry lintas worker dan isolasi kegagalan, pengingat terdeduplikasi, clock sebelum commit dan penyimpanan proof, proposal gratis, serta HTTP role/CSRF/proof privat. Schema/migrasi tidak berubah.

Kehilangan/risiko tersedia: loss record terpisah, kompensasi/denda final sampai lost_at, penutupan per unit tanpa pengembalian palsu, refund perpanjangan pending, serta koreksi denda setelah rekonsiliasi. Booking mendatang tetap aktif dan berisiko; admin mengganti unit dari model sama melalui pemeriksaan kalender/lock atomik atau membatalkan dengan refund penuh. Risiko dihitung langsung dan outbox dipindai worker bertahap. Kontrak/configuration di [backend/LOSS_RISKS.md](backend/LOSS_RISKS.md). Notifikasi, koreksi receipt masuk dan laporan dilengkapi pada penyelesaian backend di bawah.

Verifikasi tahap kehilangan/risiko 9 Oktober 2026: build/typecheck/lint/format, 18 tes tanpa DB dan 158 tes PostgreSQL lulus. Tambahan mencakup kehilangan/return/approval bersamaan, tagihan dan replay sekali, waktu kejadian/rollback, kehilangan sebagian, refund proposal multi-unit, rekonsiliasi/koreksi denda yang sudah dibayar, perlindungan booking mendatang, penggantian unit terakhir bersamaan, riwayat alokasi/harga/buffer, deadline/kesiapan, pemindaian risiko terdeduplikasi, serta HTTP role/CSRF/DTO. Schema/migrasi tidak berubah.

Notifikasi tersedia: API langganan push admin, sender VAPID, outbox setelah commit, versi proof/deadline, skip task tidak relevan, retry satu/lima menit dengan maksimal tiga percobaan, serta recovery lease lintas worker. Aset PWA ada di frontend/public/admin; panel React dan tes perangkat nyata belum tersedia. Adapter WhatsApp nonaktif sampai keputusan provider/akun/template/penerima diselesaikan, sehingga tes WhatsApp hanya memakai simulasi. Kontrak di [backend/NOTIFICATIONS.md](backend/NOTIFICATIONS.md), integrasi di [frontend/PWA.md](frontend/PWA.md).

Verifikasi tahap notifikasi 9 Oktober 2026: build/typecheck/lint, 23 tes tanpa DB dan 171 tes PostgreSQL lulus. Tambahan mencakup ownership subscription/CSRF, host/key dan VAPID, manifest/ikon/handler push-click, adapter timeout/error privat, dispatch/sender bersamaan, versi proof pada deadline yang sama, skip setelah keputusan, retry/recovery lease, endpoint kedaluwarsa, scope extension, dan isolasi event invalid. Migrasi lease/context diterapkan di PostgreSQL. Pengiriman provider nyata, pemasangan panel dan verifikasi perangkat belum dilakukan.

## Tahap 3 — UI, integrasi, dan deployment

- [x] Kontrak API modul, OpenAPI runtime admin dan ekspor build untuk integrasi; response service rinci mengikuti dokumentasi modul.
- [x] Frontend phase 1 mengikuti API dan pilihan visual pengguna; hasilnya ada pada status terkini.
- [x] Demo/panduan, audit halaman responsif dan kontrol notifikasi tersedia.
- [ ] Web Push perangkat nyata, acceptance operasional dan deployment produksi.

Provider WhatsApp, hosting, dan target bisnis/performa terukur tetap mengikuti keputusan terbuka PRD §19. Jangan mengklaim fondasi/schema sebagai backend bisnis yang sudah lengkap.

Keputusan 9 Oktober 2026: phase 1 hanya PWA. Pengingat booking/perpanjangan H-30/H-15/H-5 dan overdue; tahap lama tidak menumpuk jika worker terlambat. WhatsApp tidak mendapat antrean baru. Helper bunyi dashboard aktif tersedia; wiring panel React, tanda merah overdue, tombol aktivasi/pengakuan dan tes perangkat mengikuti tahap frontend.

Verifikasi perubahan PWA-only: build/typecheck/lint/format lulus; 24 tes tanpa DB dan 172 tes PostgreSQL lulus (196 total). Tes tambahan memeriksa tahap pengingat terbaru, tidak adanya task WhatsApp baru, aktivasi suara, pengakuan lokal, pergantian versi tugas, tab tersembunyi dan disposal. Pengiriman push/perangkat nyata serta integrasi panel belum diuji.

## Penyelesaian backend dan referensi desain terbaru

Backend phase 1 melengkapi laporan/Excel, media publik aman, read-model panel admin, koreksi receipt masuk dan koreksi pengembalian. [backend/API.md](backend/API.md) menghubungkan kontrak per modul; [backend/ACCEPTANCE.md](backend/ACCEPTANCE.md) memetakan aturan PRD ke tes dan acceptance eksternal. Migrasi receipt_corrections dan return_exemptions menambah riwayat reversal immutable, indeks antrean/laporan, serta interval pengecualian untuk koreksi denda.

Ekspor HTML, gambar, registry, dan dokumen Stitch telah dihapus atas permintaan pengguna.

Verifikasi akhir backend 9 Oktober 2026: 26 tes tanpa DB dan 185 tes PostgreSQL/HTTP lulus (211 total). Build/typecheck/lint/format dan Prisma validate lulus. Migrasi diterapkan dari kosong dan upgrade pada PostgreSQL 18; diff database/schema tanpa drift; audit dependency nol kerentanan. Tes koreksi/read-model/media juga berjalan dalam schema sementara dari SQL migrasi kosong dan membersihkan seluruh fixture tanpa menonaktifkan guard riwayat. Ekspor OpenAPI dan 36 pasangan HTML/PNG/registry/guide diperiksa. Tidak ada commit/push atau deployment pada tahap ini.

## Fondasi frontend - tahap 3, langkah 1

- [x] React/Vite/TypeScript dengan dependensi terkunci; build menyertakan typecheck.
- [x] Tailwind v4, komponen dasar shadcn/ui, Poppins lokal, dan token/layout aplikasi.
- [x] Router pelanggan/admin dengan guard sesi/role dan tujuan login yang dibatasi.
- [x] Axios cookie/CSRF, React Query untuk sesi/server, Zustand untuk state navigasi.
- [x] Login nyata, pemulihan sesi, logout, cache privat, keadaan loading/error/offline.
- [x] Shell responsif, navigasi keyboard, beranda/informasi akun, dan manifest admin.
- [ ] Registrasi/profil penyewa, katalog, booking dan upload bukti (langkah 2).
- [ ] Operasional/pengelolaan admin serta aktivasi push/suara dan uji perangkat nyata.

Setup dan batas cakupan ada di [frontend/README.md](frontend/README.md). Beranda tahap ini menampilkan akun aktif; belum menampilkan dashboard bisnis atau data transaksi contoh.

Verifikasi fondasi frontend: 19 tes Vitest/MSW dan 9 tes browser Chromium lulus, termasuk API Nest/PostgreSQL nyata pada database sementara. Build/typecheck, lint, format dan audit dependensi lulus (0 vulnerabilities). Tampilan diperiksa pada 360/390/768/1024/1440 px; layout admin diperiksa pada 390/1440 px. Ini belum mencakup alur booking atau pengujian PWA pada perangkat nyata.

## Frontend pelanggan - langkah 2

Registrasi dan profil (NIK tidak dikembalikan/disimpan lokal), katalog/detail dengan foto, pilihan tarif, aksesori per unit, jadwal WIB, pickup/delivery, quotation/availability, empat persetujuan dan booking tersedia. Pelanggan langsung upload bukti tanpa persetujuan admin sebelumnya; halaman pembayaran memisahkan bukti pending dari uang terverifikasi, menampilkan sisa obligation, tenggat dan riwayat proof privat. Daftar/detail, dashboard tindakan berikutnya dan pelunasan terintegrasi.

Read model backend ditambah allowlist rental-policy publik, sortir/filter daftar pelanggan, foto item serta kredit/sisa kewajiban pembayaran. Tidak ada migrasi/perubahan aturan alokasi. OpenAPI diperbarui.

Verifikasi: build/typecheck/lint/format; 26 tes frontend dan 15 Chromium lulus, termasuk UI registrasi/profil/booking/upload pada Nest/PostgreSQL sementara dan viewport 360/390/768/1024/1440. Backend 26 tes tanpa DB dan 186 skenario PostgreSQL/HTTP lulus (suite penuh sebelumnya 185, ditambah skenario kontrak publik dan assertion saldo partial). Screenshot implementasi tersedia di docs/frontend/.

Berikutnya: aksi pelanggan pembatalan/refund, perpanjangan dan pengembalian per item; panel operasional admin; wiring notifikasi/suara PWA dan pengujian perangkat. WhatsApp tetap ditunda.

## Panel booking dan pembayaran admin — langkah 3

- [x] Daftar booking, pencarian/filter dan antrean bukti pembayaran.
- [x] Detail booking, pelanggan tanpa NIK, unit/jadwal, saldo dan riwayat status.
- [x] Preview/unduh bukti privat, verifikasi uang aktual dan penolakan bukti.
- [x] Pencatatan pelunasan aktual, konfirmasi tindakan dan retry idempotent.
- [x] Verifikasi UI/API, responsivitas dan dokumentasi cakupan.

Verifikasi 11 Oktober 2026: 35 tes frontend, 18 tes browser dengan API simulasi, dan satu alur admin UI pada Nest/PostgreSQL terpisah lulus. Alur nyata mencakup DP kurang bayar, pelengkapan DP, konfirmasi, pelunasan, proof privat, penolakan bukti tanpa membatalkan booking dan akses admin yang ditolak bagi pelanggan. Backend: 26 tes tanpa DB dan suite booking PostgreSQL (17 skenario) lulus. Build/typecheck/lint lulus; viewport 360/390/768/1024/1440 px diperiksa. Kontrak daftar admin menambah pencarian/filter/sort serta kontak pelanggan aman; OpenAPI diperbarui tanpa migrasi atau perubahan aturan pembayaran.

Berikutnya: serah-terima dan pengembalian per unit, pembatalan/refund/perpanjangan, inventaris/pengaturan/laporan, serta aktivasi push/suara dan tes perangkat nyata. Verifikasi bukti pada panel ini mencakup pembayaran awal; pembayaran perpanjangan mengikuti tahap berikutnya.

## Serah-terima dan pengembalian admin — langkah 4

- [x] Form serah-terima dengan pemeriksaan pelunasan dan keterlambatan delivery.
- [x] Verifikasi pengembalian per unit, kondisi, kerusakan dan pengecualian denda.
- [x] Penolakan laporan, riwayat penerimaan dan pembaruan saldo/status.
- [x] Konfirmasi tindakan, retry idempotent, tes perilaku dan browser responsif.

Verifikasi 11 Oktober 2026: seluruh 43 tes Vitest/MSW frontend lulus. Sepuluh tes browser booking/pembayaran/pengembalian admin lulus pada 360/390/768/1024/1440 px. Suite operasional PostgreSQL terpisah lulus (14 skenario dan suite induk), termasuk handover/no-show bersamaan, pengembalian sebagian, perawatan, pengecualian denda, pembatalan perpanjangan pending dan HTTP role/CSRF. Build/typecheck/lint serta format file yang berubah diperiksa. Tidak ada perubahan backend, schema atau migrasi pada langkah ini; UI memakai endpoint operasional yang sudah tersedia. Screenshot desktop/mobile ada di docs/frontend/.

Tahap berikutnya mencakup inventaris serta penyelesaian perawatan/persiapan fisik. Verifikasi pengembalian tidak otomatis menjadikan unit ready; aturan persiapan satu jam tetap berlaku. Koreksi pengembalian, kehilangan, refund dan perpanjangan belum memiliki form pada panel ini.

## Inventaris dan kesiapan unit admin — langkah 5

- [x] Katalog admin dengan pencarian/filter, pagination dan detail aktif/nonaktif.
- [x] Buat/edit model, tarif, isi paket dan upload foto publik.
- [x] Tambah unit iPhone/aksesori dan kelola status aktif tanpa menghapus riwayat.
- [x] Mulai/selesaikan perawatan dan selesaikan persiapan setelah satu jam.
- [x] Verifikasi API, UI responsif, dokumentasi dan screenshot.

Verifikasi 11 Oktober 2026: 54 tes frontend, tujuh tes browser inventaris dengan API simulasi, satu alur browser dengan API/PostgreSQL nyata dan delapan tes suite inventaris PostgreSQL lulus. Alur nyata mencakup model baru/edit, foto sanitasi, batch aksesori, mulai/selesai perawatan, persiapan satu jam dan detail model nonaktif. Tes lain mencakup batch kode iPhone, alokasi aktif, pengembalian belum verified, clock deadline dan browser back. Build/typecheck/lint serta format file yang berubah lulus. Read model backend menambah pencarian/filter, detail admin nonaktif dan hitungan alokasi/sewa belum kembali. OpenAPI diperbarui; tidak ada migrasi atau perubahan aturan stok/tarif.

Pembuatan inventaris belum mendukung idempotensi backend; panel memblokir pengulangan langsung bila respons pembuatan ambigu dan meminta pemeriksaan inventaris. Langkah berikutnya: pembatalan/refund dan perpanjangan, pengaturan/zona/laporan admin, serta integrasi push/suara dan perangkat nyata.

Regresi browser akhir: 30 tes API simulasi lulus, empat tes API nyata dilewati pada konfigurasi default; alur inventaris API nyata dijalankan terpisah dan lulus. Backend demo utama dimulai ulang dengan build terbaru; detail model/hitungan unit tersedia dan tujuh model dummy tetap tersimpan.

## Pembatalan dan refund — langkah 6

- [x] Pembatalan seluruh booking pelanggan sebelum serah-terima, dengan aturan snapshot dan alasan wajib.
- [x] Pembatalan admin karena kendala toko memakai endpoint refund penuh terpisah.
- [x] Form rekening pelanggan/admin yang terkunci setelah keputusan.
- [x] Antrean refund admin, persetujuan tanpa mencatat kas keluar dan penolakan beralasan.
- [x] Pencatatan transfer manual dengan nominal persetujuan, waktu WIB, referensi dan bukti privat.
- [x] Review tindakan, retry idempotent, invalidasi data dan unduhan bukti pemilik/admin.
- [x] Verifikasi akhir dan dokumentasi screenshot.

Backend yang sudah tersedia tetap menghitung hak refund dan menjaga transaksi/idempotensi/otorisasi. Suite refund PostgreSQL terpisah lulus: 17 tes termasuk batas tepat 48 jam, DP/lunas, pembatalan kendala toko, dana berlebih, pembatalan bersamaan approval, transfer bersamaan, CSRF dan bukti privat. Tidak ada migrasi, perubahan perhitungan atau transfer bank sungguhan. Berikutnya: perpanjangan dan laporan pengembalian pelanggan, pengaturan/zona/laporan admin, push/suara serta perangkat nyata.

Verifikasi akhir 11 Oktober 2026: 61 tes Vitest/MSW, 36 tes Chromium API simulasi dan 17 tes refund PostgreSQL lulus; empat tes browser API nyata fase terdahulu dilewati pada konfigurasi default. Regresi dijalankan berurutan setelah timeout saat suite berjalan bersamaan. Browser refund mencakup 360/390/768/1024/1440 px serta pelanggan yang membatalkan, mengisi rekening dan mengunduh bukti privat setelah penyelesaian admin. Build/typecheck/lint dan format file berubah lulus. Screenshot tersimpan di docs/frontend; Vite dan readiness API demo utama merespons 200. Alur browser refund belum diuji end-to-end dengan API nyata; kontrak UI diperiksa lewat MSW/Chromium dan perilaku backend lewat PostgreSQL/HTTP.

## Penyelarasan tabel dan Gantt ? 18 Oktober 2026

- Daftar berpaginasi menggunakan 10 data per halaman; daftar zona, tindak lanjut pengiriman dan transaksi sukses juga dipaginasi di UI. Dropdown dan ringkasan mempertahankan batas sesuai fungsi.
- Filter tanggal memakai satu komponen kalender ikon, pemilihan rentang, chevron, penanda aktif outline dan titik, serta penutupan klik luar/Escape. Periode laporan tetap tanggal/bulan sesuai kontrak API.
- Jadwal unit menggunakan baris Gantt seragam, identitas ringkas dan kolom kiri tetap saat digeser. Booking berurutan berbagi jalur; alokasi yang beririsan memakai jalur berbeda. Detail waktu dan akses inventaris dipindahkan ke dialog informasi unit. Sewa, buffer dan hold tetap memakai waktu API asli.
- Verifikasi: build/typecheck/lint; browser desktop/mobile untuk halaman manajemen, pagination dan kalender. Screenshot admin-calendar-gantt tersedia di docs/frontend.

## Simulasi sewa menyeluruh - 20 Oktober 2026

- [x] Database QA dari enam migrasi kosong, terpisah dari aplikasi utama.
- [x] UI nyata: daftar/profil, booking/upload, verifikasi DP/pelunasan, handover, return dan persiapan admin satu jam.
- [x] API nyata: perebutan unit, replay, kurang bayar, penolakan bukti, verifikasi bersamaan, privasi inbox/bukti dan refund manual 75%.
- [x] Rapikan fixture profil/inbox/toast, dukungan Notification dan pemilihan status/alert agar regresi mengikuti UI terbaru.
- [x] Helper dan konfigurasi QA yang bisa diulang; jam simulasi hanya di proses QA.

Hasil: 188 tes PostgreSQL/HTTP, 26 unit backend, 81 UI, 92 Chromium API simulasi dan dua simulasi nyata lulus. Lima tes Chromium berkonfigurasi khusus dilewati pada regresi default. [Laporan dan batas pengujian](docs/qa/2026-10-20-rental-simulation.md) menjelaskan bukti per kelompok. Tidak ada perubahan aturan bisnis untuk membuat tes lulus; perangkat fisik/push/QRIS/transfer bank dan kapasitas produksi tetap di luar cakupan.
