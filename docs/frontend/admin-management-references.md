# Referensi perapian halaman manajemen admin

Palet tetap putih, hitam, dan #FF4081; Poppins mengikuti pilihan pengguna. Referensi dipakai untuk susunan informasi dan interaksi, dengan aturan transaksi tetap mengikuti PRD iRent.

| Halaman | Referensi | Pola yang diterapkan |
| --- | --- | --- |
| Jadwal unit | [Booqable availability calendar](https://help.booqable.com/en/articles/4103695-how-to-view-availability-on-the-calendar) | Timeline per unit, rentang tanggal, blok sewa dan buffer; status fisik dibedakan dari alokasi. |
| Perpanjangan | [Booqable order workflow](https://help.booqable.com/en/articles/3845244-the-booqable-order-workflow) | Antrean pengajuan dengan tahap ongkir, pembayaran, verifikasi dan persetujuan; detail mengacu jadwal tiap unit. |
| Refund | [Shopify returns and exchanges](https://help.shopify.com/en/manual/fulfillment/managing-orders/returns) | Keputusan dan transfer dipisah, nominal diajukan/disetujui dibedakan, akses ke detail booking. |
| Risiko dan tindak lanjut | [Booqable rental workflow/features](https://booqable.com/features/) | Status unit dan penyebab risiko diprioritaskan; tindak lanjut delivery terpisah. Tidak menutup booking otomatis dari UI. |
| Data penyewa | [Shopify customers](https://help.shopify.com/en/manual/customers) | Direktori identitas/kontak, status profil, jumlah booking, detail terpisah. NIK tidak muncul di daftar. |
| Akun admin | [Stripe team settings](https://support.stripe.com/questions/invite-team-members-or-developers-to-access-your-stripe-account) | Direktori petugas dan modal pembuatan akun. Sesuai PRD, semua admin iRent memiliki hak yang sama. |
| Laporan dan transaksi | [Stripe refund reports](https://support.stripe.com/questions/exporting-refund-reports?locale=en-GB) | Ringkasan kas per periode, mutasi, koreksi, transaksi berhasil dan ekspor. Refund baru disetujui belum mengurangi kas. |
| Zona ongkir | [Shopify shipping zones](https://help.shopify.com/en/manual/shipping/setting-up-and-managing-your-shipping/setting-up-shipping-zones) | Wilayah, tarif dan status sejajar; pencarian serta tambah/ubah dalam modal. |
| Notifikasi PWA | [Chrome notification permissions](https://support.google.com/chrome/answer/3220216) | Kesiapan perangkat, izin browser, panduan pemasangan dan riwayat pengiriman dipisahkan. |
| Pengaturan | [Shopify shipping/fulfillment settings](https://help.shopify.com/en/manual/fulfillment/setup) | Navigasi per kelompok kebijakan, nilai ringkas dan perubahan melalui form per kelompok; QRIS punya bagian sendiri. |

## Pemeriksaan

- Sepuluh halaman dicek menggunakan data PostgreSQL lokal pada 390px dan 1440px. Screenshot: `admin-<route>-management-<width>.png` pada direktori ini.
- Pengujian browser mencakup data pada semua halaman, filter antrean server, modal zona, pengaturan per kelompok, nilai uang besar, password tersamarkan dan perilaku keyboard.
- Tidak ada migrasi database, penambahan data pelanggan, perubahan status transaksi, atau pengiriman notifikasi nyata dalam proses pengecekan.
