import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { CustomersService } from './customers.service';
import {
  AdminAccountsController,
  ProfileController,
} from './customers.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [CustomersService],
  controllers: [ProfileController, AdminAccountsController],
})
export class CustomersModule {}
