# Redesign iRent Semarang — Pastel Workspace

Tanggal: 9 Oktober 2026. Acuan fungsi: **PRD.md versi 2.4**.

Desain dibuat di [workspace Stitch terpisah](https://stitch.withgoogle.com/projects/7448049823013098704), bernama **iRent Semarang — Pastel Workspace Redesign**. Pilih **36 layar berlabel FIX**: 10 admin desktop, 7 pelanggan desktop, 17 adaptasi mobile lengkap, serta 2 contoh mobile awal. Project lama tidak diubah. Versi terdahulu yang sempat terpasang diberi label **DRAFT** dan dipisahkan di sisi canvas; gunakan FIX untuk implementasi.

## Acuan visual

Referensi: `D:\My Documents\Downloads\original-a26de1dbe8246317e0ab8b8f25082c62.jpg`. Tampilan mengikuti shell putih membulat di atas canvas abu-abu, sidebar ringan, kartu pastel, tombol utama charcoal, dan ruang antar elemen yang lapang. Poppins digunakan untuk seluruh teks UI. Kanban hanya untuk antrean pekerjaan; perubahan status tetap melalui tindakan eksplisit.

Aturan visual utama ada di [DESIGN.md](DESIGN.md); [PASTEL_WORKSPACE.md](docs/design/PASTEL_WORKSPACE.md) menerjemahkannya untuk prompt Stitch. Panduan telah diperketat untuk isi card, hierarki teks dan detail bertahap. Layar FIX masih menjadi referensi fungsi; revisi panduan ini belum diterapkan kembali pada desain Stitch. Pada mobile, antrean menjadi tab dan satu daftar, dengan formulir satu kolom.

## Peta fungsi dan layar

Tautan berikut membuka ekspor HTML prototipe. Screenshot PNG dengan kode yang sama tersedia di `docs/design/previews/`. ID sumber dan instance canvas terbaru dicatat dalam [screens.latest.json](docs/design/screens.latest.json).

| Layar | Fungsi yang diwakili |
|---|---|
| [A01 — Antrean admin](docs/design/previews/A01.html) | Prioritas pembayaran, serah terima, pengembalian, perpanjangan; deadline dan pengingat PWA. |
| [A02 — Booking dan pembayaran](docs/design/previews/A02.html) | Verifikasi uang masuk, bukti, kurang/lebih bayar, rekonsiliasi, penolakan bukti versus booking, no-show. |
| [A03 — Jadwal unit](docs/design/previews/A03.html) | Kalender per unit, alokasi, hold, persiapan, risiko booking berikutnya dan penggantian unit. |
| [A04 — Serah terima dan pengembalian](docs/design/previews/A04.html) | Pelunasan, pengembalian sebagian, waktu aktual, keterlambatan, kerusakan/kehilangan, maintenance dan persiapan. |
| [A05 — Perpanjangan](docs/design/previews/A05.html) | Pemilihan per unit, paket 6/12/24 jam, biaya penuh, quote, hold tambahan, konflik dan persetujuan. |
| [A06 — Refund](docs/design/previews/A06.html) | Permintaan, persetujuan, cakupan refund dan pencatatan transfer manual sebagai tindakan terpisah. |
| [A07 — Item dan unit](docs/design/previews/A07.html) | Pengelolaan katalog, isi paket, harga, unit fisik, kondisi dan maintenance. |
| [A08 — Penyewa dan akun](docs/design/previews/A08.html) | Profil, riwayat, NIK di detail berwenang, reset password manual dan akun admin. |
| [A09 — Laporan](docs/design/previews/A09.html) | Kas aktual, refund yang benar-benar ditransfer, transaksi selesai dan lunas, laporan harian/bulanan serta Excel. |
| [A10 — Pengaturan](docs/design/previews/A10.html) | Aturan sewa, QRIS, zona/ongkir, izin PWA, suara dashboard dan WhatsApp yang ditunda. |
| [C01 — Dashboard pelanggan](docs/design/previews/C01.html) | Booking aktif/mendatang, riwayat dan tindakan berikutnya. |
| [C02 — Katalog](docs/design/previews/C02.html) | Detail perangkat, isi paket, harga dan ketersediaan berdasarkan waktu. |
| [C03 — Booking](docs/design/previews/C03.html) | Jadwal, profil, maksimal satu iPhone beserta aksesori, DP/lunas, persetujuan ketentuan dan konflik stok. |
| [C04 — Pembayaran](docs/design/previews/C04.html) | QRIS manual, unggah bukti, deadline, menunggu verifikasi, bukti ditolak dan kurang bayar. |
| [C05 — Detail booking](docs/design/previews/C05.html) | Saldo tagihan, perpanjangan/pengembalian per unit, pembatalan, refund dan riwayat. |
| [C06 — Masuk dan daftar](docs/design/previews/C06.html) | Autentikasi tanpa OTP dan bantuan reset melalui admin. |
| [C07 — Profil dan informasi](docs/design/previews/C07.html) | Kelengkapan nama, alamat, nomor aktif dan NIK; ketentuan serta informasi layanan. |
| [M01 — Antrean admin mobile](docs/design/previews/M01.html) | Daftar prioritas, deadline absolut, terlambat, aktivasi suara dan pengakuan lokal. |
| [M02 — Pembayaran mobile](docs/design/previews/M02.html) | Ringkasan tagihan, batas waktu, metode bayar dan unggah bukti pada layar kecil. |

## Aturan penting dalam desain

- Pelanggan dapat booking lalu langsung membayar dan mengunggah bukti. Unggah bukti berarti **menunggu verifikasi**, bukan pembayaran sudah diterima; admin memeriksa transaksi bank.
- Paket 6/12/24 jam dan harga berlaku sama pada weekday/weekend. Perpanjangan dihitung per unit; jadwal awal tetap berlaku sampai disetujui, dan konflik tidak boleh dilewati melalui penggantian unit.
- Deadline upload dan konfirmasi mengikuti PRD, termasuk booking mendesak. Admin yang terlambat tidak otomatis membatalkan booking atau melepas alokasi.
- Laporan pengembalian pelanggan belum membuat unit ready. Admin memverifikasi barang, dilanjutkan persiapan satu jam dan tindakan menyelesaikan persiapan. Unit bermasalah melewati maintenance terlebih dahulu.
- Denda Rp10.000 per jam yang mulai berjalan per unit setelah toleransi satu jam. Tidak ada tarif denda berbeda berdasarkan jenis perangkat yang dibuat oleh desain.
- Refund yang disetujui belum dianggap ditransfer. Pembatalan lebih dari 48 jam memakai 50% DP atau 75% pembayaran penuh; dalam 48 jam tidak mendapat refund pembatalan. Kas mengikuti penerimaan terverifikasi dan refund yang benar-benar dikembalikan.
- PWA digunakan pada fase pertama. Suara berulang di dashboard aktif memerlukan aktivasi pengguna; pengakuan lokal tidak menyetujui transaksi. Push latar belakang tidak menjamin alarm atau menembus mode senyap. WhatsApp ditunda tanpa jadwal yang dijanjikan.
- Data, identitas dan QR pada prototipe merupakan contoh. Tidak ada persyaratan unggah KTP/selfie, rekening merchant, cabang toko atau kebijakan baru yang ditambahkan sebagai requirement.

## Pemeriksaan dan batas verifikasi

### Tambahan permintaan mobile dan foto item

Katalog/detail perangkat dan pengelolaan item admin diperbarui menjadi `v3 Foto item`: foto iPhone dan aksesori terlihat pada desain, termasuk foto utama detail serta thumbnail galeri. Foto prototipe merupakan ilustrasi; gunakan foto inventaris yang sah saat rilis.

Versi mobile setiap halaman tersedia dengan kode `MA01–MA10` untuk admin dan `MC01–MC07` untuk pelanggan; masing-masing mengikuti fungsi layar desktop dengan nomor sama. `M01` dan `M02` tetap menjadi contoh antrean/pembayaran mobile sebelumnya. Status hasil akhir dan ID layar merujuk `screens.latest.json`.

| Fungsi | Admin mobile | Pelanggan mobile |
|---|---|---|
| Antrean / dashboard | [MA01](docs/design/previews/MA01.html) | [MC01](docs/design/previews/MC01.html) |
| Pembayaran / katalog | [MA02](docs/design/previews/MA02.html) | [MC02](docs/design/previews/MC02.html) |
| Jadwal / buat booking | [MA03](docs/design/previews/MA03.html) | [MC03](docs/design/previews/MC03.html) |
| Pengembalian / bayar | [MA04](docs/design/previews/MA04.html) | [MC04](docs/design/previews/MC04.html) |
| Perpanjangan / detail booking | [MA05](docs/design/previews/MA05.html) | [MC05](docs/design/previews/MC05.html) |
| Refund / autentikasi | [MA06](docs/design/previews/MA06.html) | [MC06](docs/design/previews/MC06.html) |
| Item dan foto / profil | [MA07](docs/design/previews/MA07.html) | [MC07](docs/design/previews/MC07.html) |
| Penyewa dan akun | [MA08](docs/design/previews/MA08.html) | — |
| Laporan | [MA09](docs/design/previews/MA09.html) | — |
| Pengaturan dan PWA | [MA10](docs/design/previews/MA10.html) | — |

Aturan mobile dan foto di [bagian 10 panduan desain](docs/design/PASTEL_WORKSPACE.md) mencakup foto produk yang terlihat, satu kolom, navigasi ringkas, target sentuh 44px, padding 20px, ruang safe area, zoom tetap aktif, dan tindakan/deadline yang tidak tertutup navigasi. Pemeriksaan implementasi perlu mencakup lebar 360 dan 390px serta state gambar loading/gagal.

Canvas telah diperiksa berisi **36 layar FIX**, termasuk seluruh 17 adaptasi mobile. Ekspor HTML dan PNG tersimpan untuk setiap layar. Versi tepat tercantum pada registry; A07 dan C02 memakai `v3 Foto item`, sedangkan adaptasi mobile telah melalui revisi `Reviewed`/`Final`. HTML seluruh layar mengimpor Poppins; viewport adaptasi mobile tidak menonaktifkan pinch zoom. Foto katalog/detail dan thumbnail ringkasan diperiksa melalui screenshot dan HTML. Teks dievaluasi lalu direvisi untuk memperbaiki deadline, nominal, alur pembayaran, refund, stok dan pengembalian yang bertentangan dengan PRD.

Ini **prototipe visual**, bukan aplikasi dengan fungsi yang telah berjalan. Cakupan pada tabel berarti fungsi diwakili dalam desain; tidak berarti semua variasi kondisi memiliki layar tersendiri. Tautan/tombol ekspor tidak membuktikan alur aplikasi. Kontras, ukuran setiap teks, seluruh breakpoint dan semua state belum diuji secara menyeluruh.

Saat implementasi frontend, hubungkan route dan tindakan dengan backend, pertahankan otorisasi server, privasi bukti, transaksi serta penguncian stok. Verifikasi state loading/error/kosong/offline, aksesibilitas, tampilan responsif, ekspor laporan dan PWA pada perangkat nyata. Ambil data toko serta pengaturan pembayaran dari konfigurasi yang sah.
