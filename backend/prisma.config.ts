import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const offlineCommand =
  process.argv.includes('validate') ||
  process.argv.includes('generate') ||
  process.argv.includes('format') ||
  process.argv.includes('--from-empty');
if (!process.env.DATABASE_URL && !offlineCommand) {
  throw new Error('DATABASE_URL wajib diisi untuk operasi database.');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node dist/prisma/seed.js',
  },
  // Validation/client generation do not connect to this development fallback.
  // Application startup and deployment must provide the real DATABASE_URL.
  datasource: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://irent:irent_local@localhost:5432/irent',
  },
});
