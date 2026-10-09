import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>('DATABASE_URL');
    const schema =
      new URL(connectionString).searchParams.get('schema') ?? 'public';
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schema))
      throw new Error('Schema database tidak valid.');
    super({
      adapter: new PrismaPg(
        { connectionString, options: '-c search_path=' + schema },
        { schema },
      ),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
