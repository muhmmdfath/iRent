import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Module,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AuthRequest, Roles } from '../../auth/auth.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { PricingModule } from '../pricing/pricing.module';
import { RisksModule } from '../risks/risks.module';
import { PageDto } from '../inventory/inventory.dto';
import { SubscribeDto, UnsubscribeDto } from './notifications.dto';
import { PushService } from './push.service';
import {
  NotificationTransport,
  WhatsAppAdapter,
} from './notification-transport';
import { NotificationsService } from './notifications.service';
import { NotificationsWorker } from './notifications.worker';
@Controller('admin/notifications')
@Roles('admin')
export class NotificationsController {
  constructor(
    private readonly push: PushService,
    private readonly notifications: NotificationsService,
  ) {}
  @Get('configuration') @Header('Cache-Control', 'no-store') configuration() {
    return this.push.configuration();
  }
  @Post('subscriptions') subscribe(
    @Req() req: AuthRequest,
    @Body() input: SubscribeDto,
  ) {
    return this.push.subscribe(req.auth, input, req.headers['user-agent']);
  }
  @Delete('subscriptions') unsubscribe(
    @Req() req: AuthRequest,
    @Body() input: UnsubscribeDto,
  ) {
    return this.push.unsubscribe(req.auth, input.endpoint);
  }
  @Get() @Header('Cache-Control', 'no-store') list(
    @Req() req: AuthRequest,
    @Query() page: PageDto,
  ) {
    return this.notifications.list(req.auth, page);
  }
}
@Module({
  imports: [AuthModule, PrismaModule, PricingModule, RisksModule],
  controllers: [NotificationsController],
  providers: [
    PushService,
    WhatsAppAdapter,
    NotificationTransport,
    NotificationsService,
    NotificationsWorker,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
