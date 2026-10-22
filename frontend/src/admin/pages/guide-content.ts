export const guideGroups = [
  { id: 'harian', label: 'Operasional harian' },
  { id: 'transaksi', label: 'Transaksi lanjutan' },
  { id: 'perangkat', label: 'Akun & perangkat' },
] as const;
interface GuideTopic {
  id: string;
  group: (typeof guideGroups)[number]['id'];
  title: string;
  summary: string;
  steps: { title: string; text: string }[];
  note: { title: string; text: string };
  path: string;
  action: string;
  related?: { path: string; label: string };
}
export const guideTopics: GuideTopic[] = [
  {
    id: 'mulai',
    group: 'harian',
    title: 'Mulai bertugas',
    summary:
      'Mulai dari pekerjaan yang paling dekat tenggatnya, lalu periksa jadwal unit.',
    steps: [
      {
        title: 'Periksa antrean di beranda',
        text: 'Lihat pembayaran yang menunggu pemeriksaan, pengambilan, pengembalian, dan pekerjaan yang terlambat. Buka booking terkait sebelum mengambil tindakan.',
      },
      {
        title: 'Cocokkan jadwal dan kondisi barang',
        text: 'Periksa kalender unit untuk pengambilan dan pengembalian hari ini. Pastikan kondisi fisik sesuai dengan status yang tercatat.',
      },
      {
        title: 'Siapkan pengingat perangkat',
        text: 'Aktifkan notifikasi PWA di perangkat yang digunakan. Jika perlu, tekan Aktifkan suara di beranda agar pengingat berbunyi saat tab aktif.',
      },
    ],
    note: {
      title: '“Saya tangani” bukan persetujuan',
      text: 'Tombol ini hanya membisukan pengingat di tab tersebut. Keputusan pembayaran tetap dilakukan pada booking.',
    },
    path: '/admin/',
    action: 'Buka pekerjaan hari ini',
    related: { path: '/admin/calendar', label: 'Lihat kalender unit' },
  },
  {
    id: 'pembayaran',
    group: 'harian',
    title: 'Verifikasi pembayaran',
    summary:
      'Pastikan uang benar-benar diterima sebelum menyetujui bukti pelanggan.',
    steps: [
      {
        title: 'Buka bukti pada booking',
        text: 'Cocokkan pemilik booking, nominal yang ditagihkan, dan bukti yang diunggah. Perhatikan batas waktu pemeriksaannya.',
      },
      {
        title: 'Cek transaksi masuk',
        text: 'Periksa rekening atau catatan penerimaan toko. Catat nominal aktual, waktu, metode, rekening toko, dan referensi transaksi yang sesuai.',
      },
      {
        title: 'Setujui atau tolak dengan alasan',
        text: 'Setujui setelah dana terverifikasi. Jika bukti tidak sesuai, tolak dengan alasan yang jelas. Pembayaran kurang tetap memerlukan pelengkapan.',
      },
    ],
    note: {
      title: 'Bukti unggahan belum berarti lunas',
      text: 'Gunakan saldo dan status pembayaran di booking. Jangan menganggap nominal pada gambar sebagai uang yang sudah masuk.',
    },
    path: '/admin/bookings',
    action: 'Buka booking & pembayaran',
  },
  {
    id: 'serah-terima',
    group: 'harian',
    title: 'Serah terima & kembali',
    summary:
      'Catat perpindahan barang berdasarkan pemeriksaan fisik, per unit.',
    steps: [
      {
        title: 'Periksa syarat sebelum menyerahkan',
        text: 'Pastikan biaya sewa dan ongkir lunas, unit siap, serta jadwal sesuai. Cocokkan identitas pelanggan dan kondisi barang.',
      },
      {
        title: 'Catat serah terima pada booking',
        text: 'Pilih unit yang diserahkan dan masukkan waktu aktual serta catatan kondisi. Pastikan barang benar-benar diterima pelanggan atau petugas.',
      },
      {
        title: 'Verifikasi barang yang kembali',
        text: 'Periksa setiap unit. Catat waktu penerimaan fisik, kondisi, kerusakan, dan pengecualian keterlambatan akibat toko bila ada, lalu verifikasi pengembalian.',
      },
    ],
    note: {
      title: 'Laporan pelanggan belum melepas unit',
      text: 'Status barang tetap tertahan sampai admin memverifikasi pengembalian. Barang layak masih harus melalui persiapan sebelum siap disewakan lagi.',
    },
    path: '/admin/bookings',
    action: 'Buka detail booking',
    related: { path: '/admin/calendar', label: 'Periksa jadwal unit' },
  },
  {
    id: 'persiapan',
    group: 'harian',
    title: 'Persiapan & perawatan',
    summary:
      'Pastikan barang layak dan selesai disiapkan sebelum mengubahnya menjadi siap sewa.',
    steps: [
      {
        title: 'Pisahkan barang layak dan rusak',
        text: 'Saat verifikasi pengembalian, masukkan unit layak ke persiapan. Unit dengan kerusakan yang perlu ditangani masuk perawatan.',
      },
      {
        title: 'Lakukan persiapan selama satu jam',
        text: 'Periksa isi paket dan fungsi perangkat. Unit belum bisa dilepas sebagai siap sewa selama jeda persiapan belum selesai.',
      },
      {
        title: 'Selesaikan pemeriksaan secara eksplisit',
        text: 'Setelah waktunya terpenuhi, pastikan pemeriksaan selesai dan gunakan aksi selesai persiapan. Selesai perawatan juga memulai persiapan satu jam.',
      },
    ],
    note: {
      title: 'Waktu habis tidak otomatis membuat unit siap',
      text: 'Persetujuan admin tetap diperlukan setelah pemeriksaan. Perhatikan juga alokasi dan jadwal booking berikutnya.',
    },
    path: '/admin/inventory',
    action: 'Kelola persiapan unit',
  },
  {
    id: 'perpanjangan',
    group: 'transaksi',
    title: 'Perpanjangan & risiko',
    summary:
      'Periksa jadwal berikutnya dan persetujuan dana sebelum memperpanjang sewa.',
    steps: [
      {
        title: 'Periksa unit dan jadwal yang diajukan',
        text: 'Buka permintaan perpanjangan. Pastikan unit serta waktu tambahan sesuai dan tidak mengganggu booking lain. Perpanjangan berlaku pada unit yang dipilih.',
      },
      {
        title: 'Selesaikan persetujuan ongkir dan dana',
        text: 'Penjemputan terpisah memerlukan quotation ongkir dan persetujuan pelanggan. Verifikasi dana yang diterima sebelum menyetujui seluruh unit dalam permintaan.',
      },
      {
        title: 'Tindak lanjuti kendala unit',
        text: 'Jika barang terlambat atau tidak siap untuk pelanggan berikutnya, periksa penggantian unit dari model yang sama. Jika tidak dapat dipenuhi, gunakan alur pembatalan oleh toko.',
      },
    ],
    note: {
      title: 'Pengajuan belum mengubah jadwal sewa',
      text: 'Perpanjangan baru berlaku setelah dana dan seluruh unit disetujui. Jangan menjanjikan tambahan waktu hanya berdasarkan bukti unggahan.',
    },
    path: '/admin/extensions',
    action: 'Periksa perpanjangan',
    related: { path: '/admin/risks', label: 'Buka risiko operasional' },
  },
  {
    id: 'refund',
    group: 'transaksi',
    title: 'Refund manual',
    summary:
      'Persetujuan refund dan pencatatan uang kembali adalah dua langkah terpisah.',
    steps: [
      {
        title: 'Periksa pengajuan dan rekening penerima',
        text: 'Cocokkan alasan, sumber dana, rekening penerima, dan jumlah yang memenuhi kebijakan booking sebelum memberikan persetujuan.',
      },
      {
        title: 'Lakukan transfer melalui bank',
        text: 'Setelah refund disetujui, petugas mengembalikan uang melalui layanan bank di luar aplikasi. Sistem tidak menjalankan transfer otomatis.',
      },
      {
        title: 'Catat uang yang sudah dikembalikan',
        text: 'Masukkan jumlah aktual, waktu, referensi, dan bukti transfer privat. Selesaikan pencatatan agar saldo dan status refund diperbarui.',
      },
    ],
    note: {
      title: 'Disetujui belum berarti sudah ditransfer',
      text: 'Gunakan aksi pencatatan pengembalian dana hanya setelah transfer benar-benar dilakukan.',
    },
    path: '/admin/refunds',
    action: 'Buka antrean refund',
  },
  {
    id: 'laporan',
    group: 'transaksi',
    title: 'Koreksi & laporan',
    summary:
      'Perbaiki kesalahan pencatatan dengan jejak yang tetap bisa diperiksa.',
    steps: [
      {
        title: 'Cari transaksi pada detail booking',
        text: 'Jika nominal penerimaan atau data pengembalian salah, buka transaksi aslinya dan pilih alur koreksi yang sesuai.',
      },
      {
        title: 'Isi alasan dan data pengganti',
        text: 'Periksa perubahan sebelum menyimpan. Koreksi receipt mempertahankan catatan asli, menambah pembalik dan pengganti, lalu menghitung ulang saldo.',
      },
      {
        title: 'Cocokkan laporan dan unduh Excel',
        text: 'Gunakan periode laporan yang diperlukan. Laporan kas mengikuti waktu uang masuk dan keluar; lihat status selesai dan lunas sesuai kebutuhan rekonsiliasi.',
      },
    ],
    note: {
      title: 'Riwayat asli tetap tersimpan',
      text: 'Koreksi receipt tidak otomatis mengganti jadwal atau status booking yang sudah berjalan.',
    },
    path: '/admin/reports',
    action: 'Buka laporan transaksi',
    related: { path: '/admin/bookings', label: 'Cari booking untuk koreksi' },
  },
  {
    id: 'notifikasi',
    group: 'perangkat',
    title: 'Notifikasi perangkat',
    summary: 'Siapkan pengingat di perangkat yang digunakan untuk bertugas.',
    steps: [
      {
        title: 'Pasang aplikasi jika diperlukan',
        text: 'Gunakan ajakan pemasangan di aplikasi. Pada iPhone, buka melalui Safari, pilih Bagikan lalu Tambahkan ke Layar Utama, dan buka iRent dari ikon tersebut.',
      },
      {
        title: 'Aktifkan izin notifikasi',
        text: 'Buka Notifikasi PWA dan aktifkan dari perangkat ini. Jika izin pernah ditolak, periksa pengaturan browser atau sistem operasi.',
      },
      {
        title: 'Gunakan suara saat dashboard aktif',
        text: 'Tekan Aktifkan suara di beranda bila diperlukan. Tetap periksa antrean secara berkala, termasuk pekerjaan yang sudah terlambat.',
      },
    ],
    note: {
      title: 'Push bukan alarm yang dijamin berbunyi',
      text: 'Notifikasi dapat terlambat dan mengikuti pengaturan perangkat. Suara berulang hanya berjalan saat tab aktif; tidak melewati mode senyap atau Focus.',
    },
    path: '/admin/notifications',
    action: 'Atur notifikasi PWA',
  },
  {
    id: 'keamanan',
    group: 'perangkat',
    title: 'Password & akses akun',
    summary: 'Ganti password sendiri melalui halaman Akun saya.',
    steps: [
      {
        title: 'Buka Keamanan akun',
        text: 'Pilih Ganti password, lalu isi password lama yang sedang digunakan untuk masuk ke akun ini.',
      },
      {
        title: 'Masukkan password baru dan konfirmasi',
        text: 'Gunakan minimal delapan karakter dan password yang berbeda dari sebelumnya. Ulangi password baru; ikon mata membantu memeriksa isian.',
      },
      {
        title: 'Masuk kembali di perangkat yang digunakan',
        text: 'Setelah berhasil, seluruh sesi akun diakhiri. Masuk dengan password baru dan aktifkan kembali notifikasi PWA bila diperlukan.',
      },
    ],
    note: {
      title: 'Ganti password sendiri berbeda dari reset pelanggan',
      text: 'Reset password pelanggan dilakukan melalui detail pelanggan oleh admin. Perubahan password sendiri selalu meminta password lama.',
    },
    path: '/admin/account',
    action: 'Buka keamanan akun',
  },
];
