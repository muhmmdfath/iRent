import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { SettingsService } from './settings.service';
import {
  SettingsController,
  PaymentOptionsController,
} from './settings.controller';
@Module({
  imports: [PrismaModule, AuthModule],
  providers: [SettingsService],
  controllers: [SettingsController, PaymentOptionsController],
  exports: [SettingsService],
})
export class SettingsModule {}
