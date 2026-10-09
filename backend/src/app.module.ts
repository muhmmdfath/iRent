import { ExtensionsModule } from './modules/extensions/extensions.module';
import { ReportsModule } from './modules/reports/reports.module';
import { MediaModule } from './modules/media/media.module';
import { AdminModule } from './modules/admin/admin.module';
import { ApiDocsModule } from './modules/api-docs/api-docs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SettingsModule } from './modules/settings/settings.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { OperationsModule } from './modules/operations/operations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    HealthModule,
    AuthModule,
    CustomersModule,
    SettingsModule,
    InventoryModule,
    PricingModule,
    BookingsModule,
    PaymentsModule,
    OperationsModule,
    ExtensionsModule,
    NotificationsModule,
    ReportsModule,
    MediaModule,
    AdminModule,
    ApiDocsModule,
  ],
})
export class AppModule {}
