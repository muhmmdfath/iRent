import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { InventoryService } from './inventory.service';
import {
  CatalogController,
  InventoryController,
  PublicZonesController,
} from './inventory.controller';
@Module({
  imports: [PrismaModule, AuthModule, SettingsModule],
  providers: [InventoryService],
  controllers: [CatalogController, InventoryController, PublicZonesController],
  exports: [InventoryService],
})
export class InventoryModule {}
