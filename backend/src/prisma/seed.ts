import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client';

import { settingsDefaults as defaults } from '../modules/settings/settings.rules';

async function seed(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL wajib diisi untuk seed.');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  try {
    await prisma.$transaction(async (transaction) => {
      for (const [key, typedValue] of Object.entries(defaults)) {
        // Preserve existing admin settings. Do not seed credentials or fake shop data.
        await transaction.setting.upsert({
          where: { key },
          update: {},
          create: { key, typedValue: typedValue ?? Prisma.JsonNull },
        });
      }
    });
    console.log(
      'Pengaturan awal tersedia; nilai yang sudah ada dipertahankan.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch(() => {
  console.error('Seed gagal. Periksa database dan migrasi.');
  process.exitCode = 1;
});
