# Foto item dan QRIS

`POST /api/admin/items/:id/photo` dan `POST /api/admin/settings/qris-image`: multipart dengan satu field `file`, tanpa field teks, sesi admin/Origin/CSRF. Response `{path,result}` mengembalikan path publik dan hasil update item/settings yang diaudit. Budget upload mengikuti guard upload, 20 per akun per jam.

JPG/PNG/WebP maksimal 5 MB dan 16 megapiksel; isi gambar didekode, format harus cocok dengan MIME, animasi ditolak, metadata dibuang. Foto item menjadi WebP maksimal 2048?2048; QRIS menjadi PNG tanpa resize agar tepi kode tetap jelas. Gambar hasil juga maksimal 5 MB. Nama UUID dibuat server. Attach gagal membersihkan file upload baru. Foto item phase 1 berupa satu cover per model sesuai `photoPath`.

`GET /media/items/<uuid>.webp` atau `/media/qris/<uuid>.png` menyajikan gambar publik; alias `/api/media/...` juga tersedia. Filename/jenis folder dibatasi, respons memakai MIME sesuai hasil, `nosniff`, dan cache immutable. `GET /api/payment-options` hanya memuat `{qrisImagePath}` terkini. QRIS lama dipertahankan untuk snapshot booking yang masih memakai path tersebut.

Atur `MEDIA_STORAGE_DIR=storage/media` pada volume persisten, terpisah tanpa nesting dari `PROOF_STORAGE_DIR`. Multi-instance perlu storage bersama. Deployment harus meneruskan `/media/` ke API, dengan origin gambar sesuai frontend. File bukti pembayaran/refund selalu privat dan tidak menjadi static assets. Jangan menghapus gambar lama yang masih direferensikan snapshot; backup media bersama database dan bukti privat.

Sanitasi menggunakan [Sharp](https://sharp.pixelplumbing.com/api-output/). Penggantian foto tidak mengubah harga/nama snapshot transaksi.
