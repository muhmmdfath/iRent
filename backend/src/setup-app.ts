import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { parseCorsOrigins } from './config/environment';
import { ApiValueInterceptor } from './shared/http/api-value.interceptor';

export function setupApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  app.disable('x-powered-by');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalInterceptors(new ApiValueInterceptor());
  const origins = parseCorsOrigins(
    app.get(ConfigService).getOrThrow<string>('CORS_ORIGINS'),
  );
  if (origins.length) app.enableCors({ origin: origins, credentials: true });
  app.enableShutdownHooks();
}
