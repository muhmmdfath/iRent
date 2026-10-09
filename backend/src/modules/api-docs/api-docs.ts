import { INestApplication, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { ModulesContainer } from '@nestjs/core';
import {
  ApiCookieAuth,
  ApiConsumes,
  ApiExtension,
  ApiHeader,
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { sessionCookieName } from '../../auth/auth.guard';

export function createApiDocument(app: INestApplication) {
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype;
      if (!controller) continue;
      const prototype = controller.prototype as Record<string, unknown>;
      for (const name of Object.getOwnPropertyNames(prototype)) {
        const handler = prototype[name];
        if (typeof handler !== 'function') continue;
        const method: RequestMethod | undefined = Reflect.getMetadata(
          METHOD_METADATA,
          handler,
        );
        if (method === undefined) continue;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, name)!;
        const apply = (decorator: MethodDecorator) =>
          decorator(prototype, name, descriptor);
        const isPublic: boolean =
          Reflect.getMetadata('irent.public', handler) ??
          Reflect.getMetadata('irent.public', controller) ??
          false;
        const roles: string[] =
          Reflect.getMetadata('irent.roles', handler) ??
          Reflect.getMetadata('irent.roles', controller) ??
          [];
        if (!isPublic) {
          apply(ApiCookieAuth());
          apply(
            ApiExtension(
              'x-irent-roles',
              roles.length ? roles : ['customer', 'admin'],
            ),
          );
        }
        if (
          ![
            RequestMethod.GET,
            RequestMethod.HEAD,
            RequestMethod.OPTIONS,
          ].includes(method)
        ) {
          apply(
            ApiHeader({
              name: 'Origin',
              required: true,
              description: 'Origin frontend dari CORS_ORIGINS.',
            }),
          );
          if (!isPublic)
            apply(
              ApiHeader({
                name: 'X-CSRF-Token',
                required: true,
                description: 'Token dari login/session.',
              }),
            );
        }
        if (Reflect.getMetadata('irent.proof-upload', handler))
          apply(ApiConsumes('multipart/form-data'));
        const argumentsMetadata: Record<string, { data?: unknown }> =
          Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, name) ?? {};
        if (
          Object.entries(argumentsMetadata).some(
            ([key, value]) =>
              key.startsWith(RouteParamtypes.HEADERS + ':') &&
              value.data === 'idempotency-key',
          )
        )
          apply(
            ApiHeader({
              name: 'Idempotency-Key',
              required: true,
              description:
                'Kunci 1–128 karakter; gunakan kembali saat retry payload yang sama.',
            }),
          );
      }
    }
  }
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('iRent Semarang API')
      .setVersion('1.0')
      .setDescription(
        'Rupiah: string desimal; waktu: ISO WIB +07:00. Mutasi: Origin dan X-CSRF-Token; aksi bisnis: Idempotency-Key sesuai backend/API.md. Response rinci mengikuti dokumentasi modul.',
      )
      .addCookieAuth(
        sessionCookieName(
          app.get(ConfigService).get<string>('NODE_ENV') === 'production',
        ),
      )
      .build(),
  );
  for (const path of Object.values(document.paths)) {
    const operation = path?.post;
    if (!operation) continue;
    const body = operation.requestBody;
    if (body && !('$ref' in body) && body.content['multipart/form-data']) {
      const existing = body.content['multipart/form-data'].schema;
      body.content['multipart/form-data'].schema = {
        allOf: [
          existing ?? { type: 'object' },
          {
            type: 'object',
            required: ['file'],
            properties: { file: { type: 'string', format: 'binary' } },
          },
        ],
      };
      body.required = true;
    }
  }
  // Uploads with no text DTO still require a binary file.
  for (const route of [
    '/api/admin/items/{id}/photo',
    '/api/admin/settings/qris-image',
  ]) {
    const operation = document.paths[route]?.post;
    if (operation)
      operation.requestBody = {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file'],
              properties: { file: { type: 'string', format: 'binary' } },
            },
          },
        },
      };
  }
  return document;
}
