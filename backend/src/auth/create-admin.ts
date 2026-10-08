import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { createFirstAdmin } from './bootstrap-admin';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL,
    password = process.env.IRENT_ADMIN_PASSWORD;
  if (!url || !password)
    throw new Error(
      'Isi DATABASE_URL dan kredensial IRENT_ADMIN_* melalui environment lokal.',
    );
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  try {
    await createFirstAdmin(prisma, {
      name: process.env.IRENT_ADMIN_NAME ?? 'Admin iRent',
      email: process.env.IRENT_ADMIN_EMAIL,
      phone: process.env.IRENT_ADMIN_PHONE,
      password,
    });
    console.log('Admin pertama berhasil dibuat.');
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Pembuatan admin gagal. Periksa konfigurasi, kredensial, migrasi, dan apakah admin sudah tersedia.',
  );
  process.exitCode = 1;
});
