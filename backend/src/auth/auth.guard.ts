import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UserRole } from '../generated/prisma/client';
import { parseCorsOrigins } from '../config/environment';
import { AuthContext, AuthService } from './auth.service';
import { equalToken } from './crypto';
import { normalizeIdentity } from './identity';

export const Public = () => SetMetadata('irent.public', true);
export const Roles = (...roles: UserRole[]) =>
  SetMetadata('irent.roles', roles);
export const ProofUploadRoute = () => SetMetadata('irent.proof-upload', true);
export interface AuthRequest extends Request {
  auth: AuthContext;
}
export function sessionCookieName(production: boolean): string {
  return production ? '__Host-irent_session' : 'irent_session';
}
function cookieToken(req: Request, name: string): string | undefined {
  const entries = (req.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim().split('='));
  const found = entries.filter(([key]) => key === name);
  if (
    found.length !== 1 ||
    found[0].length !== 2 ||
    !/^[A-Za-z0-9_-]{43}$/.test(found[0][1])
  )
    return undefined;
  return found[0][1];
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const response = context
      .switchToHttp()
      .getResponse<{ setHeader: (name: string, value: string) => void }>();
    const metadata = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      'irent.public',
      metadata,
    );
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    const proofUpload = this.reflector.getAllAndOverride<boolean>(
      'irent.proof-upload',
      metadata,
    );
    if (unsafe) {
      const origin = request.headers.origin;
      if (
        !origin ||
        !parseCorsOrigins(
          this.config.getOrThrow<string>('CORS_ORIGINS'),
        ).includes(origin)
      )
        throw new ForbiddenException('Origin tidak diizinkan.');
      if (!request.is(proofUpload ? 'multipart/form-data' : 'application/json'))
        throw new ForbiddenException(
          proofUpload
            ? 'Gunakan multipart/form-data.'
            : 'Gunakan request JSON.',
        );
    }
    if (isPublic) {
      if (unsafe) {
        const login = context.getHandler().name === 'login';
        await this.auth.throttle(
          login ? 'login.ip' : 'register.ip',
          request.ip ?? request.socket.remoteAddress ?? 'unknown',
          login ? 30 : 5,
          login ? 900 : 3600,
        );
        if (login) {
          const body: unknown = request.body;
          const identity =
            body &&
            typeof body === 'object' &&
            'identity' in body &&
            typeof body.identity === 'string'
              ? body.identity.slice(0, 254)
              : '';
          let normalized = identity.trim().toLowerCase();
          try {
            normalized = JSON.stringify(normalizeIdentity(identity));
          } catch {
            /* Invalid identity is still throttled. */
          }
          await this.auth.throttle('login.identity', normalized, 10, 900);
        }
      }
      return true;
    }
    response.setHeader('Cache-Control', 'no-store');
    const token = cookieToken(
      request,
      sessionCookieName(this.config.get<string>('NODE_ENV') === 'production'),
    );
    if (!token) throw new UnauthorizedException('Silakan login.');
    request.auth = await this.auth.authenticate(token);
    const roles = this.reflector.getAllAndOverride<UserRole[]>(
      'irent.roles',
      metadata,
    );
    if (roles && !roles.includes(request.auth.user.role))
      throw new ForbiddenException('Akses tidak diizinkan.');
    if (
      unsafe &&
      !equalToken(request.headers['x-csrf-token'], request.auth.csrfToken)
    )
      throw new ForbiddenException('Token CSRF tidak valid.');
    if (proofUpload)
      await this.auth.throttle(
        'proof.upload.user',
        request.auth.user.id,
        20,
        3600,
      );
    return true;
  }
}
