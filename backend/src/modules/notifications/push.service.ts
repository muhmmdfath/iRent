import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthContext, AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { runBusinessTransaction } from '../../prisma/business-transaction';
import { SubscribeDto } from './notifications.dto';
import { validatePush } from './push.rules';
@Injectable()
export class PushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}
  configuration() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY') ?? '';
    return {
      enabled: !!(
        publicKey &&
        this.config.get<string>('VAPID_PRIVATE_KEY') &&
        this.config.get<string>('VAPID_SUBJECT')
      ),
      publicKey,
    };
  }
  async subscribe(context: AuthContext, input: SubscribeDto, agent?: string) {
    validatePush(input.endpoint, input.keys);
    return runBusinessTransaction(this.prisma, async (tx) => {
      await this.auth.authorizeLocked(tx, context, 'admin');
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.endpoint}, 0))::text`;
      const existing = await tx.pushSubscription.findUnique({
        where: { endpoint: input.endpoint },
      });
      if (existing && existing.userId !== context.user.id)
        throw new ConflictException(
          'Subscription dimiliki akun lain; nonaktifkan melalui akun tersebut dahulu.',
        );
      const row = await tx.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        create: {
          userId: context.user.id,
          endpoint: input.endpoint,
          ...input.keys,
          userAgent: agent?.slice(0, 512),
        },
        update: { ...input.keys, userAgent: agent?.slice(0, 512) },
      });
      return { id: row.id };
    });
  }
  unsubscribe(context: AuthContext, endpoint: string) {
    return runBusinessTransaction(this.prisma, async (tx) => {
      await this.auth.authorizeLocked(tx, context, 'admin');
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${endpoint}, 0))::text`;
      await tx.pushSubscription.deleteMany({
        where: { userId: context.user.id, endpoint },
      });
      return { removed: true };
    });
  }
}
