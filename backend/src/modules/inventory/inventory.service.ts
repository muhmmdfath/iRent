import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthContext, AuthService } from '../../auth/auth.service';
import { publicImage, rupiah } from '../settings/settings.rules';
import { BusinessClock } from '../../shared/time/business-clock';
import {
  ItemDto,
  ItemPatchDto,
  PageDto,
  UnitsDto,
  ZoneDto,
} from './inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly clock: BusinessClock,
  ) {}
  async list(page: PageDto, admin = false) {
    const where = admin ? {} : { isActive: true };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.item.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: (page.page - 1) * page.limit,
        take: page.limit,
        include: {
          units: {
            select: {
              isActive: true,
              conditionStatus: true,
              physicalStatus: true,
            },
          },
        },
      }),
      this.prisma.item.count({ where }),
    ]);
    return {
      data: items.map(({ units, ...item }) => ({
        ...item,
        stock: {
          activeUnitCount: units.filter(
            (unit) => unit.isActive && unit.conditionStatus === 'layak',
          ).length,
          readyPhysicalCount: units.filter(
            (unit) =>
              unit.isActive &&
              unit.conditionStatus === 'layak' &&
              unit.physicalStatus === 'ready',
          ).length,
        },
        availabilityChecked: false,
      })),
      total,
      page: page.page,
    };
  }
  async detail(id: string) {
    const item = await this.prisma.item.findFirst({
      where: { id, isActive: true },
    });
    if (!item) throw new NotFoundException('Item tidak ditemukan.');
    return { ...item, availabilityChecked: false };
  }
  async units(itemId: string, page: PageDto) {
    if (
      !(await this.prisma.item.findUnique({
        where: { id: itemId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Item tidak ditemukan.');
    const [data, total] = await this.prisma.$transaction([
      this.prisma.itemUnit.findMany({
        where: { itemId },
        orderBy: { code: 'asc' },
        skip: (page.page - 1) * page.limit,
        take: page.limit,
      }),
      this.prisma.itemUnit.count({ where: { itemId } }),
    ]);
    return { data, total, page: page.page };
  }
  private async audit(
    tx: Prisma.TransactionClient,
    context: AuthContext,
    action: string,
    entityType: string,
    entityId: string,
    changes: Prisma.InputJsonValue = {},
  ) {
    await tx.auditLog.create({
      data: { actorId: context.user.id, action, entityType, entityId, changes },
    });
  }
  private itemData(dto: ItemDto | ItemPatchDto) {
    const data: {
      name?: string;
      includes?: string[];
      photoPath?: string | null;
      price6h?: bigint;
      price12h?: bigint;
      price24h?: bigint;
      isActive?: boolean;
    } = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Nama item wajib diisi.');
      data.name = name;
    }
    if (dto.includes !== undefined) {
      if (dto.includes.some((value) => !value.trim()))
        throw new BadRequestException('Isi paket tidak boleh kosong.');
      data.includes = dto.includes.map((value) => value.trim());
    }
    if (dto.photoPath !== undefined)
      data.photoPath = publicImage(dto.photoPath, 'items');
    if (dto.price6h !== undefined) data.price6h = rupiah(dto.price6h);
    if (dto.price12h !== undefined) data.price12h = rupiah(dto.price12h);
    if (dto.price24h !== undefined) data.price24h = rupiah(dto.price24h);
    if ('isActive' in dto && dto.isActive !== undefined)
      data.isActive = dto.isActive;
    return data;
  }
  async createItem(context: AuthContext, dto: ItemDto) {
    const data = this.itemData(dto);
    if (
      data.name === undefined ||
      data.includes === undefined ||
      data.price6h === undefined ||
      data.price12h === undefined ||
      data.price24h === undefined
    )
      throw new BadRequestException('Data item belum lengkap.');
    const complete = {
      category: dto.category,
      name: data.name,
      includes: data.includes,
      photoPath: data.photoPath,
      price6h: data.price6h,
      price12h: data.price12h,
      price24h: data.price24h,
    };
    return this.prisma.$transaction(async (tx) => {
      await this.auth.authorizeLocked(tx, context, 'admin');
      const item = await tx.item.create({
        data: complete,
      });
      await this.audit(tx, context, 'inventory.item_created', 'item', item.id);
      return item;
    });
  }
  async updateItem(context: AuthContext, id: string, dto: ItemPatchDto) {
    const data = this.itemData(dto);
    if (!Object.keys(data).length)
      throw new BadRequestException('Isi perubahan item.');
    return this.prisma.$transaction(async (tx) => {
      await this.auth.authorizeLocked(tx, context, 'admin');
      await this.lockItem(tx, id);
      const item = await tx.item.update({ where: { id }, data });
      await this.audit(tx, context, 'inventory.item_updated', 'item', id, {
        fields: Object.keys(data),
      });
      return item;
    });
  }
  private async lockItem(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM items WHERE id=${id}::uuid FOR UPDATE`;
    const item = await tx.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item tidak ditemukan.');
    return item;
  }
  async addUnits(context: AuthContext, itemId: string, dto: UnitsDto) {
    if (
      dto.quantity !== undefined &&
      (!Number.isInteger(dto.quantity) ||
        dto.quantity < 1 ||
        dto.quantity > 100)
    )
      throw new BadRequestException('Quantity unit tidak valid.');
    if (
      dto.codes !== undefined &&
      (!dto.codes.length ||
        dto.codes.length > 100 ||
        dto.codes.some((code) => !/^[A-Za-z0-9-]{1,64}$/.test(code)))
    )
      throw new BadRequestException('Kode unit tidak valid.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.auth.authorizeLocked(tx, context, 'admin');
        const item = await this.lockItem(tx, itemId);
        let codes: string[];
        if (item.category === 'accessory') {
          if (dto.codes !== undefined || dto.quantity === undefined)
            throw new BadRequestException(
              'Aksesori memakai quantity dan kode otomatis.',
            );
          const counter = await tx.businessCounter.upsert({
            where: { key: 'accessory.code' },
            create: { key: 'accessory.code', value: BigInt(dto.quantity) },
            update: { value: { increment: BigInt(dto.quantity) } },
          });
          const first = counter.value - BigInt(dto.quantity) + 1n;
          codes = Array.from(
            { length: dto.quantity },
            (_, index) =>
              'ACC' + (first + BigInt(index)).toString().padStart(6, '0'),
          );
        } else {
          if (!dto.codes || dto.quantity !== undefined)
            throw new BadRequestException('iPhone memakai daftar kode unit.');
          codes = dto.codes.map((code) => code.toUpperCase());
          if (codes.some((code) => /^ACC[0-9]+$/.test(code)))
            throw new BadRequestException(
              'Kode ACC numerik khusus untuk aksesori otomatis.',
            );
          if (new Set(codes).size !== codes.length)
            throw new BadRequestException('Kode unit duplikat.');
        }
        const units = [];
        for (const code of codes)
          units.push(await tx.itemUnit.create({ data: { itemId, code } }));
        await this.audit(
          tx,
          context,
          'inventory.units_created',
          'item',
          itemId,
          { codes },
        );
        return units;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Kode unit sudah digunakan.');
      throw error;
    }
  }
  private async lockUnit(tx: Prisma.TransactionClient, id: string) {
    const reference = await tx.itemUnit.findUnique({
      where: { id },
      select: { itemId: true },
    });
    if (!reference) throw new NotFoundException('Unit tidak ditemukan.');
    await this.lockItem(tx, reference.itemId);
    await tx.$queryRaw`SELECT id FROM item_units WHERE id=${id}::uuid FOR UPDATE`;
    return tx.itemUnit.findUniqueOrThrow({ where: { id } });
  }
  private async requireFree(tx: Prisma.TransactionClient, id: string) {
    if (
      await tx.unitAllocation.count({
        where: { itemUnitId: id, state: 'active' },
      })
    )
      throw new ConflictException(
        'Unit masih memiliki alokasi aktif. Selesaikan alokasinya terlebih dahulu.',
      );
  }
  async active(context: AuthContext, id: string, isActive: boolean) {
    return this.prisma.$transaction(async (tx) => {
      await this.auth.authorizeLocked(tx, context, 'admin');
      const unit = await this.lockUnit(tx, id);
      if (unit.isActive === isActive) return unit;
      if (unit.conditionStatus !== 'layak' || unit.physicalStatus !== 'ready')
        throw new ConflictException(
          'Hanya unit bebas dan layak yang dapat diubah status aktifnya.',
        );
      await this.requireFree(tx, id);
      const result = await tx.itemUnit.update({
        where: { id },
        data: { isActive },
      });
      await this.audit(
        tx,
        context,
        'inventory.unit_active_changed',
        'item_unit',
        id,
        { isActive },
      );
      return result;
    });
  }
  async startMaintenance(context: AuthContext, id: string, reason: string) {
    if (!reason.trim())
      throw new BadRequestException('Alasan perawatan wajib diisi.');
    return this.prisma.$transaction(async (tx) => {
      await this.auth.authorizeLocked(tx, context, 'admin');
      const unit = await this.lockUnit(tx, id);
      if (unit.conditionStatus !== 'layak' || unit.physicalStatus !== 'ready')
        throw new ConflictException('Unit belum bebas untuk perawatan.');
      await this.requireFree(tx, id);
      const result = await tx.itemUnit.update({
        where: { id },
        data: {
          conditionStatus: 'maintenance',
          physicalStatus: 'awaiting_check',
          notes: reason.trim(),
          maintenanceCompletedAt: null,
          preparationUntil: null,
        },
      });
      await this.audit(
        tx,
        context,
        'inventory.maintenance_started',
        'item_unit',
        id,
        { reason: reason.trim() },
      );
      return result;
    });
  }
  async finishMaintenance(context: AuthContext, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.auth.authorizeLocked(tx, context, 'admin');
      const unit = await this.lockUnit(tx, id);
      if (
        unit.conditionStatus !== 'maintenance' ||
        unit.physicalStatus !== 'awaiting_check'
      )
        throw new ConflictException('Unit tidak sedang perawatan.');
      const now = this.clock.now(),
        preparationUntil = new Date(now.getTime() + 60 * 60000);
      const result = await tx.itemUnit.update({
        where: { id },
        data: {
          conditionStatus: 'layak',
          physicalStatus: 'preparing',
          preparationUntil,
          maintenanceCompletedAt: now,
        },
      });
      await this.audit(
        tx,
        context,
        'inventory.maintenance_completed',
        'item_unit',
        id,
        {
          preparationMinutes: 60,
        },
      );
      return result;
    });
  }
  async finishPreparation(context: AuthContext, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.auth.authorizeLocked(tx, context, 'admin');
      const unit = await this.lockUnit(tx, id);
      if (
        unit.conditionStatus !== 'layak' ||
        unit.physicalStatus !== 'preparing' ||
        !unit.preparationUntil ||
        unit.preparationUntil > this.clock.now()
      )
        throw new ConflictException('Persiapan belum selesai.');
      if (
        await tx.bookingItem.count({
          where: {
            itemUnitId: id,
            useStatus: { in: ['in_use', 'return_pending'] },
          },
        })
      )
        throw new ConflictException('Pengembalian unit belum diverifikasi.');
      const result = await tx.itemUnit.update({
        where: { id },
        data: { physicalStatus: 'ready', preparationUntil: null },
      });
      await this.audit(
        tx,
        context,
        'inventory.preparation_completed',
        'item_unit',
        id,
      );
      return result;
    });
  }
  zones(admin = false) {
    return this.prisma.deliveryZone.findMany({
      where: admin ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }
  async saveZone(context: AuthContext, dto: ZoneDto, id?: string) {
    const fee = rupiah(dto.fee);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.auth.authorizeLocked(tx, context, 'admin');
        if (id) {
          await tx.$queryRaw`SELECT id FROM delivery_zones WHERE id=${id}::uuid FOR UPDATE`;
          if (
            !(await tx.deliveryZone.findUnique({
              where: { id },
              select: { id: true },
            }))
          )
            throw new NotFoundException('Zona tidak ditemukan.');
        }
        const data = { name: dto.name.trim(), fee, isActive: dto.isActive };
        if (!data.name) throw new BadRequestException('Nama zona wajib diisi.');
        const zone = id
          ? await tx.deliveryZone.update({ where: { id }, data })
          : await tx.deliveryZone.create({ data });
        await this.audit(
          tx,
          context,
          id ? 'delivery_zone.updated' : 'delivery_zone.created',
          'delivery_zone',
          zone.id,
        );
        return zone;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Nama zona sudah digunakan.');
      throw error;
    }
  }
}
