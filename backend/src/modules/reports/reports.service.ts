import { Injectable, PayloadTooLargeException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Prisma } from '../../generated/prisma/client';
import { AuthContext, AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { formatWibDateTime } from '../../shared/time/wib';
import { ReportDto } from './reports.dto';
import { reportPeriod } from './reports.rules';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async read(context: AuthContext, dto: ReportDto, exportAll = false) {
    const period = reportPeriod(dto.kind, dto.period);
    return this.prisma.$transaction(
      async (tx) => {
        await this.auth.authorizeLocked(tx, context, 'admin');
        const inPeriod = { gte: period.start, lt: period.end };
        const [cash, counts, popular, total, liabilities] = await Promise.all([
          tx.payment.groupBy({
            by: ['direction'],
            where: { occurredAt: inPeriod, supersededAt: null },
            _sum: { amount: true },
            _count: true,
          }),
          tx.booking.groupBy({
            by: ['status'],
            where: { createdAt: inPeriod },
            _count: true,
          }),
          tx.$queryRaw<{ itemId: string; name: string; quantity: number }[]>`
          SELECT bi.item_id AS "itemId", MAX(bi.item_name_snapshot) AS name, COUNT(*)::integer AS quantity
          FROM booking_items bi JOIN bookings b ON b.id=bi.booking_id
          WHERE b.initial_start_at >= ${period.start} AND b.initial_start_at < ${period.end}
            AND b.status IN ('dikonfirmasi','berjalan','selesai')
          GROUP BY bi.item_id ORDER BY quantity DESC, bi.item_id LIMIT 10`,
          tx.payment.count({ where: { occurredAt: inPeriod } }),
          tx.refundRequest.aggregate({
            where: { status: 'disetujui' },
            _sum: { approvedAmount: true },
          }),
        ]);
        if (exportAll && total > 10000)
          throw new PayloadTooLargeException(
            'Ekspor maksimal 10.000 mutasi; gunakan periode harian.',
          );
        const journal = await tx.payment.findMany({
          where: { occurredAt: inPeriod },
          orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
          skip: exportAll ? 0 : (dto.page - 1) * dto.limit,
          take: exportAll ? 10000 : dto.limit,
          select: {
            id: true,
            direction: true,
            type: true,
            method: true,
            amount: true,
            occurredAt: true,
            recordedAt: true,
            note: true,
            booking: { select: { id: true, code: true } },
            recordedActor: { select: { id: true, name: true } },
            supersededAt: true,
            correctionAsOriginal: {
              select: {
                id: true,
                replacementPaymentId: true,
                reversalAmount: true,
                reversalEffectiveAt: true,
                reason: true,
              },
            },
            correctionAsReplacement: {
              select: { id: true, originalPaymentId: true, reason: true },
            },
          },
        });
        const successful = await tx.$queryRaw<
          {
            id: string;
            code: string;
            bill: bigint;
            applied: bigint;
            lossClosed: boolean;
          }[]
        >`
        WITH completed AS (
          SELECT l.booking_id, MAX(l.created_at) AS at FROM booking_status_logs l
          JOIN bookings b ON b.id=l.booking_id WHERE l.to_status='selesai' AND b.status='selesai'
          GROUP BY l.booking_id HAVING MAX(l.created_at) >= ${period.start} AND MAX(l.created_at) < ${period.end}
        ), bills AS (
          SELECT booking_id, SUM(CASE WHEN direction='debit' THEN amount ELSE -amount END)::bigint AS bill
          FROM booking_charges WHERE booking_id IN (SELECT booking_id FROM completed) GROUP BY booking_id
        ), linked_returns AS (
          SELECT rs.payment_application_id, SUM(rs.amount)::bigint AS amount
          FROM refund_sources rs JOIN refund_requests r ON r.id=rs.refund_request_id
          WHERE r.status='sudah_dikembalikan' AND rs.booking_id IN (SELECT booking_id FROM completed) GROUP BY rs.payment_application_id
        ), applied AS (
          SELECT a.booking_id, SUM(a.amount-COALESCE(r.amount,0))::bigint AS applied
          FROM payment_applications a LEFT JOIN linked_returns r ON r.payment_application_id=a.id
          WHERE a.state='applied' AND a.booking_id IN (SELECT booking_id FROM completed) GROUP BY a.booking_id
        )
        SELECT b.id, b.code, COALESCE(c.bill,0)::bigint AS bill, COALESCE(a.applied,0)::bigint AS applied,
          EXISTS(SELECT 1 FROM booking_items i WHERE i.booking_id=b.id AND i.use_status='lost_closed') AS "lossClosed"
        FROM bookings b JOIN completed d ON d.booking_id=b.id
        LEFT JOIN bills c ON c.booking_id=b.id LEFT JOIN applied a ON a.booking_id=b.id
        WHERE b.status='selesai' AND d.at >= ${period.start} AND d.at < ${period.end}
          AND COALESCE(a.applied,0)>=COALESCE(c.bill,0)
        ORDER BY d.at,b.id LIMIT 10001`;
        if (successful.length > 10000)
          throw new PayloadTooLargeException(
            'Terlalu banyak transaksi selesai; gunakan periode harian.',
          );
        const incoming =
          cash.find((c) => c.direction === 'in')?._sum.amount ?? 0n;
        const outgoing =
          cash.find((c) => c.direction === 'out')?._sum.amount ?? 0n;
        return {
          period: {
            kind: period.kind,
            period: period.period,
            start: period.start,
            endExclusive: period.end,
          },
          cash: { incoming, outgoing, net: incoming - outgoing },
          pendingRefundsNow: liabilities._sum.approvedAmount ?? 0n,
          bookingCounts: counts.map((c) => ({
            status: c.status,
            count: c._count,
          })),
          popularItems: popular,
          successfulTransactions: successful,
          journal: {
            data: journal,
            total,
            page: dto.page,
            limit: exportAll ? 10000 : dto.limit,
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 20000,
      },
    );
  }

  async excel(context: AuthContext, dto: ReportDto) {
    const report = await this.read(context, dto, true);
    const book = new ExcelJS.Workbook();
    book.creator = 'iRent Semarang';
    const summary = book.addWorksheet('Ringkasan');
    summary.addRows([
      ['Periode WIB', dto.period],
      ['Jenis', dto.kind],
      ['Uang masuk (Rp)', report.cash.incoming.toString()],
      ['Refund keluar (Rp)', report.cash.outgoing.toString()],
      ['Kas bersih (Rp)', report.cash.net.toString()],
      [
        'Refund disetujui belum ditransfer saat ini (Rp)',
        report.pendingRefundsNow.toString(),
      ],
      ['Transaksi selesai dan lunas', report.successfulTransactions.length],
      [
        'Catatan',
        'Rupiah disimpan sebagai teks desimal agar presisi BIGINT terjaga.',
      ],
    ]);
    const journal = book.addWorksheet('Mutasi');
    journal.addRow([
      'ID',
      'Booking',
      'Arah',
      'Jenis',
      'Metode',
      'Rupiah',
      'Waktu aktual WIB',
      'Waktu catat WIB',
      'Admin',
      'Catatan',
      'Diganti',
      'Koreksi ID',
      'Pembalik pencatatan Rp',
      'Dampak kas bersih Rp',
      'Alasan koreksi',
    ]);
    for (const row of report.journal.data)
      journal.addRow([
        row.id,
        row.booking.code,
        row.direction,
        row.type,
        row.method,
        row.amount.toString(),
        formatWibDateTime(row.occurredAt),
        formatWibDateTime(row.recordedAt),
        row.recordedActor.name,
        row.note,
        row.supersededAt ? formatWibDateTime(row.supersededAt) : '',
        row.correctionAsOriginal?.id ?? row.correctionAsReplacement?.id ?? '',
        row.correctionAsOriginal
          ? (-row.correctionAsOriginal.reversalAmount).toString()
          : '',
        (row.supersededAt
          ? 0n
          : row.direction === 'in'
            ? row.amount
            : -row.amount
        ).toString(),
        row.correctionAsOriginal?.reason ??
          row.correctionAsReplacement?.reason ??
          '',
      ]);
    const statuses = book.addWorksheet('Status booking');
    statuses.addRow(['Status', 'Jumlah']);
    report.bookingCounts.forEach((row) =>
      statuses.addRow([row.status, row.count]),
    );
    const popular = book.addWorksheet('Item populer');
    popular.addRow(['Item ID', 'Nama snapshot', 'Jumlah unit']);
    report.popularItems.forEach((row) =>
      popular.addRow([row.itemId, row.name, row.quantity.toString()]),
    );
    const successful = book.addWorksheet('Selesai dan lunas');
    successful.addRow([
      'Booking',
      'Tagihan Rp',
      'Dana diterapkan Rp',
      'Memuat penutupan kehilangan',
    ]);
    report.successfulTransactions.forEach((row) =>
      successful.addRow([
        row.code,
        row.bill.toString(),
        row.applied.toString(),
        row.lossClosed,
      ]),
    );
    for (const sheet of book.worksheets) {
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
      sheet.getRow(1).font = { bold: true };
      sheet.columns.forEach((column) => {
        column.width = 28;
      });
    }
    return Buffer.from(await book.xlsx.writeBuffer());
  }
}
