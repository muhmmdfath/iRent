import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuthContext, AuthService } from '../../auth/auth.service';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessClock } from '../../shared/time/business-clock';
import { runBusinessTransaction } from '../../prisma/business-transaction';
import { PageDto } from '../inventory/inventory.dto';

const candidateInclude = {
  booking: true,
  unit: {
    include: {
      item: true,
      bookingItems: {
        where: { useStatus: { in: ['in_use', 'return_pending'] } },
        select: { id: true, version: true, currentEndAt: true },
      },
    },
  },
} satisfies Prisma.BookingItemInclude;
type Candidate = Prisma.BookingItemGetPayload<{
  include: typeof candidateInclude;
}>;
@Injectable()
export class RisksService {
  private cursor?: string;
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly clock: BusinessClock,
  ) {}
  private reasons(item: Candidate) {
    const now = this.clock.now(),
      unit = item.unit,
      reasons: string[] = [];
    if (
      item.useStatus !== 'allocated' ||
      !['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi'].includes(
        item.booking.status,
      ) ||
      (item.booking.status === 'menunggu_pembayaran' &&
        now > item.booking.expiresAt)
    )
      return reasons;
    if (!unit.isActive) reasons.push('unit_nonaktif');
    if (unit.conditionStatus === 'lost') reasons.push('unit_hilang');
    if (unit.conditionStatus === 'maintenance') reasons.push('unit_perawatan');
    if (unit.bookingItems.some((use) => use.currentEndAt < now))
      reasons.push('sewa_sebelumnya_terlambat');
    if (
      unit.physicalStatus === 'preparing' &&
      (!unit.preparationUntil || unit.preparationUntil > item.startAt)
    )
      reasons.push('persiapan_melewati_jadwal');
    if (now >= item.startAt && unit.physicalStatus !== 'ready')
      reasons.push('unit_belum_ready_saat_pengambilan');
    return reasons;
  }
  private entry(item: Candidate) {
    const reasons = this.reasons(item);
    return {
      bookingId: item.bookingId,
      bookingItemId: item.id,
      itemUnitId: item.itemUnitId,
      startAt: item.startAt,
      reasons,
      atRisk: reasons.length > 0,
    };
  }
  async bookingRisks(tx: Prisma.TransactionClient, bookingId: string) {
    const rows = await tx.bookingItem.findMany({
      where: { bookingId },
      include: candidateInclude,
    });
    return rows.map((row) => this.entry(row)).filter((row) => row.atRisk);
  }
  async list(context: AuthContext, page: PageDto) {
    return runBusinessTransaction(this.prisma, async (tx) => {
      await this.auth.authorizeLocked(tx, context, 'admin');
      const rows = await tx.bookingItem.findMany({
        where: {
          useStatus: 'allocated',
          booking: {
            status: {
              in: [
                'menunggu_pembayaran',
                'menunggu_konfirmasi',
                'dikonfirmasi',
              ],
            },
          },
        },
        include: candidateInclude,
        orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
      });
      const risks = rows
        .map((row) => this.entry(row))
        .filter((row) => row.atRisk);
      return {
        data: risks.slice((page.page - 1) * page.limit, page.page * page.limit),
        total: risks.length,
        page: page.page,
        limit: page.limit,
      };
    });
  }
  /** Read risks under the affected unit's lock; never acquire other customers' locks. */
  async alertUnit(tx: Prisma.TransactionClient, unitId: string) {
    const rows = await tx.bookingItem.findMany({
      where: {
        itemUnitId: unitId,
        useStatus: 'allocated',
        booking: {
          status: {
            in: ['menunggu_pembayaran', 'menunggu_konfirmasi', 'dikonfirmasi'],
          },
        },
      },
      include: candidateInclude,
    });
    let alerted = 0;
    for (const item of rows) {
      const risk = this.entry(item);
      if (!risk.atRisk) continue;
      const signature = createHash('sha256')
        .update(
          JSON.stringify({
            id: item.id,
            version: item.version,
            reasons: risk.reasons,
            unitUpdatedAt: item.unit.updatedAt,
            preparationUntil: item.unit.preparationUntil,
            uses: item.unit.bookingItems
              .slice()
              .sort((a, b) => a.id.localeCompare(b.id)),
          }),
        )
        .digest('hex');
      const key = 'booking.unit_at_risk:' + signature;
      if (await tx.outboxEvent.findUnique({ where: { eventKey: key } }))
        continue;
      await tx.outboxEvent.create({
        data: {
          eventKey: key,
          aggregateType: 'Booking',
          aggregateId: item.bookingId,
          eventType: 'booking.unit_at_risk',
          payload: {
            bookingId: item.bookingId,
            bookingItemId: item.id,
            itemUnitId: unitId,
            reasons: risk.reasons,
          },
          occurredAt: this.clock.now(),
        },
      });
      alerted++;
    }
    return alerted;
  }
  async scanDue(limit = 100) {
    let units = await this.prisma.itemUnit.findMany({
      where: {
        ...(this.cursor ? { id: { gt: this.cursor } } : {}),
        bookingItems: {
          some: {
            useStatus: 'allocated',
            booking: {
              status: {
                in: [
                  'menunggu_pembayaran',
                  'menunggu_konfirmasi',
                  'dikonfirmasi',
                ],
              },
            },
          },
        },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: limit,
    });
    if (!units.length && this.cursor) {
      this.cursor = undefined;
      units = await this.prisma.itemUnit.findMany({
        where: {
          bookingItems: {
            some: {
              useStatus: 'allocated',
              booking: {
                status: {
                  in: [
                    'menunggu_pembayaran',
                    'menunggu_konfirmasi',
                    'dikonfirmasi',
                  ],
                },
              },
            },
          },
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: limit,
      });
    }
    let alerted = 0,
      failed = 0;
    for (const unit of units)
      try {
        alerted += await runBusinessTransaction(this.prisma, async (tx) => {
          await tx.$queryRaw`SELECT id FROM item_units WHERE id=${unit.id}::uuid FOR UPDATE`;
          return this.alertUnit(tx, unit.id);
        });
      } catch {
        failed++;
      }
    this.cursor = units.at(-1)?.id;
    return { alerted, failed, scanned: units.length };
  }
}
