# Design System: iRent Semarang

## 1. Tujuan dan sumber acuan

Dokumen ini mengatur tampilan website pelanggan dan admin PWA, termasuk prompt Stitch dan implementasi React/Tailwind/shadcn. `PRD.md` tetap sumber aturan bisnis; desain tidak boleh menambahkan kebijakan pembayaran, refund, stok, atau notifikasi baru. Jika kebutuhan visual berkonflik dengan alur bisnis, pertahankan perilaku PRD dan ubah penyajian informasi.

Gunakan Taste untuk membuat antarmuka yang tenang, lapang, dan mudah dipindai. Prioritaskan spacing, hierarki, dan keterbacaan. Tema pink pastel dipertahankan. **Poppins digunakan untuk seluruh UI**, termasuk angka, tabel, form, tombol, dialog, navigasi, dan notifikasi dalam aplikasi.

Enam layar Stitch berlabel FIX adalah referensi alur, bukan standar visual final. Tata letaknya perlu mengikuti dokumen ini sebelum implementasi. Jangan memindahkan semua rincian PRD ke dashboard.

## 2. Arah visual

- Density: 4/10 untuk pelanggan; 5/10 untuk admin. Data banyak disajikan melalui filter, pagination, dan detail, bukan mengecilkan font.
- Variance: 3/10. Gunakan grid yang konsisten dengan penekanan berbeda sesuai prioritas, bukan asimetri dekoratif.
- Motion: 2/10. Respons interaksi singkat; tidak ada animasi berulang yang mengganggu pekerjaan.
- Satu fokus utama per halaman. Pengguna harus memahami tindakan berikutnya sebelum membaca rincian.
- Permukaan putih dominan; pink membingkai identitas dan pilihan aktif. Jangan membuat semua panel, border, dan tombol berwarna pink sekaligus.

## 3. Warna dan perannya

| Token | Nilai | Penggunaan |
|---|---|---|
| `brand` | `#F28CB1` | Identitas, aksen terpilih; gunakan teks gelap |
| `brand-soft` | `#FBD3E1` | Latar seleksi dan penekanan ringan |
| `canvas` | `#FFF5F8` | Latar halaman pelanggan dan admin |
| `sidebar` | `#FFF0F5` | Navigasi admin |
| `surface` | `#FFFFFF` | Konten, form, tabel, dialog |
| `ink` | `#3A2A33` | Teks utama |
| `muted` | `#75636D` | Metadata dan teks pendukung |
| `border` | `#E8DCE2` | Pemisah dan batas input |
| `action` | `#963D63` | Tombol utama dan tautan penting; teks putih |
| `action-hover` | `#803351` | Hover tombol utama |
| `success-ink` / `success-bg` | `#176345` / `#EAF6EF` | Keberhasilan dan keadaan siap |
| `warning-ink` / `warning-bg` | `#855300` / `#FFF5DF` | Tenggat mendekat atau butuh pemeriksaan |
| `danger-ink` / `danger-bg` | `#A12A39` / `#FFF0F1` | Kesalahan, tindakan berisiko, konflik operasional |

Rose adalah satu keluarga aksen merek. Hijau, amber, dan merah hanya warna semantik, bukan dekorasi setiap modul. Status selalu memiliki label; warna tidak menjadi satu-satunya pembeda. Tidak ada neon, gradient teks, glow, atau latar hitam murni. Verifikasi kontras pasangan warna pada implementasi: minimal 4.5:1 untuk teks biasa dan 3:1 untuk teks besar serta indikator kontrol yang relevan. Nilai token bukan bukti kelulusan aksesibilitas.

## 4. Tipografi: Poppins penuh

Gunakan `font-family: 'Poppins', sans-serif` secara global dan `font: inherit` pada kontrol native. Font fallback hanya berlaku saat Poppins belum termuat. Jangan menambahkan Inter, font serif, atau font monospace pada bagian angka. Logo berbentuk gambar tidak harus diketik ulang.

| Peran | Desktop | Mobile | Weight / line-height |
|---|---|---|---|
| Judul halaman | 28–32 px | 24–28 px | 600 / 1.25 |
| Judul seksi | 20–22 px | 18–20 px | 600 / 1.35 |
| Judul item/panel | 16–18 px | 16 px | 500–600 / 1.4 |
| Isi utama | 16 px | 16 px | 400 / 1.6 |
| Isi tabel dan metadata | 14 px | 14 px | 400–500 / 1.5 |
| Label kontrol/tombol | 14–16 px | 14–16 px | 500 / 1.4 |
| Angka ringkasan | 24–28 px | 22–24 px | 600 / 1.25 |

Muat weight 400, 500, dan 600 dengan `font-display: swap`. Jangan memakai bold pada seluruh paragraf. Judul memakai sentence case; hindari blok huruf kapital. Gunakan tracking normal untuk body; judul besar boleh `-0.02em`. Paragraf maksimal 65ch. Angka rupiah, jam, dan kolom nominal memakai `font-variant-numeric: tabular-nums`; periksa dukungan berkas Poppins yang dipilih. Tetap gunakan Poppins jika fitur angka tabular tidak tersedia, dengan alignment kanan dan ruang kolom yang cukup.

Deadline, nominal, status, dan action tidak boleh dikecilkan di bawah 14 px atau disembunyikan dengan ellipsis. Format contoh: **Rp120.000**, **10 Okt 2026, 11.30 WIB**. Jangan memakai ukuran 10–12 px untuk memaksakan data masuk.

## 5. Spacing dan batas halaman

Gunakan skala spacing **4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px**. Jarak mengikuti hubungan konten: label dekat dengan input; kelompok berbeda berjarak lebih besar.

| Area | Desktop ≥1024 px | Tablet 768–1023 px | Mobile <768 px |
|---|---|---|---|
| Padding kiri/kanan halaman | 32 px; 40 px pada layar lebar | 24 px | 20 px; 16 px jika lebar <360 px |
| Padding atas konten setelah header | 32 px | 24 px | 24 px |
| Padding bawah konten | 48 px | 40 px | 32 px + ruang navigasi tetap/safe area |
| Jarak antarseksi | 32–40 px | 32 px | 24–32 px |
| Jarak grid/panel | 24 px | 20 px | 16 px |
| Padding panel utama | 24 px | 24 px | 20 px |
| Jarak dalam kelompok form | 16–24 px | 16–24 px | 16–24 px |

Konten pelanggan maksimal **1200 px**, konten admin maksimal **1360 px** di area setelah sidebar. Keduanya memakai margin horizontal otomatis. Sidebar desktop 240 px dan tidak dihitung sebagai padding halaman. Pada tablet gunakan navigasi ringkas/drawer agar konten tidak terjepit. Ruang kosong adalah bagian layout, bukan tempat untuk menambah widget.

Gunakan CSS Grid untuk pembagian kolom. Desktop boleh memiliki area utama dan pendukung dengan rasio sekitar **2:1**, hanya jika keduanya cukup lebar. Di bawah 768 px, panel dan kelompok form menjadi satu kolom. Hindari tinggi panel yang dipaksakan sama untuk konten berbeda. Header halaman terdiri dari judul, satu kalimat konteks opsional, dan action; berjarak 24–32 px dari konten pertama.

## 6. Hierarki dan kepadatan dashboard

### Pelanggan

Urutan: **tindakan booking paling mendesak → sewa aktif/booking terdekat → ringkasan singkat → akses katalog**. Tampilkan satu tindakan utama, misalnya **Bayar & unggah bukti**. Booking lain masuk daftar ringkas dengan tautan detail, bukan kumpulan kartu besar dengan penekanan sama.

Kartu tindakan utama hanya memuat item, status, jadwal, nominal wajib saat ini, deadline, dan tombol. Penjelasan panjang kebijakan ada pada detail/ketentuan. Dashboard bukan halaman katalog lengkap: tampilkan akses **Cari perangkat** atau preview terbatas; katalog lengkap memiliki halaman sendiri. Aturan penting sebelum transaksi tetap terlihat pada booking/payment, tidak disembunyikan demi tampilan minimal.

### Admin

Urutan: **tugas yang paling mendesak → antrean tindakan → jadwal hari ini → ringkasan kas dan kondisi unit**. Satu alert utama boleh mengelompokkan beberapa kasus dengan akses ke daftar lengkap. Jangan menumpuk banner per kasus.

Gunakan maksimal **empat metrik ringkas** pada ringkasan awal; sisa metrik masuk halaman terkait. Metrik tidak memakai kartu besar seperti action utama. Antrean dashboard menampilkan sampai lima baris lalu **Lihat semua**; seluruh antrean tersedia pada halaman daftar. Detail uang, identitas, bukti, dan riwayat berada pada halaman detail/drawer.

Deadline kritis mendapat penekanan semantik. Tugas biasa menggunakan permukaan netral. Jangan memakai tombol primary pada setiap baris: action baris memakai tombol sekunder, sedangkan tugas utama mendapat primary. Alert kondisi fisik tetap terpisah dari status pembayaran/refund.

## 7. Komponen

- **Tombol:** tinggi minimal 44 px, padding horizontal 16–20 px, radius 10 px. Primary rose gelap/teks putih; secondary outline netral; tertiary tautan. Maksimal satu primary per kelompok tindakan. Label menyebut tindakan, misalnya **Periksa pembayaran**, bukan **Proses**.
- **Panel:** radius 16 px, permukaan putih, border netral tipis jika perlu. Hindari border + shadow + tint sekaligus. Shadow hanya untuk elemen mengambang: `0 8px 24px rgba(58,42,51,0.08)`.
- **Input/select:** label di atas, gap label 8 px, tinggi minimal 44 px, radius 10 px, font 16 px. Helper/error berjarak 8 px di bawah. Tidak mengandalkan placeholder sebagai label. Kelompokkan tanggal/jam/durasi dengan ruang yang cukup.
- **Badge:** label singkat 14 px, padding 4 px 8 px, radius 6 px. Hindari badge untuk setiap metadata. Badge dapat wrap; jangan menghilangkan bagian status penting.
- **Tabel:** font minimal 14 px, padding sel 12–16 px, header 500, nominal rata kanan. Prioritaskan pelanggan/kode, status, deadline, action. Batasi jumlah kolom dashboard; rincian lewat detail. Mobile menjadi daftar terstruktur; jangan mengecilkan tabel desktop.
- **Baris unit:** kode, kondisi fisik, dan waktu penting terbaca lengkap. Tampilkan empat sampai lima unit relevan dengan akses daftar penuh. Tidak mencampurkan refund atau nominal bukti ke panel stok.
- **Ikon:** satu set konsisten mengikuti komponen proyek, ukuran 20–24 px, stroke konsisten. Ikon dekoratif tidak menggantikan label. Tombol ikon memiliki accessible name dan target 44 px.
- **Modal/drawer:** gunakan untuk tugas singkat. Alur panjang, multi-unit, atau bukti + riwayat menggunakan halaman detail. Footer action tidak boleh menutupi isi; cancel dan submit terlihat jelas.

Hindari kartu di dalam kartu di dalam kartu. Gunakan pemisah, heading kecil, dan ruang kosong untuk membagi rincian di dalam panel.

## 8. Responsif dan aksesibilitas

Uji layout pada **360, 390, 768, 1024, dan 1440 px**. Tidak ada horizontal overflow pada halaman. Katalog mobile memakai grid satu kolom, bukan carousel yang memotong produk. Tabel laporan yang memang lebar boleh scroll dalam container berlabel, bukan membuat seluruh halaman bergeser.

Navigasi bawah mobile maksimal empat sampai lima tujuan utama. Konten mendapat padding bawah sebesar tinggi navigasi + 24 px + safe area. Elemen sticky tidak menutupi action, input fokus, atau deadline. Jangan memakai tinggi layar tetap; jika diperlukan gunakan `min-height: 100dvh` dan biarkan konten memanjang.

Seluruh action dapat dijangkau keyboard. Focus ring rose gelap 2 px dengan offset 2 px harus terlihat. Urutan fokus mengikuti urutan baca. Jangan menonaktifkan zoom. Informasi harus tetap terbaca dan action terjangkau pada zoom 200%. Kondisi disabled memiliki alasan yang terbaca. Toast melengkapi status inline, bukan satu-satunya bukti transaksi berhasil.

## 9. Motion dan keadaan UI

Hover/focus/pressed: **120–180 ms**; drawer/dialog: **180–240 ms**, easing `cubic-bezier(0.2,0,0,1)`. Gunakan opacity/transform untuk perpindahan, tanpa menggeser layout. Tombol boleh `translateY(1px)` saat ditekan. Tidak perlu menambah library animasi untuk interaksi ini.

Tidak ada pulse countdown, ticker kas, floating card, parallax, reveal setiap baris, atau loop dekoratif. Hormati `prefers-reduced-motion` dengan menghapus animasi nonesensial. Countdown berubah tenang tanpa mengumumkan setiap detik ke screen reader; perubahan status penting diumumkan seperlunya.

Desain wajib mencakup loading, empty, error, disabled, submitting, dan success. Skeleton mengikuti dimensi akhir. Upload/submitting menampilkan teks proses, mencegah submit berulang, serta mempertahankan pilihan pengguna saat gagal. Empty state menjelaskan keadaan dan action yang relevan, tanpa ilustrasi besar yang memenuhi dashboard. PWA offline menampilkan status dan membatasi action sesuai PRD, tidak membuat transaksi seolah berhasil.

## 10. Konten dan batas bisnis

Gunakan bahasa Indonesia yang langsung, hangat, dan ringkas. Teks tombol memakai verba. Data ilustrasi diberi label **Data contoh**; jangan menampilkan NIK, bukti privat, kontak nyata, QRIS pembayaran aktif, atau alamat/rekening rekaan sebagai informasi toko yang sah.

- Pelanggan dapat membayar/upload setelah booking berhasil; tidak menunggu izin admin.
- Bedakan **Dipesan — menunggu pembayaran**, **Menunggu verifikasi pembayaran**, dan **Booking dikonfirmasi**.
- Bedakan ketersediaan kalender dan kesiapan fisik. Laporan pelanggan belum membuat unit ready; admin memverifikasi, lalu persiapan satu jam untuk unit layak.
- Refund disetujui masih menunggu transfer; **Uang sudah dikembalikan** hanya setelah admin mencatat transfer aktual.
- Tampilkan waktu absolut WIB bersama countdown. Upload tepat waktu tidak kehilangan alokasi karena admin terlambat.
- Tarif tidak berbeda pada weekday/weekend. Paket 6/12/24 jam mengikuti jadwal yang valid; misalnya pickup 11.30 membuat paket 12 jam nonaktif karena kembali 23.30.
- Perpanjangan tetap per unit, memeriksa bentrok, dan tidak mengubah jadwal lama sebelum approval sesuai PRD.

Tidak menambahkan badge KTP terverifikasi, deposit keamanan, refund otomatis/SLA tetap, gratis ongkir, garansi resmi, panggilan WhatsApp otomatis, atau kebijakan lain yang belum disepakati. Nominal dan persentase kebijakan PRD tidak boleh diubah demi terlihat lebih alami.

## 11. Larangan visual

Jangan gunakan font selain Poppins pada UI; teks putih pada pink pastel; semua elemen bold; judul besar tanpa fungsi; emoji sebagai ikon operasional; border pink pada semua panel; shadow/glow berlebihan; tiga kartu promosi seragam; konten menempel tepi layar; teks/status penting terpotong; tombol mobile terlalu kecil; hero marketing pada dashboard; dekorasi yang bersaing dengan deadline.

Jangan memperbaiki kepadatan dengan memperkecil seluruh UI. Kurangi informasi awal, kelompokkan, dan sediakan detail tanpa menghilangkan informasi yang diperlukan untuk keputusan pengguna.

## 12. Checklist review dan penggunaan di Stitch

Sebelum menyetujui layar:

- [ ] Poppins konsisten pada seluruh teks dan kontrol.
- [ ] Padding empat sisi, max-width, dan ruang navigasi tetap sesuai aturan.
- [ ] Tindakan terpenting jelas; penekanan lain tidak bersaing.
- [ ] Font, target sentuh, status, nominal, dan deadline terbaca.
- [ ] Ringkasan dashboard tidak berubah menjadi seluruh halaman operasional.
- [ ] Tidak ada nested card berlebihan, clipping, atau overflow halaman.
- [ ] Label, keyboard focus, kontras terukur, zoom, dan reduced motion diperiksa pada implementasi.
- [ ] Keadaan loading/empty/error/disabled dan alur PRD konsisten.

Untuk prompt Stitch, lampirkan dokumen ini dan sebutkan **satu layar, tujuan pengguna, action utama, data penting, serta keadaan UI** yang ingin dirancang. Minta screenshot utuh dan HTML. Periksa hasil visual serta teksnya; pesan sukses generator bukan bukti kepatuhan. Jika Poppins belum tersedia dalam pilihan font bawaan Stitch, minta penggunaan Poppins pada HTML dan periksa hasil ekspor; jangan mengganti keputusan font dengan Inter.
