import { Link } from 'react-router-dom';
export function GuidePage() {
  const sections = [
    {
      title: 'Mulai bertugas',
      text: 'Periksa pekerjaan di beranda dan kalender unit. Aktifkan suara secara manual jika diperlukan. “Saya tangani” hanya membisukan pengingat di tab ini.',
      path: '/admin',
      label: 'Buka pekerjaan',
    },
    {
      title: 'Verifikasi pembayaran',
      text: 'Buka bukti dan cocokkan uang yang benar-benar masuk. Catat nominal, waktu, metode, rekening toko dan referensi transaksi. Bukti unggahan belum berarti lunas; pembayaran kurang tetap memerlukan pelengkapan.',
      path: '/admin/bookings',
      label: 'Buka booking',
    },
    {
      title: 'Serah terima dan pengembalian',
      text: 'Serahkan barang setelah sewa dan ongkir lunas serta unit siap. Periksa identitas dan kondisi. Saat kembali, verifikasi setiap unit dengan waktu penerimaan fisik, kondisi, kerusakan dan pengecualian keterlambatan toko. Laporan pelanggan belum melepas unit.',
      path: '/admin/calendar',
      label: 'Periksa jadwal',
    },
    {
      title: 'Persiapan dan perawatan',
      text: 'Unit layak yang kembali menjalani persiapan satu jam. Selesaikan pemeriksaan secara eksplisit setelah waktunya; unit tidak otomatis siap. Unit rusak masuk perawatan dan kembali menjalani persiapan setelah perawatan selesai.',
      path: '/admin/inventory',
      label: 'Kelola unit',
    },
    {
      title: 'Perpanjangan dan risiko',
      text: 'Perpanjangan berlaku setelah dana dan seluruh unit disetujui. Penjemputan terpisah memerlukan quotation ongkir dan persetujuan pelanggan. Jika ada kendala unit berikutnya, periksa pengganti dari model yang sama atau pembatalan oleh toko.',
      path: '/admin/extensions',
      label: 'Periksa perpanjangan',
    },
    {
      title: 'Refund manual',
      text: 'Periksa alasan, sumber dana dan rekening penerima, lalu setujui jumlah yang memenuhi kebijakan. Transfer melalui bank dilakukan oleh petugas di luar aplikasi; setelahnya catat jumlah, waktu, referensi dan bukti transfer privat. Persetujuan saja belum berarti uang sudah dikembalikan.',
      path: '/admin/refunds',
      label: 'Proses refund',
    },
    {
      title: 'Koreksi dan laporan',
      text: 'Gunakan koreksi receipt atau pengembalian pada detail booking jika ada salah catat; isi alasan dan data pengganti. Riwayat asli tetap tersimpan. Laporan kas memakai waktu uang masuk/keluar dan dapat diunduh sebagai Excel.',
      path: '/admin/reports',
      label: 'Buka laporan',
    },
    {
      title: 'Notifikasi perangkat',
      text: 'Aktifkan notifikasi dari perangkat saat bertugas. Pada iPhone, tambahkan aplikasi ke layar utama melalui Safari lalu buka dari sana. Izin dapat ditolak atau dinonaktifkan di pengaturan perangkat. Tetap periksa pekerjaan karena push dapat terlambat.',
      path: '/admin/notifications',
      label: 'Atur notifikasi',
    },
  ];
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Operasional iRent</p>
        <h1>Panduan admin</h1>
        <p>
          Urutan kerja untuk menjaga jadwal, kondisi unit, dan catatan uang
          tetap sesuai.
        </p>
      </header>
      <div className="management-grid">
        {sections.map((section) => (
          <section key={section.title} className="form-section">
            <h2>{section.title}</h2>
            <p>{section.text}</p>
            <Link className="text-link" to={section.path}>
              {section.label}
            </Link>
          </section>
        ))}
      </div>
    </>
  );
}
