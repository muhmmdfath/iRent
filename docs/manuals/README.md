# Panduan admin iRent

Dokumen untuk pemilik dan petugas toko, bukan panduan API atau pengoperasian server.

- `iRent-Panduan-Lengkap-Admin.pdf`: dokumen siap dibagikan, 47 halaman dan 43 topik operasional.
- `panduan-admin.md`: sumber konten yang dapat diperbarui. Komentar `<!-- page -->` memisahkan halaman cetak; setiap halaman dimulai dengan satu judul `#`.
- `panduan-admin.html`: hasil render untuk inspeksi di browser.
- `manual-outline.json`: judul dan nomor halaman hasil build.
- `build-manual.cjs`: renderer Markdown terbatas dan ekspor PDF menggunakan Playwright serta Poppins lokal.
- `verify-manual.py`: pemeriksaan halaman, tautan daftar isi, bookmark, font, dan kelengkapan teks PDF; membutuhkan PyMuPDF.

Jalankan dari root repositori setelah dependensi frontend tersedia:

```powershell
node docs/manuals/build-manual.cjs
python docs/manuals/verify-manual.py
```

Builder menolak konten yang melewati halaman, mendekati footer, atau memakai gambar yang tidak tersedia. Verifier dapat menyimpan preview ke direktori runtime privat bila diberi `--preview`.

Dasar pemeriksaan: `PRD.md`, dokumentasi modul dalam `backend/`, serta implementasi admin, account, refund, extension, notifikasi, dan inventaris di `frontend/src/`. Screenshot yang dipakai berasal dari dokumentasi dengan data contoh. Hindari screenshot produksi yang mengandung identitas pribadi, credential, atau bukti pembayaran.

Saat fitur atau kebijakan berubah, perbarui sumber Markdown, tanggal edisi, contoh, dan label tindakan. Ekspor ulang PDF lalu periksa secara visual. Nilai pada snapshot dan tenggat transaksi tetap menjadi acuan operasional; contoh bawaan dalam buku tidak menggantikannya.
