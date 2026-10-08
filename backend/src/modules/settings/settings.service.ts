import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthContext, AuthService } from '../../auth/auth.service';
import { SettingsValues, validateSettings } from './settings.rules';

export interface RulesSnapshot {
  schemaVersion: 1;
  revision: string;
  values: SettingsValues;
}
@Injectable()
export class SettingsService {
  private cache: RulesSnapshot | undefined;
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}
  async read(tx?: Prisma.TransactionClient): Promise<RulesSnapshot> {
    if (!tx)
      return this.prisma.$transaction((transaction) => this.read(transaction));
    const scope = 'irent.settings';
    await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${scope},0))::text`;
    const revision =
      (
        await tx.businessCounter.findUnique({
          where: { key: 'settings.revision' },
        })
      )?.value.toString() ?? '0';
    if (this.cache?.revision === revision) return structuredClone(this.cache);
    const rows = await tx.setting.findMany();
    const values = validateSettings(
      Object.fromEntries(rows.map((row) => [row.key, row.typedValue])),
    );
    this.cache = { schemaVersion: 1, revision, values };
    return structuredClone(this.cache);
  }
  async update(context: AuthContext, patch: Record<string, unknown>) {
    if (!Object.keys(patch).length)
      throw new BadRequestException('Isi perubahan settings.');
    return this.prisma.$transaction(async (tx) => {
      await this.auth.authorizeLocked(tx, context, 'admin');
      const scope = 'irent.settings';
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope},0))::text`;
      const rows = await tx.setting.findMany();
      const values = validateSettings({
        ...Object.fromEntries(rows.map((row) => [row.key, row.typedValue])),
        ...patch,
      });
      const revision = await tx.businessCounter.upsert({
        where: { key: 'settings.revision' },
        create: { key: 'settings.revision', value: 1n },
        update: { value: { increment: 1 } },
      });
      for (const key of Object.keys(patch)) {
        const setting = await tx.setting.upsert({
          where: { key },
          create: {
            key,
            typedValue: values[key as keyof SettingsValues] ?? Prisma.JsonNull,
            updatedBy: context.user.id,
          },
          update: {
            typedValue: values[key as keyof SettingsValues] ?? Prisma.JsonNull,
            updatedBy: context.user.id,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: context.user.id,
            action: 'settings.updated',
            entityType: 'setting',
            entityId: setting.id,
            changes: {
              key,
              before: rows.find((row) => row.key === key)?.typedValue ?? null,
              after: values[key as keyof SettingsValues],
              revision: revision.value.toString(),
            },
          },
        });
      }
      // Cache is refreshed by a committed revision read, never from an uncommitted update.
      return {
        schemaVersion: 1 as const,
        revision: revision.value.toString(),
        values,
      };
    });
  }
}
