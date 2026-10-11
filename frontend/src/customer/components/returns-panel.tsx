import { useState } from 'react';
import { api } from '@/services/api';
import { BusinessForm } from '@/components/business-form';
import { Button } from '@/components/ui/button';
import { rupiah, wib } from '../format';
import type { Booking } from '../types';
export function CustomerReturns({ booking }: { booking: Booking }) {
  const [selected, setSelected] = useState<string | null>(null);
  if (!['berjalan', 'selesai'].includes(booking.status)) return null;
  return (
    <section className="form-section">
      <h2>Pengembalian per unit</h2>
      <p className="muted">
        Laporan Anda menunggu pemeriksaan admin. Unit belum tersedia kembali
        sampai penerimaan, pemeriksaan dan persiapan selesai.
      </p>
      {booking.items?.map((item) => (
        <article className="management-row" key={item.id}>
          <div>
            <h3>
              {item.itemNameSnapshot} · {item.unitCodeSnapshot}
            </h3>
            <p>Kembali {wib(item.currentEndAt)}</p>
            {item.useStatus === 'return_pending' && (
              <p className="status-badge">Laporan menunggu pemeriksaan admin</p>
            )}
            {item.returnRecord?.status === 'rejected' && (
              <p className="info-note">
                Laporan sebelumnya ditolak. Hubungi toko atau laporkan lagi
                setelah barang diserahkan.
              </p>
            )}
            {item.returnRecord?.status === 'verified' && (
              <>
                <p className="success-note">Pengembalian sudah diverifikasi</p>
                <p>
                  Denda final {rupiah(item.returnRecord.lateFee)} · Kerusakan{' '}
                  {rupiah(item.returnRecord.damageAmount)}
                </p>
                {item.returnRecord.damageNote && (
                  <p>{item.returnRecord.damageNote}</p>
                )}
              </>
            )}
            {item.useStatus === 'lost_closed' && (
              <p className="info-note">
                Unit ditutup karena kehilangan. Periksa tagihan ganti rugi pada
                pembayaran.
              </p>
            )}
          </div>
          {item.useStatus === 'in_use' && (
            <Button
              variant="outline"
              disabled={!!selected}
              onClick={() => setSelected(item.id)}
            >
              Sudah mengembalikan {item.unitCodeSnapshot}
            </Button>
          )}
        </article>
      ))}
      {selected && (
        <BusinessForm
          key={selected}
          title="Laporkan pengembalian unit"
          description={`Unit ${booking.items?.find((item) => item.id === selected)?.unitCodeSnapshot}: pastikan sudah diserahkan ke toko atau petugas penjemput. Waktu laporan ini tidak digunakan sebagai dasar denda; admin memverifikasi waktu penerimaan fisik.`}
          execute={async (_, key) =>
            api.post(
              `/bookings/${booking.id}/items/${selected}/return-report`,
              {},
              { headers: { 'Idempotency-Key': key } },
            )
          }
          onDone={() => setSelected(null)}
          onCancel={() => setSelected(null)}
        />
      )}
    </section>
  );
}
