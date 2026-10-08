import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { Prisma, UserRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { wibNow } from '../shared/time/wib';
import { csrfToken, digest, hashPassword, verifyPassword } from './crypto';
import { RegisterDto } from './auth.dto';
import { normalizeEmail, normalizeIdentity, normalizePhone } from './identity';

const publicUser = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  profile: { select: { completedAt: true } },
} satisfies Prisma.UserSelect;
export type SafeUser = Prisma.UserGetPayload<{ select: typeof publicUser }>;
export interface AuthContext {
  user: SafeUser;
  sessionId: string;
  token: string;
  csrfToken: string;
  authVersion: number;
}
const SESSION_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
  async throttle(
    scope: string,
    identity: string,
    limit: number,
    seconds: number,
  ): Promise<void> {
    const key = digest(scope + ':' + identity);
    const result = await this.prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO auth_rate_limits(key,count,reset_at)
      VALUES(${key},1,(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta') + ${seconds} * INTERVAL '1 second')
      ON CONFLICT(key) DO UPDATE SET
        count=CASE WHEN auth_rate_limits.reset_at <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta') THEN 1 ELSE auth_rate_limits.count+1 END,
        reset_at=CASE WHEN auth_rate_limits.reset_at <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')
          THEN (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta') + ${seconds} * INTERVAL '1 second' ELSE auth_rate_limits.reset_at END
      RETURNING count`;
    if (result[0].count > limit)
      throw new HttpException(
        'Terlalu banyak percobaan. Coba lagi nanti.',
        429,
      );
  }
  async register(dto: RegisterDto, actor?: AuthContext) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Nama wajib diisi.');
    const email = dto.email === undefined ? null : normalizeEmail(dto.email);
    const phone = dto.phone === undefined ? null : normalizePhone(dto.phone);
    if (!email && !phone)
      throw new BadRequestException('Isi email atau nomor HP.');
    const passwordHash = await hashPassword(dto.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (actor) await this.authorizeLocked(tx, actor, 'admin');
        const user = await tx.user.create({
          data: {
            name,
            email,
            phone,
            passwordHash,
            role: actor ? 'admin' : 'customer',
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor?.user.id ?? user.id,
            action: actor ? 'admin.created' : 'customer.registered',
            entityType: 'user',
            entityId: user.id,
            changes: {},
          },
        });
        if (actor)
          return {
            user: await tx.user.findUniqueOrThrow({
              where: { id: user.id },
              select: publicUser,
            }),
          };
        return this.issueSession(tx, user.id, user.authVersion);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Email atau nomor HP sudah digunakan.');
      throw error;
    }
  }
  async login(identity: string, password: string) {
    let where: ReturnType<typeof normalizeIdentity> | undefined;
    try {
      where = normalizeIdentity(identity);
    } catch {
      /* Uniform credentials error below. */
    }
    const user = where ? await this.prisma.user.findUnique({ where }) : null;
    const valid = await verifyPassword(password, user?.passwordHash ?? '');
    if (!valid || !user?.isActive)
      throw new UnauthorizedException(
        'Email/nomor HP atau password tidak sesuai.',
      );
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${user.id}::uuid FOR UPDATE`;
      const current = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      if (!current.isActive || current.passwordHash !== user.passwordHash)
        throw new UnauthorizedException('Silakan login kembali.');
      return this.issueSession(tx, current.id, current.authVersion);
    });
  }
  private async issueSession(
    tx: Prisma.TransactionClient,
    userId: string,
    authVersion: number,
  ) {
    const token = randomBytes(32).toString('base64url'),
      now = wibNow();
    await tx.authSession.create({
      data: {
        userId,
        authVersion,
        tokenHash: digest(token),
        expiresAt: new Date(now.getTime() + SESSION_MS),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'auth.session_created',
        entityType: 'user',
        entityId: userId,
        changes: {},
      },
    });
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: publicUser,
    });
    return {
      user,
      token,
      csrfToken: csrfToken(
        token,
        this.config.getOrThrow<string>('CSRF_SECRET'),
      ),
    };
  }
  async authenticate(token: string): Promise<AuthContext> {
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: digest(token) },
      include: {
        user: { select: { ...publicUser, isActive: true, authVersion: true } },
      },
    });
    if (
      !session ||
      session.expiresAt.getTime() <= wibNow().getTime() ||
      !session.user.isActive ||
      session.authVersion !== session.user.authVersion
    ) {
      throw new UnauthorizedException('Silakan login.');
    }
    const { isActive: _, authVersion, ...user } = session.user;
    void _;
    return {
      user,
      sessionId: session.id,
      token,
      authVersion,
      csrfToken: csrfToken(
        token,
        this.config.getOrThrow<string>('CSRF_SECRET'),
      ),
    };
  }
  async authorizeLocked(
    tx: Prisma.TransactionClient,
    context: AuthContext,
    role?: UserRole,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM users WHERE id=${context.user.id}::uuid FOR UPDATE`;
    const current = await tx.user.findUnique({
      where: { id: context.user.id },
    });
    const session = await tx.authSession.findUnique({
      where: { id: context.sessionId },
    });
    if (
      !current?.isActive ||
      current.authVersion !== context.authVersion ||
      !session ||
      session.userId !== context.user.id ||
      session.authVersion !== current.authVersion ||
      session.expiresAt.getTime() <= wibNow().getTime()
    )
      throw new UnauthorizedException('Silakan login kembali.');
    if (role && current.role !== role)
      throw new ForbiddenException('Akses tidak diizinkan.');
  }
  async logout(context: AuthContext): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.authorizeLocked(tx, context);
      await tx.authSession.delete({ where: { id: context.sessionId } });
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          action: 'auth.logout',
          entityType: 'user',
          entityId: context.user.id,
          changes: {},
        },
      });
    });
  }
  async resetCustomerPassword(
    context: AuthContext,
    userId: string,
    password: string,
  ): Promise<void> {
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction(async (tx) => {
      await this.authorizeLocked(tx, context, 'admin');
      await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.role !== 'customer')
        throw new BadRequestException('Pelanggan tidak ditemukan.');
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, authVersion: { increment: 1 } },
      });
      await tx.authSession.deleteMany({ where: { userId } });
      await tx.auditLog.create({
        data: {
          actorId: context.user.id,
          action: 'customer.password_reset',
          entityType: 'user',
          entityId: userId,
          changes: {},
        },
      });
    });
  }
}
