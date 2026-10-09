import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AuthContext, AuthService } from '../../auth/auth.service';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessClock } from '../../shared/time/business-clock';
import { parseWibDateTime } from '../../shared/time/wib';
import { protectsAllocation, overdue } from '../bookings/bookings.rules';
import {
  CalendarDto,
  TasksDto,
  RefundListDto,
  ExtensionListDto,
} from './admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly clock: BusinessClock,
  ) {}
  async tasks(context: AuthContext, dto: TasksDto) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.auth.authorizeLocked(tx, context, 'admin');
        // Query business state directly: sent or failed notifications do not complete a task.
        const cte = Prisma.sql`WITH tasks AS (
        SELECT p.id, 'payment' AS kind, b.id AS booking_id, b.code,
          COALESCE(e.confirmation_due_at,b.confirmation_due_at) AS due_at,
          p.uploaded_at AS changed_at, p.status::text AS status
        FROM payment_proofs p JOIN payment_obligations o ON o.id=p.payment_obligation_id
          JOIN bookings b ON b.id=o.booking_id LEFT JOIN extensions e ON e.id=o.extension_id
        WHERE p.status='pending' AND o.pending_proof_id=p.id
        UNION ALL
        SELECT r.id,'return',b.id,b.code,bi.current_end_at,r.updated_at,r.status::text
        FROM return_records r JOIN booking_items bi ON bi.id=r.booking_item_id JOIN bookings b ON b.id=bi.booking_id
        WHERE r.status='pending'
        UNION ALL
        SELECT e.id,'extension_quote',b.id,b.code,NULL,e.updated_at,e.status::text
        FROM extensions e JOIN bookings b ON b.id=e.booking_id WHERE e.status='draft_quote' AND e.quoted_at IS NULL
        UNION ALL
        SELECT r.id,'refund',b.id,b.code,NULL,r.updated_at,r.status::text
        FROM refund_requests r JOIN bookings b ON b.id=r.booking_id WHERE r.status IN ('diajukan','disetujui')
        UNION ALL
        SELECT u.id,'preparation',NULL,NULL,u.preparation_until,u.updated_at,u.physical_status::text
        FROM item_units u WHERE u.physical_status='preparing'
        UNION ALL
        SELECT b.id,'handover',b.id,b.code,b.initial_start_at,b.updated_at,b.status::text
        FROM bookings b WHERE b.status='dikonfirmasi'
      )`;
        const filter =
          dto.kind === 'all' ? Prisma.sql`TRUE` : Prisma.sql`kind=${dto.kind}`;
        const [rows, count] = await Promise.all([
          tx.$queryRaw<
            {
              id: string;
              kind: string;
              bookingId: string | null;
              code: string | null;
              dueAt: Date | null;
              changedAt: Date;
              status: string;
            }[]
          >(Prisma.sql`${cte}
          SELECT id,kind,booking_id AS "bookingId",code,due_at AS "dueAt",changed_at AS "changedAt",status FROM tasks
          WHERE ${filter} ORDER BY due_at ASC NULLS LAST,changed_at,id
          LIMIT ${dto.limit} OFFSET ${(dto.page - 1) * dto.limit}`),
          tx.$queryRaw<{ total: number }[]>(
            Prisma.sql`${cte} SELECT COUNT(*)::integer AS total FROM tasks WHERE ${filter}`,
          ),
        ]);
        const now = this.clock.now();
        return {
          data: rows.map((row) => ({
            ...row,
            overdue: row.dueAt !== null && row.dueAt < now,
            version: createHash('sha256')
              .update(
                `${row.kind}:${row.id}:${row.status}:${row.changedAt.toISOString()}:${row.dueAt?.toISOString()}`,
              )
              .digest('hex'),
          })),
          total: count[0].total,
          page: dto.page,
          limit: dto.limit,
          asOf: now,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async refunds(context: AuthContext, dto: RefundListDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.auth.authorizeLocked(tx, context, 'admin');
      const where = { status: dto.status, bookingId: dto.bookingId };
      const [data, total] = await Promise.all([
        tx.refundRequest.findMany({
          where,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          skip: (dto.page - 1) * dto.limit,
          take: dto.limit,
          select: {
            id: true,
            bookingId: true,
            extensionId: true,
            status: true,
            reasonCode: true,
            reasonNote: true,
            requestedAmount: true,
            approvedAmount: true,
            createdAt: true,
            approvedAt: true,
            transferredAt: true,
            booking: {
              select: {
                code: true,
                customer: { select: { id: true, name: true } },
              },
            },
          },
        }),
        tx.refundRequest.count({ where }),
      ]);
      return { data, total, page: dto.page, limit: dto.limit };
    });
  }
  async extensions(context: AuthContext, dto: ExtensionListDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.auth.authorizeLocked(tx, context, 'admin');
      const where = { status: dto.status, bookingId: dto.bookingId };
      const [data, total] = await Promise.all([
        tx.extension.findMany({
          where,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          skip: (dto.page - 1) * dto.limit,
          take: dto.limit,
          select: {
            id: true,
            bookingId: true,
            status: true,
            rentalQuoteTotal: true,
            amountDue: true,
            extraDeliveryQuote: true,
            deliveryQuoteNote: true,
            createdAt: true,
            quotedAt: true,
            submittedAt: true,
            expiresAt: true,
            confirmationDueAt: true,
            approvedAt: true,
            items: {
              select: {
                id: true,
                bookingItemId: true,
                oldEndAt: true,
                proposedEndAt: true,
                addedHours: true,
              },
            },
            booking: {
              select: {
                code: true,
                customer: { select: { id: true, name: true } },
              },
            },
          },
        }),
        tx.extension.count({ where }),
      ]);
      return { data, total, page: dto.page, limit: dto.limit };
    });
  }
  async calendar(context: AuthContext, dto: CalendarDto) {
    let start: Date, end: Date;
    try {
      start = parseWibDateTime(dto.startAt);
      end = parseWibDateTime(dto.endAt);
    } catch {
      throw new BadRequestException(
        'Waktu kalender wajib berupa ISO WIB +07:00 yang valid.',
      );
    }
    if (end <= start || end.getTime() - start.getTime() > 31 * 86400000)
      throw new BadRequestException(
        'Rentang kalender harus positif, maksimal 31 hari.',
      );
    return this.prisma.$transaction(
      async (tx) => {
        await this.auth.authorizeLocked(tx, context, 'admin');
        const where = dto.itemId ? { itemId: dto.itemId } : {};
        const [units, total] = await Promise.all([
          tx.itemUnit.findMany({
            where,
            orderBy: [{ code: 'asc' }, { id: 'asc' }],
            skip: (dto.page - 1) * dto.limit,
            take: dto.limit,
            include: {
              item: { select: { id: true, name: true, photoPath: true } },
            },
          }),
          tx.itemUnit.count({ where }),
        ]);
        const ids = units.map((unit) => unit.id),
          now = this.clock.now();
        const [allocations, uses] = await Promise.all([
          tx.unitAllocation.findMany({
            where: {
              itemUnitId: { in: ids },
              state: 'active',
              blockStartAt: { lt: end },
              blockEndAt: { gt: start },
            },
            include: {
              bookingItem: { include: { booking: true } },
              extensionItem: { include: { extension: true } },
            },
            orderBy: [{ blockStartAt: 'asc' }, { id: 'asc' }],
            take: 10001,
          }),
          tx.bookingItem.findMany({
            where: {
              itemUnitId: { in: ids },
              useStatus: { in: ['in_use', 'return_pending'] },
            },
          }),
        ]);
        if (allocations.length > 10000)
          throw new BadRequestException(
            'Persempit rentang atau jumlah unit kalender.',
          );
        return {
          startAt: start,
          endAt: end,
          asOf: now,
          total,
          page: dto.page,
          limit: dto.limit,
          data: units.map((unit) => ({
            id: unit.id,
            code: unit.code,
            item: unit.item,
            isActive: unit.isActive,
            conditionStatus: unit.conditionStatus,
            physicalStatus: unit.physicalStatus,
            preparationUntil: unit.preparationUntil,
            overdue: uses.some(
              (use) => use.itemUnitId === unit.id && overdue(use, now),
            ),
            allocations: allocations
              .filter(
                (allocation) =>
                  allocation.itemUnitId === unit.id &&
                  protectsAllocation(allocation, now),
              )
              .map((allocation) => ({
                id: allocation.id,
                bookingId: allocation.bookingItem.bookingId,
                code: allocation.bookingItem.booking.code,
                bookingItemId: allocation.bookingItemId,
                kind: allocation.allocationKind,
                startAt: allocation.startAt,
                endAt: allocation.endAt,
                blockStartAt: allocation.blockStartAt,
                blockEndAt: allocation.blockEndAt,
                status:
                  allocation.extensionItem?.extension.status ??
                  allocation.bookingItem.booking.status,
              })),
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
