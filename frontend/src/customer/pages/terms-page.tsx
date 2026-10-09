import { LoadingState, ErrorState } from '@/components/feedback';
import { usePolicy } from '../hooks';
import { rupiah } from '../format';
export function TermsPage() {
  const query = usePolicy();
  if (query.isPending) return <LoadingState text="Memuat ketentuan..." />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const rule = query.data.values;
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Sebelum booking</p>
        <h1>Ketentuan sewa</h1>
        <p>Periksa aturan yang berlaku sebelum memilih jadwal.</p>
      </header>
      <div className="terms-content">
        <section>
          <h2>Jadwal dan perangkat</h2>
          <p>
            Pengambilan dan pengembalian mengikuti jam operasional{' '}
            {rule.open_time}-{rule.close_time} WIB. Booking dibuat minimal{' '}
            {rule.min_lead_minutes / 60} jam sebelum pengambilan. Paket tersedia
            untuk 6, 12, dan 24 jam; kelipatan 24 jam hingga{' '}
            {rule.max_duration_hours} jam. Harga sama setiap hari.
          </p>
          <p>
            Maksimal satu iPhone untuk waktu sewa yang beririsan. Aksesori dapat
            ditambahkan. Siapkan KTP/SIM saat pengambilan dan pastikan data
            penyewa lengkap.
          </p>
        </section>
        <section>
          <h2>Pembayaran dan konfirmasi</h2>
          <p>
            DP saat ini {rupiah(rule.dp_amount)}. Jika total booking tidak
            melebihi DP, pembayaran harus lunas. Bukti dapat langsung diunggah
            setelah booking, tanpa menunggu persetujuan admin. Tenggat upload
            ditampilkan pada halaman pembayaran.
          </p>
          <p>
            Upload belum berarti uang terverifikasi. Admin memeriksa uang masuk
            sebelum konfirmasi booking. Pelunasan sewa dan ongkir harus selesai
            sebelum serah terima.
          </p>
        </section>
        <section>
          <h2>Pembatalan dan refund</h2>
          <p>
            Pembatalan pelanggan minimal {rule.cancel_refund_cutoff_days} hari
            sebelum pengambilan dapat memenuhi kebijakan refund:{' '}
            {rule.cancel_refund_percent}% dana DP yang memenuhi syarat, atau{' '}
            {rule.cancel_full_refund_percent}% dana pembayaran penuh yang
            memenuhi syarat. Setelah cutoff, refund pembatalan pelanggan tidak
            berlaku. Dana berlebih dan pembatalan oleh toko mengikuti
            perhitungan server.
          </p>
          <p>
            Refund membutuhkan persetujuan admin dan transfer manual. Status
            uang dikembalikan hanya muncul setelah transfer dicatat, bukan
            ketika permintaan disetujui.
          </p>
        </section>
        <section>
          <h2>Pengembalian dan perpanjangan</h2>
          <p>
            Pengembalian pelanggan diperiksa admin. Unit yang layak menjalani
            persiapan satu jam sebelum siap disewa kembali. Keterlambatan
            mengikuti toleransi {rule.late_tolerance_minutes} menit dan tarif{' '}
            {rupiah(rule.late_fee_per_hour)} per jam sesuai kebijakan;
            keterlambatan petugas tidak dibebankan kepada pelanggan.
          </p>
          <p>
            Perpanjangan diajukan per item, membutuhkan pemeriksaan bentrok
            jadwal, pembayaran, dan persetujuan admin. Jadwal lama berlaku
            sampai perpanjangan disetujui.
          </p>
        </section>
      </div>
    </>
  );
}
