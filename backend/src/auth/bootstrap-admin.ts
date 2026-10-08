import { ConflictException } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { hashPassword } from './crypto';
import { normalizeEmail, normalizePhone } from './identity';

export async function createFirstAdmin(
  prisma: PrismaClient,
  input: { name: string; email?: string; phone?: string; password: string },
): Promise<void> {
  if (
    !input.name.trim() ||
    input.name.length > 100 ||
    input.password.length < 12 ||
    input.password.length > 128
  )
    throw new Error('Nama/password admin tidak valid.');
  const email = input.email ? normalizeEmail(input.email) : null;
  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (!email && !phone)
    throw new Error('Email atau nomor HP admin wajib diisi.');
  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction(async (tx) => {
    const lock = 'irent.bootstrap-admin';
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock},0))::text`;
    if (await tx.user.count({ where: { role: 'admin' } }))
      throw new ConflictException(
        'Admin pertama sudah tersedia. Gunakan akun admin untuk membuat admin lain.',
      );
    const admin = await tx.user.create({
      data: {
        name: input.name.trim(),
        email,
        phone,
        passwordHash,
        role: 'admin',
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        action: 'admin.bootstrapped',
        entityType: 'user',
        entityId: admin.id,
        changes: {},
      },
    });
  });
}
