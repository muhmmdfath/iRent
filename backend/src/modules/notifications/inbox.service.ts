import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthContext, AuthService } from '../../auth/auth.service';
import { BusinessClock } from '../../shared/time/business-clock';
import { runBusinessTransaction } from '../../prisma/business-transaction';
import { PageDto } from '../inventory/inventory.dto';
const titles: Record<string, string> = {
  'booking.cancelled': 'Booking dibatalkan',
  'booking.no_show': 'Booking dibatalkan karena tidak diambil',
  'extension.cancelled_on_return': 'Perpanjangan ditutup setelah pengembalian',
  'extension.cancelled_on_loss': 'Pengajuan perpanjangan ditutup',
  'booking.handed_over': 'Perangkat sudah diserahkan',
  'booking.unit_replaced': 'Unit sewa diperbarui',
  'return.rejected': 'Laporan pengembalian perlu diperbaiki',
  'return.corrected': 'Data pengembalian diperbarui',
  'booking.created': 'Booking berhasil dibuat',
  'booking.confirmed': 'Booking dikonfirmasi',
  'booking.dikonfirmasi': 'Booking dikonfirmasi',
  'booking.berjalan': 'Sewa sudah dimulai',
  'booking.selesai': 'Sewa selesai',
  'booking.dibatalkan': 'Booking dibatalkan',
  'booking.kedaluwarsa': 'Booking kedaluwarsa',
  'booking.ditolak': 'Booking ditolak',
  'payment.proof_uploaded': 'Bukti pembayaran diterima',
  'payment.proof_verified': 'Bukti pembayaran diverifikasi',
  'payment.proof_rejected': 'Bukti pembayaran ditolak',
  'payment.received': 'Pembayaran dicatat',
  'payment.settlement_opened': 'Tagihan pelunasan tersedia',
  'extension.quote_requested': 'Perpanjangan menunggu penawaran',
  'extension.quoted': 'Penawaran perpanjangan tersedia',
  'extension.submitted': 'Pengajuan perpanjangan diterima',
  'extension.approved': 'Perpanjangan disetujui',
  'extension.closed': 'Pengajuan perpanjangan ditutup',
  'extension.proof_uploaded': 'Bukti perpanjangan diterima',
  'extension.proof_verified': 'Bukti perpanjangan diverifikasi',
  'extension.proof_rejected': 'Bukti perpanjangan ditolak',
  'refund.requested': 'Pengajuan refund diterima',
  'refund.approved': 'Refund disetujui',
  'refund.rejected': 'Refund ditolak',
  'refund.transferred': 'Refund sudah ditransfer',
  'return.reported': 'Laporan pengembalian diterima',
  'return.verified': 'Pengembalian diverifikasi',
};
@Injectable()
export class InboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly clock: BusinessClock,
  ) {}
  private source(context: AuthContext) {
    return Prisma.sql`FROM outbox_events e JOIN bookings b ON b.id=e.aggregate_id OR b.id::text=e.payload->>'bookingId'
      LEFT JOIN notification_reads r ON r.event_id=e.id AND r.user_id=${context.user.id}::uuid
      WHERE e.event_type IN (${Prisma.join(Object.keys(titles))}) AND ${context.user.role === 'admin' ? Prisma.sql`TRUE` : Prisma.sql`b.user_id=${context.user.id}::uuid`}`;
  }
  list(context: AuthContext, page: PageDto) {
    return runBusinessTransaction(this.prisma, async (tx) => {
      await this.auth.authorizeLocked(tx, context);
      const source = this.source(context);
      const rows = await tx.$queryRaw<
        {
          id: string;
          eventType: string;
          bookingId: string;
          code: string;
          createdAt: Date;
          readAt: Date | null;
        }[]
      >`SELECT e.id,e.event_type AS "eventType",b.id AS "bookingId",b.code,e.occurred_at AS "createdAt",r.read_at AS "readAt" ${source} ORDER BY e.occurred_at DESC,e.id DESC LIMIT ${page.limit} OFFSET ${(page.page - 1) * page.limit}`;
      const [counts] = await tx.$queryRaw<
        { total: bigint; unread: bigint }[]
      >`SELECT count(*) AS total,count(*) FILTER(WHERE r.read_at IS NULL) AS unread ${source}`;
      return {
        data: rows.map((row) => ({
          id: row.id,
          title: titles[row.eventType],
          message: row.code,
          eventType: row.eventType,
          createdAt: row.createdAt,
          readAt: row.readAt,
          href:
            (context.user.role === 'admin'
              ? '/admin/bookings/'
              : '/app/bookings/') + row.bookingId,
        })),
        total: Number(counts.total),
        unread: Number(counts.unread),
        page: page.page,
        limit: page.limit,
      };
    });
  }
  read(context: AuthContext, id?: string) {
    return runBusinessTransaction(this.prisma, async (tx) => {
      await this.auth.authorizeLocked(tx, context);
      const source = this.source(context);
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT e.id ${source} AND r.read_at IS NULL ${id ? Prisma.sql`AND e.id=${id}::uuid` : Prisma.empty}`;
      if (id && !rows.length) {
        const exists = await tx.$queryRaw<
          { id: string }[]
        >`SELECT e.id ${source} AND e.id=${id}::uuid`;
        if (!exists.length)
          throw new NotFoundException('Notifikasi tidak ditemukan.');
      }
      if (rows.length)
        await tx.notificationRead.createMany({
          data: rows.map((row) => ({
            userId: context.user.id,
            eventId: row.id,
            readAt: this.clock.now(),
          })),
          skipDuplicates: true,
        });
      return { ok: true };
    });
  }
}
