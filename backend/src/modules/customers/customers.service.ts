import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthContext, AuthService } from '../../auth/auth.service';
import { NikCipher } from '../../auth/crypto';
import { normalizeEmail, normalizePhone } from '../../auth/identity';
import { wibNow } from '../../shared/time/wib';
import { ProfileDto } from './profile.dto';

const profileFields = {
  fullName: true,
  address: true,
  phoneActive: true,
  phoneAlt: true,
  instagram: true,
  emailContact: true,
  completedAt: true,
} satisfies Prisma.CustomerProfileSelect;

@Injectable()
export class CustomersService {
  private readonly cipher: NikCipher;
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.cipher = new NikCipher(
      config.getOrThrow<string>('NIK_KEYS'),
      config.getOrThrow<string>('NIK_ACTIVE_KEY'),
    );
  }
  profile(context: AuthContext) {
    return this.prisma.customerProfile.findUnique({
      where: { userId: context.user.id },
      select: profileFields,
    });
  }
  async saveProfile(context: AuthContext, dto: ProfileDto) {
    const fullName = dto.fullName.trim(),
      address = dto.address.trim();
    if (!fullName || !address)
      throw new BadRequestException('Nama dan alamat wajib diisi.');
    const phoneActive = normalizePhone(dto.phoneActive);
    const phoneAlt =
      dto.phoneAlt === undefined
        ? undefined
        : dto.phoneAlt?.trim()
          ? normalizePhone(dto.phoneAlt)
          : null;
    const emailContact =
      dto.emailContact === undefined
        ? undefined
        : dto.emailContact?.trim()
          ? normalizeEmail(dto.emailContact)
          : null;
    const instagram =
      dto.instagram === undefined ? undefined : dto.instagram?.trim() || null;
    return this.prisma.$transaction(async (tx) => {
      await this.auth.authorizeLocked(tx, context, 'customer');
      const existing = await tx.customerProfile.findUnique({
        where: { userId: context.user.id },
      });
      if (!existing && !dto.nik)
        throw new BadRequestException('NIK wajib untuk melengkapi profil.');
      const nikCiphertext = dto.nik
        ? this.cipher.encrypt(dto.nik, context.user.id)
        : existing!.nikCiphertext;
      const data = {
        fullName,
        address,
        phoneActive,
        phoneAlt,
        emailContact,
        instagram,
        nikCiphertext,
        completedAt: existing?.completedAt ?? wibNow(),
      };
      const result = await tx.customerProfile.upsert({
        where: { userId: context.user.id },
        create: { userId: context.user.id, ...data },
        update: data,
        select: profileFields,
      });
      await tx.user.update({
        where: { id: context.user.id },
        data: { name: fullName },
      });
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          action: 'customer.profile_updated',
          entityType: 'user',
          entityId: context.user.id,
          changes: {
            fields: Object.keys(dto).filter((key) => key !== 'nik'),
            nikChanged: !!dto.nik,
          },
        },
      });
      return result;
    });
  }
  async adminDetail(context: AuthContext, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.auth.authorizeLocked(tx, context, 'admin');
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          profile: { select: { ...profileFields, nikCiphertext: true } },
        },
      });
      if (!user || user.role !== 'customer')
        throw new NotFoundException('Pelanggan tidak ditemukan.');
      const { profile, ...account } = user;
      let detail = null;
      if (profile) {
        const { nikCiphertext, ...safe } = profile;
        detail = { ...safe, nik: this.cipher.decrypt(nikCiphertext, userId) };
        await tx.auditLog.create({
          data: {
            actorId: context.user.id,
            action: 'customer.nik_viewed',
            entityType: 'user',
            entityId: userId,
            changes: {},
          },
        });
      }
      return { ...account, profile: detail };
    });
  }
}
