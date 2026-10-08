import { ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from './prisma.service';

function retryable(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2034') return true;
  const adapter = error.meta?.driverAdapterError;
  const cause =
    adapter && typeof adapter === 'object' && 'cause' in adapter
      ? adapter.cause
      : undefined;
  const code =
    cause && typeof cause === 'object' && 'originalCode' in cause
      ? cause.originalCode
      : error.meta?.code;
  return ['40P01', '55P03'].includes(String(code));
}

export async function runBusinessTransaction<T>(
  prisma: PrismaService,
  action: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
          return action(tx);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 10000,
          timeout: 20000,
        },
      );
    } catch (error) {
      if (!retryable(error)) throw error;
      if (attempt === 2)
        throw new ServiceUnavailableException(
          'Sistem sedang sibuk. Ulangi dengan Idempotency-Key yang sama.',
        );
    }
  }
  throw new ServiceUnavailableException();
}
