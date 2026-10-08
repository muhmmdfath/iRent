import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { MAX_RUPIAH } from '../settings/settings.rules';
import { BusinessClock } from '../../shared/time/business-clock';
import { QuoteDto } from './pricing.dto';
import { paymentChoice, rentalPrice, validateSchedule } from './pricing.rules';

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly clock: BusinessClock,
  ) {}
  quote(input: QuoteDto) {
    return this.prisma.$transaction((tx) => this.quoteInTransaction(tx, input));
  }
  async quoteInTransaction(tx: Prisma.TransactionClient, input: QuoteDto) {
    const ids = input.items.map((item) => item.itemId.toLowerCase()).sort();
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('Gabungkan quantity item yang sama.');
    const rules = await this.settings.read(tx);
    await tx.$queryRaw`SELECT id FROM items WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR SHARE`;
    const items = await tx.item.findMany({
      where: { id: { in: ids }, isActive: true },
    });
    if (items.length !== ids.length)
      throw new ConflictException('Ada item yang tidak tersedia di katalog.');
    const lines = input.items.map((selection) => {
      const item = items.find(
        (item) => item.id === selection.itemId.toLowerCase(),
      )!;
      const unitPrice = rentalPrice(item, input.durationHours),
        subtotal = unitPrice * BigInt(selection.quantity);
      if (subtotal > MAX_RUPIAH)
        throw new BadRequestException('Harga melampaui rentang rupiah.');
      return {
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        quantity: selection.quantity,
        unitPrice,
        subtotal,
        tariff6h: item.price6h.toString(),
        tariff12h: item.price12h.toString(),
        tariff24h: item.price24h.toString(),
      };
    });
    if (
      lines
        .filter((line) => line.category === 'iphone')
        .reduce((total, line) => total + line.quantity, 0) > 1
    )
      throw new BadRequestException('Maksimal satu iPhone per booking.');
    let zone = null;
    if (input.deliveryType === 'delivery') {
      if (!input.deliveryZoneId)
        throw new BadRequestException('Zona antar-jemput wajib dipilih.');
      await tx.$queryRaw`SELECT id FROM delivery_zones WHERE id=${input.deliveryZoneId}::uuid FOR SHARE`;
      zone = await tx.deliveryZone.findFirst({
        where: { id: input.deliveryZoneId, isActive: true },
      });
      if (!zone) throw new ConflictException('Zona antar-jemput tidak aktif.');
    } else if (input.deliveryZoneId !== undefined)
      throw new BadRequestException('Pickup tidak memakai zona ongkir.');
    const quotedAt = this.clock.now(),
      schedule = validateSchedule(
        input.startAt,
        input.durationHours,
        rules.values,
        quotedAt,
      );
    const rentalTotal = lines.reduce(
        (total, line) => total + line.subtotal,
        0n,
      ),
      deliveryFee = zone?.fee ?? 0n,
      total = rentalTotal + deliveryFee;
    const payment = paymentChoice(
      total,
      BigInt(rules.values.dp_amount),
      input.payOption,
    );
    return {
      quotedAt,
      ...schedule,
      durationHours: input.durationHours,
      lines,
      rentalTotal,
      deliveryFee,
      grandTotal: total,
      dpSnapshot: rules.values.dp_amount,
      ...payment,
      availabilityChecked: false,
      snapshot: {
        schemaVersion: 1,
        rules,
        items: lines.map((line) => ({
          ...line,
          unitPrice: line.unitPrice.toString(),
          subtotal: line.subtotal.toString(),
        })),
        deliveryZone: zone
          ? { id: zone.id, name: zone.name, fee: zone.fee.toString() }
          : null,
      },
    };
  }
}
