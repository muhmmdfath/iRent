import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { parseCorsOrigins } from './config/environment';
import { ApiValueInterceptor } from './shared/http/api-value.interceptor';
import { ApiDocsService } from './modules/api-docs/api-docs.module';
import { createApiDocument } from './modules/api-docs/api-docs';

export function setupApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  // Public paths stored in item/settings snapshots remain /media/... .
  app.use(
    (
      req: import('express').Request,
      _res: import('express').Response,
      next: import('express').NextFunction,
    ) => {
      if (req.url.startsWith('/media/')) req.url = '/api' + req.url;
      next();
    },
  );
  app.disable('x-powered-by');
  // Production API is private, behind the single Caddy edge proxy.
  // Preserve client IPs so authentication limits are not shared by all users.
  if (app.get(ConfigService).get<string>('NODE_ENV') === 'production') {
    app.set('trust proxy', 1);
  }
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
  // Expose the document through a guarded controller, never a public Swagger middleware.
  app.get(ApiDocsService).document = createApiDocument(app);
}
