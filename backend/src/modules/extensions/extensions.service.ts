import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthContext, AuthService } from '../../auth/auth.service';
import { Extension, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { runBusinessTransaction } from '../../prisma/business-transaction';
import { BusinessClock } from '../../shared/time/business-clock';
import { unitAvailable, protectsAllocation } from '../bookings/bookings.rules';
import { LockedBooking, PaymentsService } from '../payments/payments.service';
import { PaymentLedgerService } from '../payments/payment-ledger.service';
import {
  ProofStorageService,
  ProofUpload,
} from '../payments/proof-storage.service';
import {
  ReconcileReceiptDto,
  UploadProofDto,
  VerifyProofDto,
} from '../payments/payments.dto';
import { MAX_RUPIAH, rupiah } from '../settings/settings.rules';
import {
  CreateExtensionDto,
  QuoteExtensionDto,
  SubmitExtensionDto,
} from './extensions.dto';
import { extensionSchedule, pendingExtensions } from './extensions.rules';
import { ExtensionDelayService } from './extension-delay.service';

const include = { items: true } as const;
type Proposal = Prisma.ExtensionGetPayload<{ include: typeof include }>;
@Injectable()
export class ExtensionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly payments: PaymentsService,
    private readonly ledger: PaymentLedgerService,
    private readonly storage: ProofStorageService,
    private readonly clock: BusinessClock,
    private readonly delay: ExtensionDelayService,
  ) {}

  private async proposal(
    tx: Prisma.TransactionClient,
    bookingId: string,
    id: string,
  ): Promise<Proposal> {
    const proposal = await tx.extension.findFirst({
      where: { id: id.toLowerCase(), bookingId },
      include,
    });
    if (!proposal)
      throw new NotFoundException('Pengajuan perpanjangan tidak ditemukan.');
    return proposal;
  }
  private async event(
    tx: Prisma.TransactionClient,
    extension: Extension,
    type: string,
    actor?: string,
    reason?: string,
    changes: Prisma.InputJsonObject = {},
  ) {
    await tx.auditLog.create({
      data: {
        actorId: actor,
        action: type,
        entityType: 'Extension',
        entityId: extension.id,
        changes: {
          bookingId: extension.bookingId,
          extensionId: extension.id,
          ...changes,
        },
        reason,
        createdAt: this.clock.now(),
      },
    });
    await tx.outboxEvent.create({
      data: {
        eventKey: type + ':' + extension.id + ':' + randomUUID(),
        aggregateType: 'Booking',
        aggregateId: extension.bookingId,
        eventType: type,
        payload: {
          bookingId: extension.bookingId,
          extensionId: extension.id,
          ...(typeof changes.proofId === 'string'
            ? { proofId: changes.proofId }
            : {}),
        },
        occurredAt: this.clock.now(),
      },
    });
  }
  async detail(context: AuthContext, bookingId: string, id: string) {
    return runBusinessTransaction(this.prisma, async (tx) => {
      await this.auth.authorizeLocked(tx, context, context.user.role);
      const booking = await this.payments.lockBooking(
        tx,
        bookingId.toLowerCase(),
        context,
      );
      const extension = await this.proposal(tx, booking.id, id);
      return {
        extension,
        summary: await this.ledger.summary(tx, booking.id, extension.id),
        confirmationOverdue:
          extension.status === 'menunggu_konfirmasi' &&
          !!extension.confirmationDueAt &&
          this.clock.now() > extension.confirmationDueAt,
      };
    });
  }
  private async available(
    tx: Prisma.TransactionClient,
    booking: LockedBooking,
    proposal: Proposal,
    submitting: boolean,
  ) {
    const now = this.clock.now(),
      rules = this.payments.rules(booking).values;
    if (booking.status !== 'berjalan' || !proposal.items.length) return false;
    for (const selected of proposal.items) {
      const item = booking.items.find(
        (row) => row.id === selected.bookingItemId,
      );
      if (
        !item ||
        item.version !== selected.expectedItemVersion ||
        item.currentEndAt.getTime() !== selected.oldEndAt.getTime()
      )
        return false;
      try {
        extensionSchedule(item, selected.addedHours, rules, now, submitting);
      } catch {
        return false;
      }
      const unit = await tx.itemUnit.findUniqueOrThrow({
        where: { id: item.itemUnitId },
        include: { item: true },
      });
      if (!unit.item.isActive || unit.physicalStatus !== 'in_use') return false;
      const allocations = await tx.unitAllocation.findMany({
        where: { itemUnitId: item.itemUnitId, state: 'active' },
        include: {
          bookingItem: { include: { booking: true } },
          extensionItem: { include: { extension: true } },
        },
      });
      const uses = await tx.bookingItem.findMany({
        where: {
          itemUnitId: item.itemUnitId,
          useStatus: { in: ['in_use', 'return_pending'] },
        },
      });
      if (
        !allocations.some(
          (row) =>
            row.bookingItemId === item.id && row.allocationKind === 'rental',
        )
      )
        return false;
      // The unit's own running rental and its own proposal are excluded; all other scopes retain protection.
      if (
        !unitAvailable(
          unit,
          allocations.filter(
            (row) =>
              !(
                row.bookingItemId === item.id &&
                (row.allocationKind === 'rental' ||
                  row.extensionItem?.extensionId === proposal.id)
              ),
          ),
          uses.map((use) =>
            use.id === item.id
              ? { ...use, currentEndAt: selected.proposedEndAt }
              : use,
          ),
          selected.oldEndAt,
          selected.proposedEndAt,
          now,
        )
      )
        return false;
      if (unit.item.category === 'iphone') {
        const customer = await tx.unitAllocation.findMany({
          where: {
            state: 'active',
            bookingItem: {
              booking: { userId: booking.userId },
              item: { category: 'iphone' },
            },
          },
          include: {
            bookingItem: { include: { booking: true } },
            extensionItem: { include: { extension: true } },
          },
        });
        if (
          customer.some(
            (row) =>
              row.bookingItemId !== item.id &&
              protectsAllocation(row, now) &&
              ((row.startAt < selected.proposedEndAt &&
                row.endAt > item.startAt) ||
                (['in_use', 'return_pending'].includes(
                  row.bookingItem.useStatus,
                ) &&
                  row.bookingItem.currentEndAt < now)),
          )
        )
          return false;
      }
    }
    return true;
  }
  private async submitProposal(
    tx: Prisma.TransactionClient,
    booking: LockedBooking,
    proposal: Proposal,
    actor: string,
    extra: bigint,
  ) {
    if (!(await this.available(tx, booking, proposal, true)))
      throw new ConflictException(
        'Jadwal, kondisi atau versi unit tidak lagi tersedia.',
      );
    const now = this.clock.now(),
      rules = this.payments.rules(booking).values;
    const amount = proposal.rentalQuoteTotal + extra;
    if (amount > MAX_RUPIAH)
      throw new BadRequestException('Tagihan melampaui rentang rupiah.');
    const expiresAt = new Date(
      now.getTime() + rules.extension_hold_minutes * 60000,
    );
    const updated = await tx.extension.update({
      where: { id: proposal.id },
      data: {
        status: 'menunggu_pembayaran',
        submittedAt: now,
        expiresAt,
        extraDeliveryQuote: extra,
        amountDue: amount,
        deliveryAgreedAt: proposal.quotedAt ? now : null,
      },
    });
    await tx.paymentObligation.create({
      data: {
        bookingId: booking.id,
        extensionId: proposal.id,
        purpose: 'extension',
        amountDue: amount,
        expiresAt,
      },
    });
    for (const selected of proposal.items) {
      const item = booking.items.find(
        (row) => row.id === selected.bookingItemId,
      )!;
      await tx.unitAllocation.create({
        data: {
          bookingItemId: item.id,
          itemUnitId: item.itemUnitId,
          extensionItemId: selected.id,
          allocationKind: 'extension_hold',
          startAt: selected.oldEndAt,
          endAt: selected.proposedEndAt,
          blockStartAt: new Date(
            selected.oldEndAt.getTime() - rules.buffer_minutes * 60000,
          ),
          blockEndAt: new Date(
            selected.proposedEndAt.getTime() + rules.buffer_minutes * 60000,
          ),
          holdExpiresAt: expiresAt,
        },
      });
    }
    await this.event(tx, updated, 'extension.submitted', actor);
  }
  create(
    context: AuthContext,
    bookingId: string,
    input: CreateExtensionDto,
    key?: string,
  ) {
    const selections = input.items
      .map((row) => ({
        bookingItemId: row.bookingItemId.toLowerCase(),
        addedHours: row.addedHours,
      }))
      .sort((a, b) => a.bookingItemId.localeCompare(b.bookingItemId));
    if (
      !selections.length ||
      selections.length > 100 ||
      new Set(selections.map((row) => row.bookingItemId)).size !==
        selections.length
    )
      throw new BadRequestException(
        'Pilihan unit wajib unik dan tidak kosong.',
      );
    return this.payments.action(
      context,
      bookingId,
      key,
      'extension.create',
      { items: selections },
      'customer',
      async (tx, booking) => {
        if (booking.status !== 'berjalan')
          throw new ConflictException('Booking tidak sedang berjalan.');
        const now = this.clock.now(),
          rules = this.payments.rules(booking).values;
        const rows = selections.map((selected) => {
          const item = booking.items.find(
            (row) => row.id === selected.bookingItemId,
          );
          if (!item)
            throw new NotFoundException('Unit booking tidak ditemukan.');
          const { end, price } = extensionSchedule(
            item,
            selected.addedHours,
            rules,
            now,
          );
          return {
            bookingId: booking.id,
            bookingItemId: item.id,
            oldEndAt: item.currentEndAt,
            proposedEndAt: end,
            expectedItemVersion: item.version,
            addedHours: selected.addedHours,
            unitPriceSnapshot: price,
          };
        });
        if (
          await tx.extension.count({
            where: {
              bookingId: booking.id,
              status: { in: [...pendingExtensions] },
              items: {
                some: {
                  bookingItemId: { in: rows.map((row) => row.bookingItemId) },
                },
              },
            },
          })
        )
          throw new ConflictException('Unit sudah memiliki pengajuan aktif.');
        const rental = rows.reduce(
          (sum, row) => sum + row.unitPriceSnapshot,
          0n,
        );
        if (rental > MAX_RUPIAH)
          throw new BadRequestException('Tagihan melampaui rentang rupiah.');
        const ends = booking.items
          .filter((row) => ['in_use', 'return_pending'].includes(row.useStatus))
          .map(
            (item) =>
              rows
                .find((row) => row.bookingItemId === item.id)
                ?.proposedEndAt.getTime() ?? item.currentEndAt.getTime(),
          );
        const quoteRequired =
          booking.deliveryType === 'delivery' && new Set(ends).size > 1;
        const created = await tx.extension.create({
          data: {
            bookingId: booking.id,
            status: 'draft_quote',
            rentalQuoteTotal: rental,
            amountDue: rental,
          },
          include,
        });
        await tx.extensionItem.createMany({
          data: rows.map((row) => ({ ...row, extensionId: created.id })),
        });
        const proposal = await this.proposal(tx, booking.id, created.id);
        if (quoteRequired)
          await this.event(
            tx,
            proposal,
            'extension.quote_requested',
            context.user.id,
          );
        else
          await this.submitProposal(tx, booking, proposal, context.user.id, 0n);
        return { bookingId: booking.id, decision: proposal.id };
      },
      (booking) =>
        this.assertLead(
          booking,
          selections.map((row) => row.bookingItemId),
        ),
    );
  }
  private assertLead(booking: LockedBooking, ids: string[]) {
    const lead =
      this.payments.rules(booking).values.extension_min_lead_minutes * 60000;
    if (
      booking.items.some(
        (item) =>
          ids.includes(item.id) &&
          item.currentEndAt.getTime() - this.clock.now().getTime() < lead,
      )
    )
      throw new ConflictException(
        'Pencatatan pengajuan melewati batas dua jam.',
      );
  }
  quote(
    context: AuthContext,
    bookingId: string,
    id: string,
    input: QuoteExtensionDto,
    key?: string,
  ) {
    const extra = rupiah(input.extraDeliveryQuote),
      note = input.note.trim();
    if (note.length < 5)
      throw new BadRequestException('Alasan ongkir wajib lengkap.');
    return this.payments.action(
      context,
      bookingId,
      key,
      'extension.quote',
      { id: id.toLowerCase(), extra: extra.toString(), note },
      'admin',
      async (tx, booking) => {
        const proposal = await this.proposal(tx, booking.id, id);
        if (proposal.status !== 'draft_quote')
          throw new ConflictException('Quotation hanya untuk draft.');
        if (proposal.rentalQuoteTotal + extra > MAX_RUPIAH)
          throw new BadRequestException('Tagihan melampaui rentang rupiah.');
        const updated = await tx.extension.update({
          where: { id: proposal.id },
          data: {
            extraDeliveryQuote: extra,
            amountDue: proposal.rentalQuoteTotal + extra,
            deliveryQuoteNote: note,
            quotedBy: context.user.id,
            quotedAt: this.clock.now(),
          },
        });
        await this.event(
          tx,
          updated,
          'extension.quoted',
          context.user.id,
          note,
          {
            extraDeliveryQuote: extra.toString(),
            amountDue: updated.amountDue.toString(),
          },
        );
        return { bookingId: booking.id, decision: proposal.id };
      },
    );
  }
  submit(
    context: AuthContext,
    bookingId: string,
    id: string,
    input: SubmitExtensionDto,
    key?: string,
  ) {
    const expected = rupiah(input.expectedExtraDeliveryQuote);
    let selectedIds: string[] = [];
    return this.payments.action(
      context,
      bookingId,
      key,
      'extension.submit',
      {
        id: id.toLowerCase(),
        expected: expected.toString(),
        agree: input.agreeExtraDelivery,
      },
      'customer',
      async (tx, booking) => {
        const proposal = await this.proposal(tx, booking.id, id);
        selectedIds = proposal.items.map((row) => row.bookingItemId);
        if (
          proposal.status !== 'draft_quote' ||
          !proposal.quotedAt ||
          !input.agreeExtraDelivery ||
          expected !== proposal.extraDeliveryQuote
        )
          throw new ConflictException(
            'Setujui nominal quotation terbaru sebelum submit.',
          );
        await this.submitProposal(
          tx,
          booking,
          proposal,
          context.user.id,
          expected,
        );
        return { bookingId: booking.id, decision: proposal.id };
      },
      (booking) => this.assertLead(booking, selectedIds),
    );
  }
  async close(
    tx: Prisma.TransactionClient,
    proposal: Proposal,
    status: 'dibatalkan' | 'ditolak' | 'kedaluwarsa',
    reason: string,
    actor?: string,
  ) {
    if (!pendingExtensions.some((value) => value === proposal.status)) return;
    const now = this.clock.now();
    const updated = await tx.extension.update({
      where: { id: proposal.id },
      data: {
        status,
        ...(status === 'ditolak'
          ? { rejectedReason: reason }
          : { cancelReason: reason }),
      },
    });
    await tx.unitAllocation.updateMany({
      where: { extensionItem: { extensionId: proposal.id }, state: 'active' },
      data: { state: 'released', releasedAt: now, releasedReason: reason },
    });
    await tx.paymentObligation.updateMany({
      where: { extensionId: proposal.id },
      data: { status: 'closed', pendingProofId: null },
    });
    await tx.paymentApplication.updateMany({
      where: { obligation: { extensionId: proposal.id } },
      data: { state: 'released' },
    });
    const receipts = await tx.payment.findMany({
      where: { extensionId: proposal.id, direction: 'in', supersededAt: null },
    });
    for (const receipt of receipts)
      await this.ledger.requestUnusedRefund(
        tx,
        receipt,
        'extension_' + status,
        now,
      );
    await this.event(tx, updated, 'extension.closed', actor, reason);
  }
  cancel(
    context: AuthContext,
    bookingId: string,
    id: string,
    reason: string,
    key?: string,
  ) {
    reason = reason.trim();
    if (reason.length < 5)
      throw new BadRequestException('Alasan wajib lengkap.');
    return this.payments.action(
      context,
      bookingId,
      key,
      'extension.cancel',
      { id: id.toLowerCase(), reason },
      context.user.role,
      async (tx, booking) => {
        const proposal = await this.proposal(tx, booking.id, id);
        if (!pendingExtensions.some((value) => value === proposal.status))
          throw new ConflictException('Pengajuan sudah diputuskan.');
        await this.close(tx, proposal, 'dibatalkan', reason, context.user.id);
        return { bookingId: booking.id, decision: proposal.id };
      },
    );
  }
  async upload(
    context: AuthContext,
    bookingId: string,
    id: string,
    input: UploadProofDto,
    file: ProofUpload | undefined,
    key?: string,
  ) {
    if (!key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new BadRequestException('Idempotency-Key wajib valid.');
    await this.detail(context, bookingId, id);
    const amount = rupiah(input.claimedAmount),
      saved = await this.storage.save(file),
      proofId = randomUUID();
    let retain = false;
    try {
      const result = await this.payments.action(
        context,
        bookingId,
        key,
        'extension.upload',
        {
          id: id.toLowerCase(),
          amount: amount.toString(),
          fileHash: saved.fileHash,
        },
        'customer',
        async (tx, booking) => {
          const proposal = await this.proposal(tx, booking.id, id),
            now = this.clock.now();
          const obligation = booking.obligations.find(
            (row) => row.extensionId === proposal.id,
          );
          if (
            proposal.status !== 'menunggu_pembayaran' ||
            !proposal.expiresAt ||
            now > proposal.expiresAt ||
            !obligation ||
            obligation.status !== 'open'
          )
            throw new ConflictException(
              'Pengajuan tidak menerima upload atau deadline sudah lewat.',
            );
          await tx.paymentProof.create({
            data: {
              id: proofId,
              paymentObligationId: obligation.id,
              ...saved,
              claimedAmount: amount,
              uploadedAt: now,
            },
          });
          await tx.paymentObligation.update({
            where: { id: obligation.id },
            data: { status: 'proof_pending', pendingProofId: proofId },
          });
          const rules = this.payments.rules(booking).values;
          const due = new Date(
            Math.min(
              now.getTime() + rules.extension_confirm_minutes * 60000,
              ...proposal.items.map(
                (row) =>
                  row.oldEndAt.getTime() -
                  rules.extension_confirm_before_return_minutes * 60000,
              ),
            ),
          );
          await tx.extension.update({
            where: { id: proposal.id },
            data: {
              status: 'menunggu_konfirmasi',
              uploadedAt: now,
              confirmationDueAt: due,
            },
          });
          for (const item of proposal.items)
            await tx.extensionItem.update({
              where: { id: item.id },
              data: {
                confirmationDueAt: new Date(
                  Math.min(
                    now.getTime() + rules.extension_confirm_minutes * 60000,
                    item.oldEndAt.getTime() -
                      rules.extension_confirm_before_return_minutes * 60000,
                  ),
                ),
              },
            });
          await tx.unitAllocation.updateMany({
            where: {
              extensionItem: { extensionId: proposal.id },
              state: 'active',
            },
            data: { holdExpiresAt: null },
          });
          await this.event(
            tx,
            proposal,
            'extension.proof_uploaded',
            context.user.id,
            undefined,
            { proofId },
          );
          if (this.clock.now() > proposal.expiresAt)
            throw new ConflictException('Pencatatan bukti melewati deadline.');
          return { bookingId: booking.id, proofId, decision: proposal.id };
        },
        (booking) => {
          const obligation = booking.obligations.find(
            (row) => row.extensionId === id.toLowerCase(),
          );
          if (!obligation?.expiresAt || this.clock.now() > obligation.expiresAt)
            throw new ConflictException('Pencatatan bukti melewati deadline.');
        },
      );
      retain = result.proofId === proofId;
      return result;
    } catch (error) {
      try {
        retain =
          (await this.prisma.paymentProof.count({ where: { id: proofId } })) >
          0;
      } catch {
        retain = true;
      }
      throw error;
    } finally {
      if (!retain) await this.storage.remove(saved.proofPath);
    }
  }
  private async approveProposal(
    tx: Prisma.TransactionClient,
    booking: LockedBooking,
    proposal: Proposal,
    actor: string,
  ) {
    const obligation = booking.obligations.find(
      (row) => row.extensionId === proposal.id,
    )!;
    const applications = await tx.paymentApplication.findMany({
      where: { paymentObligationId: obligation.id, state: 'reserved' },
    });
    if (
      applications.reduce((sum, row) => sum + row.amount, 0n) <
      proposal.amountDue
    )
      throw new ConflictException('Dana perpanjangan belum lengkap.');
    const holds = await tx.unitAllocation.count({
      where: {
        extensionItem: { extensionId: proposal.id },
        state: 'active',
        allocationKind: 'extension_hold',
      },
    });
    if (
      holds !== proposal.items.length ||
      !(await this.available(tx, booking, proposal, false))
    ) {
      await this.close(
        tx,
        proposal,
        'ditolak',
        'Kalender, kondisi atau versi unit tidak memenuhi approval.',
        actor,
      );
      return 'refund_required';
    }
    const now = this.clock.now(),
      rules = this.payments.rules(booking).values;
    for (const selected of proposal.items) {
      const item = booking.items.find(
        (row) => row.id === selected.bookingItemId,
      )!;
      await tx.bookingItem.update({
        where: { id: item.id },
        data: {
          currentEndAt: selected.proposedEndAt,
          version: { increment: 1 },
        },
      });
      await tx.unitAllocation.updateMany({
        where: {
          bookingItemId: item.id,
          allocationKind: 'rental',
          state: 'active',
        },
        data: {
          endAt: selected.proposedEndAt,
          blockEndAt: new Date(
            selected.proposedEndAt.getTime() + rules.buffer_minutes * 60000,
          ),
        },
      });
      await tx.bookingCharge.create({
        data: {
          bookingId: booking.id,
          bookingItemId: item.id,
          extensionId: proposal.id,
          kind: 'extension',
          direction: 'debit',
          amount: selected.unitPriceSnapshot,
          effectiveAt: now,
          createdBy: actor,
          sourceKey: 'extension.rental:' + selected.id,
        },
      });
    }
    if (proposal.extraDeliveryQuote > 0n)
      await tx.bookingCharge.create({
        data: {
          bookingId: booking.id,
          extensionId: proposal.id,
          kind: 'extra_delivery',
          direction: 'debit',
          amount: proposal.extraDeliveryQuote,
          effectiveAt: now,
          createdBy: actor,
          reason: proposal.deliveryQuoteNote,
          sourceKey: 'extension.delivery:' + proposal.id,
        },
      });
    await tx.unitAllocation.updateMany({
      where: { extensionItem: { extensionId: proposal.id }, state: 'active' },
      data: {
        state: 'released',
        releasedAt: now,
        releasedReason: 'Perpanjangan digabung ke alokasi sewa.',
      },
    });
    await tx.paymentApplication.updateMany({
      where: { paymentObligationId: obligation.id, state: 'reserved' },
      data: { state: 'applied' },
    });
    await tx.paymentObligation.update({
      where: { id: obligation.id },
      data: { status: 'satisfied', pendingProofId: null },
    });
    const approved = await tx.extension.update({
      where: { id: proposal.id },
      data: { status: 'disetujui', approvedBy: actor, approvedAt: now },
    });
    await this.event(tx, approved, 'extension.approved', actor);
    return 'approved';
  }
  verify(
    context: AuthContext,
    bookingId: string,
    id: string,
    input: VerifyProofDto,
    key?: string,
  ) {
    const normalized = this.payments.receiptInput(input);
    return this.payments.action(
      context,
      bookingId,
      key,
      'extension.verify',
      {
        id: id.toLowerCase(),
        proofId: input.proofId.toLowerCase(),
        ...normalized,
        amount: normalized.amount.toString(),
        occurredAt: normalized.occurredAt.toISOString(),
      },
      'admin',
      async (tx, booking) => {
        const proposal = await this.proposal(tx, booking.id, id),
          obligation = booking.obligations.find(
            (row) => row.extensionId === proposal.id,
          );
        const proof = await tx.paymentProof.findUnique({
          where: { id: input.proofId.toLowerCase() },
        });
        if (!obligation || proof?.paymentObligationId !== obligation.id)
          throw new NotFoundException('Bukti tidak ditemukan.');
        if (
          proposal.status !== 'menunggu_konfirmasi' ||
          proof.status !== 'pending' ||
          obligation.pendingProofId !== proof.id
        )
          throw new ConflictException(
            'Pengajuan/bukti sudah diputuskan; gunakan rekonsiliasi.',
          );
        const receipt = await this.payments.receipt(
          tx,
          booking,
          obligation.id,
          normalized,
          context.user.id,
          proof.id,
        );
        const now = this.clock.now();
        await tx.paymentProof.update({
          where: { id: proof.id },
          data: {
            status: 'verified',
            reviewedBy: context.user.id,
            reviewedAt: now,
          },
        });
        await tx.paymentObligation.update({
          where: { id: obligation.id },
          data: { status: 'open', pendingProofId: null },
        });
        const held = await tx.paymentApplication.aggregate({
          where: { paymentObligationId: obligation.id, state: 'reserved' },
          _sum: { amount: true },
        });
        const due = proposal.amountDue - (held._sum.amount ?? 0n),
          assigned = normalized.amount < due ? normalized.amount : due;
        if (assigned > 0n)
          await tx.paymentApplication.create({
            data: {
              bookingId: booking.id,
              paymentObligationId: obligation.id,
              incomingPaymentId: receipt.id,
              amount: assigned,
              state: 'reserved',
            },
          });
        await this.ledger.requestUnusedRefund(tx, receipt, 'overpayment', now);
        let result = 'underpaid';
        if (assigned >= due)
          result = await this.approveProposal(
            tx,
            booking,
            proposal,
            context.user.id,
          );
        else if (proposal.expiresAt && now > proposal.expiresAt) {
          await this.close(
            tx,
            proposal,
            'kedaluwarsa',
            'Dana kurang setelah batas pembayaran.',
            context.user.id,
          );
          result = 'refund_required';
        } else {
          await tx.extension.update({
            where: { id: proposal.id },
            data: { status: 'menunggu_pembayaran', confirmationDueAt: null },
          });
          await tx.unitAllocation.updateMany({
            where: {
              extensionItem: { extensionId: proposal.id },
              state: 'active',
            },
            data: { holdExpiresAt: proposal.expiresAt },
          });
        }
        await this.event(
          tx,
          proposal,
          'extension.proof_verified',
          context.user.id,
          result,
        );
        return { bookingId: booking.id, proofId: proof.id, decision: result };
      },
    );
  }
  reject(
    context: AuthContext,
    bookingId: string,
    id: string,
    reason: string,
    key?: string,
    proofId?: string,
  ) {
    reason = reason.trim();
    if (reason.length < 5)
      throw new BadRequestException('Alasan wajib lengkap.');
    return this.payments.action(
      context,
      bookingId,
      key,
      proofId ? 'extension.proof_reject' : 'extension.reject',
      { id: id.toLowerCase(), reason, proofId: proofId?.toLowerCase() ?? null },
      'admin',
      async (tx, booking) => {
        const proposal = await this.proposal(tx, booking.id, id);
        if (!pendingExtensions.some((value) => value === proposal.status))
          throw new ConflictException('Pengajuan sudah diputuskan.');
        if (proofId) {
          const obligation = booking.obligations.find(
            (row) => row.extensionId === proposal.id,
          );
          const proof = await tx.paymentProof.findUnique({
            where: { id: proofId.toLowerCase() },
          });
          if (
            !obligation ||
            !proof ||
            proof.paymentObligationId !== obligation.id
          )
            throw new NotFoundException('Bukti tidak ditemukan.');
          if (
            proof.status !== 'pending' ||
            obligation.pendingProofId !== proof.id
          )
            throw new ConflictException('Bukti sudah diputuskan.');
          await tx.paymentProof.update({
            where: { id: proof.id },
            data: {
              status: 'rejected',
              reviewedBy: context.user.id,
              reviewedAt: this.clock.now(),
              rejectedReason: reason,
            },
          });
          await tx.paymentObligation.update({
            where: { id: obligation.id },
            data: { status: 'open', pendingProofId: null },
          });
          if (proposal.expiresAt && this.clock.now() <= proposal.expiresAt) {
            await tx.extension.update({
              where: { id: proposal.id },
              data: { status: 'menunggu_pembayaran', confirmationDueAt: null },
            });
            await tx.unitAllocation.updateMany({
              where: {
                extensionItem: { extensionId: proposal.id },
                state: 'active',
              },
              data: { holdExpiresAt: proposal.expiresAt },
            });
            await this.event(
              tx,
              proposal,
              'extension.proof_rejected',
              context.user.id,
              reason,
            );
            return { bookingId: booking.id, decision: proposal.id };
          }
        }
        await this.close(
          tx,
          proposal,
          proofId ? 'kedaluwarsa' : 'ditolak',
          reason,
          context.user.id,
        );
        return { bookingId: booking.id, decision: proposal.id };
      },
    );
  }
  approve(context: AuthContext, bookingId: string, id: string, key?: string) {
    return this.payments.action(
      context,
      bookingId,
      key,
      'extension.approve',
      { id: id.toLowerCase() },
      'admin',
      async (tx, booking) => {
        const proposal = await this.proposal(tx, booking.id, id),
          obligation = booking.obligations.find(
            (row) => row.extensionId === proposal.id,
          );
        if (
          proposal.status !== 'menunggu_pembayaran' ||
          !obligation ||
          obligation.pendingProofId ||
          !proposal.expiresAt ||
          this.clock.now() > proposal.expiresAt
        )
          throw new ConflictException(
            'Pengajuan tidak menerima approval langsung.',
          );
        return {
          bookingId: booking.id,
          decision: await this.approveProposal(
            tx,
            booking,
            proposal,
            context.user.id,
          ),
        };
      },
    );
  }
  reconcile(
    context: AuthContext,
    bookingId: string,
    id: string,
    input: ReconcileReceiptDto,
    key?: string,
  ) {
    const normalized = this.payments.receiptInput(input);
    return this.payments.action(
      context,
      bookingId,
      key,
      'extension.reconcile',
      {
        id: id.toLowerCase(),
        obligationId: input.obligationId.toLowerCase(),
        proofId: input.proofId?.toLowerCase() ?? null,
        ...normalized,
        amount: normalized.amount.toString(),
        occurredAt: normalized.occurredAt.toISOString(),
      },
      'admin',
      async (tx, booking) => {
        const proposal = await this.proposal(tx, booking.id, id),
          obligation = booking.obligations.find(
            (row) =>
              row.id === input.obligationId.toLowerCase() &&
              row.extensionId === proposal.id,
          );
        if (!obligation)
          throw new NotFoundException('Kewajiban tidak ditemukan.');
        const terminal =
          !pendingExtensions.some((value) => value === proposal.status) &&
          proposal.status !== 'disetujui';
        const proof = input.proofId
          ? await tx.paymentProof.findUnique({
              where: { id: input.proofId.toLowerCase() },
            })
          : null;
        if (
          input.proofId &&
          (!proof ||
            proof.paymentObligationId !== obligation.id ||
            proof.status === 'verified' ||
            (!terminal && proof.status !== 'rejected'))
        )
          throw new ConflictException(
            'Gunakan bukti ditolak atau bukti pending pengajuan yang ditutup.',
          );
        if (!terminal && !proof)
          throw new ConflictException(
            'Pengajuan aktif membutuhkan bukti ditolak untuk rekonsiliasi.',
          );
        if (proposal.status === 'disetujui')
          throw new ConflictException('Pengajuan sudah disetujui.');
        const receipt = await this.payments.receipt(
          tx,
          booking,
          obligation.id,
          normalized,
          context.user.id,
          proof?.id,
          true,
        );
        if (proof?.status === 'pending')
          await tx.paymentProof.update({
            where: { id: proof.id },
            data: {
              status: 'verified',
              reviewedBy: context.user.id,
              reviewedAt: this.clock.now(),
            },
          });
        await this.ledger.requestUnusedRefund(
          tx,
          receipt,
          'extension_reconciliation',
          this.clock.now(),
        );
        await this.event(tx, proposal, 'extension.reconciled', context.user.id);
        await this.delay.correctReturns(
          tx,
          booking,
          proposal.id,
          context.user.id,
        );
        return { bookingId: booking.id, decision: proposal.id };
      },
    );
  }
  async expireDue(limit = 100) {
    const candidates = await this.prisma.extension.findMany({
      where: {
        status: 'menunggu_pembayaran',
        expiresAt: { lt: this.clock.now() },
      },
      select: { id: true, bookingId: true },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    let expired = 0,
      failed = 0;
    for (const candidate of candidates) {
      try {
        const changed = await runBusinessTransaction(
          this.prisma,
          async (tx) => {
            await this.payments.lockBooking(tx, candidate.bookingId);
            const proposal = await this.proposal(
              tx,
              candidate.bookingId,
              candidate.id,
            );
            if (
              proposal.status !== 'menunggu_pembayaran' ||
              !proposal.expiresAt ||
              this.clock.now() <= proposal.expiresAt
            )
              return false;
            await this.close(
              tx,
              proposal,
              'kedaluwarsa',
              'Batas pembayaran perpanjangan berakhir.',
            );
            return true;
          },
        );
        if (changed) expired++;
      } catch {
        failed++;
      }
    }
    return { expired, failed };
  }
  async alertDue(limit = 100) {
    const now = this.clock.now();
    const candidates = await this.prisma.$queryRaw<
      { id: string; bookingId: string }[]
    >`
      SELECT e.id, e.booking_id AS "bookingId" FROM extensions e
      WHERE e.status='menunggu_konfirmasi' AND e.confirmation_due_at <= ${now}::timestamp + INTERVAL '30 minutes'
      AND (NOT EXISTS (SELECT 1 FROM outbox_events o WHERE o.event_key='extension.confirmation_reminder:'||e.id::text||':'||(extract(epoch FROM e.confirmation_due_at)*1000)::bigint::text)
      OR (e.confirmation_due_at < ${now}::timestamp AND NOT EXISTS (SELECT 1 FROM outbox_events o WHERE o.event_key='extension.confirmation_overdue:'||e.id::text||':'||(extract(epoch FROM e.confirmation_due_at)*1000)::bigint::text)))
      ORDER BY e.confirmation_due_at,e.id LIMIT ${limit}`;
    let alerted = 0,
      failed = 0;
    for (const candidate of candidates)
      try {
        alerted += await runBusinessTransaction(this.prisma, async (tx) => {
          await this.payments.lockBooking(tx, candidate.bookingId);
          const proposal = await this.proposal(
              tx,
              candidate.bookingId,
              candidate.id,
            ),
            time = this.clock.now(),
            due = proposal.confirmationDueAt;
          if (proposal.status !== 'menunggu_konfirmasi' || !due) return 0;
          let count = 0;
          for (const type of [
            'extension.confirmation_reminder',
            'extension.confirmation_overdue',
          ]) {
            if (
              time.getTime() <
              (type.endsWith('reminder')
                ? due.getTime() - 1800000
                : due.getTime() + 1)
            )
              continue;
            const key = type + ':' + proposal.id + ':' + due.getTime();
            if (await tx.outboxEvent.findUnique({ where: { eventKey: key } }))
              continue;
            await tx.outboxEvent.create({
              data: {
                eventKey: key,
                aggregateType: 'Booking',
                aggregateId: proposal.bookingId,
                eventType: type,
                payload: {
                  bookingId: proposal.bookingId,
                  extensionId: proposal.id,
                  confirmationDueAt: due.toISOString(),
                },
                occurredAt: time,
              },
            });
            count++;
          }
          return count;
        });
      } catch {
        failed++;
      }
    return { alerted, failed };
  }
}
