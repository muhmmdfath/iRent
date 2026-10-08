# Review desain Stitch iRent

Tanggal: 8 Oktober 2026. Acuan: `PRD.md` versi 2.3.
Proyek Stitch: `3018690351259872805` — **iRent Semarang Dashboards**.

## Ruang lingkup dan status

Audit mencakup screenshot serta HTML empat dashboard awal. Revisi dilakukan melalui MCP Stitch di proyek yang sama. Hasil Stitch adalah rancangan UI, bukan aplikasi yang telah menjalankan aturan database, pembayaran, worker, atau pengujian bisnis.

- [x] Periksa dashboard pelanggan desktop/mobile dan admin desktop/mobile.
- [x] Petakan perbedaan dengan PRD.
- [x] Revisi empat dashboard dan periksa hasilnya.
- [x] Tambahkan rancangan detail untuk pembayaran, perpanjangan, pengembalian, dan refund.
- [x] Catat layar hasil serta batas verifikasi.

Enam layar menjadi ruang lingkup hasil: empat dashboard yang direvisi, halaman pembayaran pelanggan desktop, dan detail operasional booking admin desktop. Desain seluruh halaman phase 1 (misalnya registrasi, profil, wizard booking lengkap, settings, dan laporan) bukan klaim hasil review ini.

## Revisi visual Taste — dashboard pelanggan desktop

### Generasi ulang enam layar FIX sesuai DESIGN.md

Pengguna meminta versi FIX baru langsung di Stitch mengikuti requirement dan `DESIGN.md`. Satu request `edit_screens` dikirim untuk enam layar acuan: pelanggan desktop/mobile, pembayaran pelanggan desktop, admin desktop/mobile, dan detail operasional admin desktop. Judul target memakai akhiran **— DESIGN.md**; layar sumber tetap dipertahankan.

Request mencapai timeout MCP 300 detik, tetapi proses Stitch terus berjalan. Keenam layar akhirnya muncul tanpa mengulang request. Setelah pemeriksaan screenshot/HTML, empat layar dikoreksi menjadi v2; admin mobile dan detail operasional dikoreksi lagi menjadi v3. Enam hasil terbaru tercatat pada tabel **Layar acuan terbaru** di bawah dan menggantikan daftar FIX sebelumnya.

Screenshot penuh dan HTML seluruh hasil terbaru diperiksa. Tidak ditemukan stylesheet/deklarasi Inter, kelas monospace, maupun kelas teks 10–13 px/text-xs pada enam HTML acuan. Ikon memakai font glyph tersendiri agar tidak berubah menjadi kata; seluruh teks UI memakai Poppins. Ikon, kode unit, dan label tindakan yang bermasalah diperbaiki. Jumlah, jadwal, deadline, perpanjangan pending, waktu penerimaan/verifikasi/persiapan, serta kas/refund sesuai contoh PRD. Akun/rekening/NIP rekaan di detail dihapus; proof menggunakan placeholder simulasi. Approval perpanjangan dan pencatatan refund pada contoh tetap nonaktif sampai guard/kebutuhan bukti dipenuhi.

Status: **enam rancangan baru tersedia dan siap ditinjau**, bukan produk yang telah memenuhi seluruh kriteria runtime. Versi mobile hanya dirancang pada viewport contoh; detail/payment saat ini masih rancangan desktop. Belum ada pengujian navigasi, backend, konkurensi, PWA perangkat nyata, zoom, atau WCAG penuh. Warna status tambahan dan kepadatan halaman detail panjang tetap perlu dinilai pengguna sebelum implementasi; token final mengikuti `DESIGN.md`.

Layar baru: **REVIEW — Pelanggan Dashboard Desktop — Poppins v2**, ID `13ef440274d04cc0ac66ccc0df467669`. Dibuat dari FIX pelanggan desktop tanpa menghapus sumber. Screenshot tersimpan di [design/previews/customer-dashboard-desktop-poppins.png](design/previews/customer-dashboard-desktop-poppins.png).

Status iterasi desktop ini: **menjadi patokan visual untuk enam FIX baru**, bukan lagi layar acuan terbaru. Versi percobaan pertama `58c3ac5e8f21456fba00a75ef0d65d48` tidak menjadi acuan karena masih memiliki konfigurasi Inter.

Perubahan: konten dibatasi 1200 px dengan gutter 40 px; pembayaran mendesak menjadi satu action dominan; booking berikutnya memakai kolom pendukung; sewa aktif berupa baris tersendiri; metrik diringkas menjadi strip kecil; katalog lengkap dan banner ketentuan panjang diganti akses ke halaman terkait. Font Poppins, ruang antarseksi, dan warna tombol mengikuti `DESIGN.md`.

Verifikasi screenshot penuh dan HTML v2: tidak ditemukan stylesheet/deklarasi Inter, kelas monospace, kelas teks 10–13 px/text-xs, atau warna tombol lama. Poppins dimuat untuk weight 400/500/600. Jadwal, DP Rp20.000, sisa Rp100.000, deadline upload 10 Oktober 09.30 WIB, dan konfirmasi booking biasa 11 Oktober 08.15 WIB konsisten dengan contoh sebelumnya. Tidak terlihat clipping pada screenshot desktop.

Batas: belum diuji sebagai aplikasi pada perangkat, seluruh ukuran viewport, zoom, focus keyboard, maupun font loading saat jaringan gagal. Arah visual ini sudah diterapkan pada enam layar acuan terbaru; halaman phase 1 lainnya tetap perlu dilengkapi.

## Temuan sebelum revisi

### Pemetaan requirement setelah penyederhanaan dashboard

Pada review lanjutan, pengguna menyetujui arah layout yang lebih rapi dan meminta kelengkapan requirement tetap dijaga. Ringkasan berikut menjadi checklist lintas layar. **Tercermin pada desain bukan berarti fungsi sudah diimplementasikan.**

| Area dan acuan PRD | Tempat requirement dipenuhi | Status / hal yang wajib dilengkapi |
|---|---|---|
| Dashboard pelanggan (§13) | Dashboard desktop/mobile | Desktop dan mobile FIX baru menampilkan booking mendesak, booking berikutnya, sewa aktif, ringkasan, dan akses katalog mengikuti arah Poppins/spacing |
| Akun dan profil (§5, §13–14) | Login, registrasi, profil, data penyewa admin | Lengkapi nama/alamat/HP/NIK wajib, tanpa upload/verifikasi KTP; reset password melalui admin; tidak menaruh NIK pada dashboard |
| Katalog dan paket (§6, §13) | Katalog dan wizard | Foto, isi paket, harga 6/12/24 atau kelipatan 24 hingga 168 jam; tarif sama setiap hari; katalog tetap wajib meskipun tidak ditampilkan penuh di dashboard |
| Validasi jadwal (§6) | Pemilih jadwal dan server | Jam 08.00–22.00, lead minimal dua jam, pembukaan tanggal 25, jadwal akhir otomatis, satu iPhone overlap/customer, aksesori mandiri/multi-unit |
| Stok dan fairness (§7) | Katalog, konflik booking, backend PostgreSQL | Alokasi berhasil secara atomik, retry/idempotensi, buffer dan konflik; kalender berbeda dari kondisi fisik; screenshot tidak membuktikan aman saat berebut |
| Antar-jemput (§6, §10, §12) | Wizard, detail booking, quotation, pengaturan ongkir | Zona kecamatan aktif, alamat, nominal ongkir sebelum persetujuan; quotation penjemputan terpisah sebelum submit/hold formal |
| Booking dan pembayaran awal (§6, §8) | Dashboard, wizard, pembayaran | Dashboard sudah menunjukkan upload langsung tanpa izin admin dan DP Rp20.000 per booking; payment wajib menyediakan QRIS, DP/lunas, total kecil wajib lunas, bukti privat JPG/PNG/PDF maksimal 2 MB |
| Deadline dan keadaan pembayaran (§6, §8) | Dashboard, payment, antrean admin | Contoh deadline dashboard konsisten; lengkapi mendesak/biasa, upload ditolak/ulang dalam batas asli, kedaluwarsa, kurang/lebih bayar, dan admin terlambat tanpa auto-cancel/approve |
| Status, saldo, dan riwayat (§8, §13) | Daftar/detail booking dan tagihan | Booking, pembayaran, refund, serta jadwal tiap unit berbeda; seluruh saldo, receipt, dan riwayat dapat ditelusuri; upload bukan label lunas |
| Serah terima (§10) | Detail booking admin | Wajib dikonfirmasi, pelunasan tercatat, unit siap fisik, dan pengecekan atomik; tidak mengambil dana perpanjangan pending untuk pelunasan awal |
| Perpanjangan (§12) | Detail booking pelanggan dan operasional admin | Dashboard menyediakan akses; detail harus memilih unit, paket, harga snapshot, pembayaran penuh, hold 30 menit, bentrok/deadline dan jadwal lama sampai approval; satu pengajuan multi-unit seluruhnya approve/reject |
| Pengembalian/persiapan (§10) | Laporan pelanggan, admin per unit, stok | Dashboard menyediakan laporan dan helper pemeriksaan admin; detail wajib membedakan laporan, penerimaan aktual, verifikasi, persiapan satu jam, serta perawatan selesai lalu persiapan |
| Denda, kerusakan, kehilangan (§10) | Detail tagihan, pengembalian, admin | Rp10.000/jam per unit setelah toleransi satu jam, berdasarkan penerimaan/penyerahan petugas terverifikasi; pengecualian keterlambatan admin/petugas, kehilangan dan saldo tersisa memerlukan keadaan UI tersendiri |
| Risiko jadwal berikutnya (§11) | Dashboard/booking admin | Alert risiko, pengganti model sama jika tersedia, koordinasi reschedule/full refund; tidak membatalkan otomatis atau menganggap barang siap |
| Pembatalan, refund, no-show (§9) | Detail booking pelanggan dan antrean/detail refund admin | Tautan detail menjadi akses; kebijakan pembatalan seluruh booking sebelum handover, persentase/batas 48 jam, no-show, refund dana gagal/kelebihan sesuai PRD; keputusan refund terpisah dari transfer aktual |
| Admin dan pengelolaan (§14) | Seluruh panel admin | Akun admin dengan hak sama, item/unit/isi paket/perawatan, jadwal, penyewa, pembayaran, pengembalian, refund, transaksi selesai+lunas, ongkir/settings tetap scope |
| Laporan dan kas (§6, §14) | Dashboard kas dan halaman laporan | Kas masuk aktual terverifikasi dikurangi refund benar-benar ditransfer; kewajiban refund dan dana perpanjangan pending terpisah; laporan harian/bulanan, status, item populer, Excel |
| PWA, WhatsApp, worker (§15) | Admin, pengaturan notifikasi, backend | Web Push + pesan WhatsApp, pengingat 30 menit sebelum batas konfirmasi dan 20 menit sebelum pickup pending; status izin/gagal/offline; tanpa call atau transaksi/cache operasional offline |
| Keamanan dan nonfungsional (§3–5, §16) | Seluruh frontend, API, database/storage | Otorisasi pemilik/admin, dokumen privat, NIK terenkripsi, validasi server, audit/outbox, presisi rupiah, snapshot, responsif, performa dan backup memerlukan implementasi/tes |
| Ketentuan dan halaman informasi (§13) | Terms/about dan persetujuan wizard | Teks klien, syarat KTP/SIM dan aturan aktual; tidak mengganti consent dengan menyembunyikan aturan di footer |
| Tes, deployment, dan serah terima (§17–19) | Rencana implementasi/operasional | 65 skenario PRD tetap wajib; hosting/provider dan keputusan terbuka belum selesai. Desain rapi tidak memenuhi kriteria production-ready |

**Gate sebelum menyetujui desain alur:** setiap requirement memiliki halaman/action/state yang jelas. Tombol dashboard harus membuka booking atau unit yang benar; Detail booking harus menyediakan pembayaran, status, saldo, pembatalan/refund, dan riwayat. Semua error/empty/loading/pending/rejected/expired yang relevan dirancang. Saat implementasi, tautan placeholder `#` dari ekspor Stitch diganti route nyata; navigasi prototipe belum membuktikan akses fitur bekerja.

**Gate sebelum menyatakan produk selesai:** seluruh skenario PRD §17 dan pemeriksaan keamanan/konkurensi berjalan pada aplikasi nyata. Tidak ada requirement yang dihapus hanya untuk mengurangi kepadatan visual.

| Area | Desain awal | Penyesuaian sesuai PRD |
|---|---|---|
| Booking | Persetujuan umum dengan badge KTP/SIM | Pelanggan langsung booking dan upload; admin memverifikasi uang masuk |
| Profil | Akun/KTP terverifikasi; identitas terlampir | Profil lengkap: nama, alamat, HP aktif, NIK; tanpa menambahkan workflow upload/verifikasi KTP |
| Status | Menunggu, dikonfirmasi, selesai tercampur | Pisahkan status booking, pembayaran, pengajuan perpanjangan, pengembalian, dan refund |
| Deadline | Tidak ada batas bayar/konfirmasi | Countdown dan timestamp WIB sesuai kategori mendesak/biasa; keterlambatan admin tidak melepas alokasi |
| Katalog | Tersedia/siap kirim tanpa tanggal | Pemilihan tanggal, jam, durasi, dan ketersediaan untuk jadwal terpilih |
| Stok | Hitungan tersedia saja | Kalender alokasi berbeda dari kondisi fisik: disewa, pemeriksaan, transit, persiapan, perawatan, siap |
| Perpanjangan | Tidak ditampilkan | Pilih unit, paket 6/12/24 jam, hold tambahan, bayar penuh, lalu keputusan admin |
| Pengembalian | Jadwal pengembalian saja | Laporan pelanggan, penerimaan aktual, verifikasi admin per unit, persiapan satu jam |
| Refund | Tidak ditampilkan | Persetujuan dan pencatatan uang benar-benar dikembalikan merupakan dua tindakan terpisah |
| Admin | Super Admin, cabang tambahan | Semua admin memiliki hak sama; phase 1 satu cabang |
| Laporan | Tidak membedakan dana pending/refund | Kas masuk terverifikasi, kas keluar refund selesai, dan kewajiban refund terpisah |
| Konten | Gratis ongkir, garansi resmi, baterai 100%, kontak fiktif | Hapus klaim yang belum disepakati; ongkir sesuai zona dan kontak dari konfigurasi klien |
| Jam | Footer 08.00–21.30 | 08.00–22.00 WIB |
| Layout | Kolom tindakan admin desktop terpotong | Prioritaskan kolom tindakan/deadline, tabel responsif dan drawer detail |
| Keterbacaan | Teks putih pada pink muda | Teks gelap pada pink muda atau tombol rose gelap berkontras cukup |

Tema pink pastel, identitas iRent, dan organisasi navigasi dasar dipertahankan. Hindari dashboard yang didominasi promosi atau kartu kosong; dahulukan tindakan yang harus dilakukan pengguna.

Setelah review alur, pengguna menilai layout masih terlalu padat. `DESIGN.md` kini menjadi acuan visual baru: Poppins penuh, padding empat sisi, max-width, penekanan satu tindakan utama, dan pengurangan informasi awal. Label FIX menandai layar acuan alur yang dipertahankan, bukan kelulusan kualitas visual. Layar tersebut belum dinyatakan memenuhi panduan visual baru sampai direvisi dan ditinjau kembali.

## Aturan yang harus terlihat pada alur UI

### Booking dan pembayaran

Pelanggan dapat langsung membayar setelah alokasi booking berhasil. Status awal **Dipesan — menunggu pembayaran**, kemudian **Menunggu verifikasi pembayaran** setelah upload; **Booking dikonfirmasi** setelah admin memastikan dana masuk. Upload bukan bukti bahwa pembayaran telah diverifikasi. DP Rp20.000 per booking; total sampai Rp20.000 wajib lunas sebesar total. Tarif 6/12/24 jam sama setiap hari; kelipatan 24 jam tersedia sampai tujuh hari.

Booking dua sampai tiga jam sebelum pengambilan: upload 30 menit; konfirmasi paling awal antara upload + satu jam atau pengambilan − satu jam. Booking biasa: upload dua jam; konfirmasi paling awal antara upload +24 jam atau pengambilan − satu jam. Tampilkan waktu absolut WIB selain countdown. Bukti ditolak dapat diunggah ulang hanya selama deadline asli masih berlaku.

Konflik slot terakhir menampilkan **Item sudah dipesan pada waktu itu**, tanpa mengklaim klik pengguna menjamin alokasi. Tidak ada biaya weekday/weekend berbeda, payment gateway, atau izin admin sebelum pelanggan bisa upload.

### Perpanjangan dan pengembalian

Perpanjangan memilih unit tertentu dengan paket 6/12/24 jam, tarif snapshot, tanpa DP baru. Pengajuan website minimal dua jam sebelum kembali, maksimal penggunaan total 168 jam per unit, jadwal baru dalam jam operasional dan tidak bentrok. Pembayaran/upload 30 menit; jadwal lama tetap berlaku sampai admin menyetujui. Quotation penjemputan terpisah harus disetujui sebelum submit/hold formal.

Laporan **Sudah mengembalikan** belum membuat unit siap. Admin memverifikasi penerimaan aktual, waktu, serta kondisi per unit; unit layak menjalani persiapan satu jam setelah verifikasi. Unit rusak tetap perawatan sampai admin menyatakan selesai, lalu persiapan satu jam. Denda Rp10.000/jam per unit setelah toleransi satu jam, berdasarkan penerimaan aktual terverifikasi; waktu laporan/approval bukan dasar denda.

### Refund dan kontrol admin

Refund disetujui tetap **Menunggu transfer**. Setelah transfer manual, admin mencatat nominal, waktu, dan bukti, lalu menandai **Uang sudah dikembalikan**. Kas hanya berkurang setelah pencatatan transfer. Pembatalan pelanggan phase 1 berlaku untuk seluruh booking sebelum serah terima; pengembalian/perpanjangan tetap per unit.

Dashboard admin harus menampilkan deadline, pengajuan perpanjangan, laporan pengembalian, unit terlambat, booking berikutnya berisiko, serta refund disetujui belum ditransfer. Persiapan/perawatan tidak dapat dibypass dari tombol cepat. PWA dan pesan WhatsApp adalah notifikasi admin; phase 1 tanpa panggilan otomatis. NIK hanya pada detail penyewa berotorisasi, bukan dashboard/notifikasi.

## Layar awal yang diperiksa

| Layar | ID Stitch |
|---|---|
| Customer Dashboard — Mobile | `6a5fc7efe5a145bcb170fa2978365055` |
| Customer Dashboard — Desktop | `76d2e552490847b9800e030e566ed885` |
| Admin Dashboard — Mobile | `78eb79be589c4946986fe89cbea82f7a` |
| Admin Dashboard — Desktop | `dde9bb6f435645868f89f35dbb1b84bf` |

## Verifikasi hasil

Periksa screenshot dan teks HTML terhadap aturan di atas. Nominal, pelanggan, stok, dan timestamp pada desain adalah data ilustrasi. Keterbacaan visual bukan bukti WCAG terukur; belum ada tes runtime, konkurensi, PWA perangkat nyata, pembayaran, atau backend.

Hasil pemeriksaan terakhir: panel stok desktop menjadi daftar vertikal per unit, tidak lagi memuat baris transaksi/refund. Kondisi siap, disewa, persiapan, pemeriksaan, dan perawatan terpisah. Tombol utama mobile terbaca; estimasi waktu selesai perawatan yang belum memiliki dasar dihapus. Pada pickup 11.30, paket 12 jam dinonaktifkan karena pengembalian melewati 22.00. Kode booking biasa disamakan menjadi `IRN261010002`. QRIS pembayaran diberi label contoh, bukan QRIS yang dapat digunakan membayar.

Daftar stok desktop menggunakan ringkasan yang dipotong pada beberapa baris; detail kondisi, deadline lengkap, dan riwayat harus tersedia melalui halaman unit saat implementasi. Screenshot tidak membuktikan responsivitas seluruh ukuran layar. Konten lokasi dan kelengkapan produk masih data contoh dan harus memakai konfigurasi toko, bukan menjadi janji layanan tetap.

### Layar acuan terbaru

Gunakan hanya enam layar dengan **ID persis** di bawah. Ini versi terbaru yang dibuat ulang berdasarkan PRD dan `DESIGN.md`, dengan akhiran DESIGN.md/v2/v3 sesuai layar. Judul masing-masing diverifikasi melalui `get_screen`. Versi lama, termasuk yang juga berawalan FIX, bukan acuan terbaru dan boleh dihapus manual setelah enam hasil ini dipertahankan. Jangan menghapus design system atau proyek.

| Layar | ID Stitch | Screenshot |
|---|---|---|
| FIX — Admin Dashboard Desktop — DESIGN.md v2 | `33e8daa545054c2db4f52a47b6300189` | [Preview](design/previews/fix-admin-dashboard-desktop.png) |
| FIX — Admin Dashboard Mobile — DESIGN.md v3 | `1098a4a3d728405facd795a9d09a2ac1` | [Preview](design/previews/fix-admin-dashboard-mobile.png) |
| FIX — Pelanggan Dashboard Mobile — DESIGN.md | `cf87f41da3194774a97a962f969d09bc` | [Preview](design/previews/fix-customer-dashboard-mobile.png) |
| FIX — Pelanggan Dashboard Desktop — DESIGN.md | `d8bfc1f09efc427c83ffdde467929154` | [Preview](design/previews/fix-customer-dashboard-desktop.png) |
| FIX — Pelanggan Pembayaran Booking — DESIGN.md v2 | `0bed5e3f954d4d8195fa60f8d1b3c015` | [Preview](design/previews/fix-customer-payment.png) |
| FIX — Admin Detail Operasional Booking — DESIGN.md v3 | `c380dfa779444079b89a97c00d281934` | [Preview](design/previews/fix-admin-booking-detail.png) |

Koreksi field jam memerlukan regenerasi karena edit DOM pertama tidak tercermin pada ekspor. HTML layar desktop terakhir telah diperiksa: **Jam Ambil 11.30 WIB**, durasi **6 Jam**, estimasi kembali **17.30 WIB**, dan opsi **12 Jam** nonaktif. Layout lengkap sudah ditinjau pada versi sebelumnya; screenshot ekspor regenerasi terakhir hanya menampilkan bagian header, sehingga tampilan lengkap versi terakhir perlu diperiksa kembali di Stitch.

Design system `assets/bf8148331ac648dcb0d9c86ef8722d70` diperbarui menjadi **iRent Semarang — Pastel Bloom sesuai PRD 2.3**. Warna, font, serta tokens dasar dipertahankan; panduan konten menggantikan contoh verifikasi KTP/deposit dan memperjelas keterbacaan tombol, status, serta alur bisnis. Mengubah design system tidak otomatis membuktikan seluruh layar telah mengikuti panduan.

Hasil admin pertama (`163838d8910a47ae900967b6ab169807`, `da26adad55f840949fea9ea9b55ac9fb`) masih memuat refund deposit setelah sewa, batas refund 24 jam, label identitas terverifikasi, status unit ready saat disewa, persiapan sebelum penerimaan aktual, serta tombol putih/tabel terpotong. Revisi koreksi diminta dengan contoh pembayaran/refund dan status per unit yang konsisten.

Pemeriksaan versi berikutnya menambahkan koreksi: booking biasa dibuat 10 Oktober 07.30 dengan upload 08.15 harus memakai kode tanggal `IRN261010002`; admin dan pelanggan merujuk Dwi untuk booking contoh yang sama. Unit yang sudah disewa tidak boleh sekaligus siap fisik pada baris lain. Pada snapshot 09.45, jadwal kembali 09.00 berarti terlambat 45 menit dan estimasi denda masih nol, belum lewat toleransi satu jam.

Layar detail pertama masih memerlukan koreksi batas konfirmasi paling lambat satu jam sebelum pickup, alokasi yang sudah ditahan sebelum upload, laporan pengembalian melalui website, serta pembatalan pengajuan perpanjangan hanya setelah pengembalian diverifikasi admin. Janji marketing, kontak/identitas rekening fiktif, dan format bukti refund yang berbeda juga dibersihkan pada pass akhir.

Sepuluh pemeriksaan aritmetika/tanggal untuk data ilustrasi lolos: deadline konfirmasi booking mendesak/biasa, upload booking biasa, deadline perpanjangan, jam akhir perpanjangan, total sewa tiga unit, refund 75%/50%, total kewajiban refund, serta kas bersih. Ini pemeriksaan contoh desain, bukan pengujian aplikasi atau konkurensi.

### Batas penerapan desain

Rancangan belum membuktikan alokasi slot terakhir yang adil, idempotensi upload/approval, locking database, perhitungan tagihan, otorisasi dokumen privat, atau pengiriman notifikasi. Perilaku tersebut wajib diterapkan dan diuji menggunakan skenario PRD, bukan ditentukan dari badge atau tombol prototipe.

Sebelum implementasi, lengkapi registrasi/profil, pemilihan beberapa item, pengiriman dan quotation, konflik ketersediaan, upload ditolak/terlambat, riwayat transaksi, pengajuan perpanjangan pelanggan, detail refund pelanggan, serta pengaturan admin. Halaman pembayaran dan detail operasional saat ini baru memiliki rancangan desktop; mobile perlu rancangan tersendiri.

### Catatan iterasi

Stitch menghasilkan desktop `7ba5df13a1dc4b728604a277742b8a28` dan mobile `a6b4e773107d47779b6712ae3df27654`. HTML/screenshot mobile masih mengandung tiga kesalahan: kategori mendesak `<3 jam` (seharusnya 2–3 jam inklusif), janji refund maksimal 1×24 jam kerja yang belum disepakati, serta contoh iPhone aktif yang bertabrakan dengan booking iPhone lain pelanggan yang sama. Revisi koreksi diperlukan; hasil pertama belum dinyatakan sesuai.
