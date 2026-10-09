import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { writeFile } from 'node:fs/promises';
import { AppModule } from './app.module';
import { setupApp } from './setup-app';
import { ApiDocsService } from './modules/api-docs/api-docs.module';
import { format, resolveConfig } from 'prettier';
async function main() {
  // No listen/init: export route metadata without starting workers or HTTP.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
  });
  try {
    setupApp(app);
    await writeFile(
      'openapi.json',
      await format(JSON.stringify(app.get(ApiDocsService).document), {
        ...(await resolveConfig('openapi.json')),
        parser: 'json',
      }),
    );
  } finally {
    await app.close();
  }
}
main().catch(() => {
  console.error('Ekspor OpenAPI gagal. Periksa build dan konfigurasi.');
  process.exitCode = 1;
});
