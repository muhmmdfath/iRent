import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { setupApp } from './setup-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  setupApp(app);
  await app.listen(app.get(ConfigService).getOrThrow<number>('PORT'));
}

bootstrap().catch(() => {
  console.error('API gagal dimulai. Periksa konfigurasi dan koneksi database.');
  process.exitCode = 1;
});
