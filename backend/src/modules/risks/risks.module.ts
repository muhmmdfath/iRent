import { Controller, Get, Header, Module, Query, Req } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AuthRequest, Roles } from '../../auth/auth.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { PricingModule } from '../pricing/pricing.module';
import { PageDto } from '../inventory/inventory.dto';
import { RisksService } from './risks.service';
import { RiskWorker } from './risks.worker';
@Controller('admin/bookings')
@Roles('admin')
export class RisksController {
  constructor(private readonly risks: RisksService) {}
  @Get('at-risk') @Header('Cache-Control', 'no-store') list(
    @Req() req: AuthRequest,
    @Query() page: PageDto,
  ) {
    return this.risks.list(req.auth, page);
  }
}
@Module({
  imports: [AuthModule, PrismaModule, PricingModule],
  controllers: [RisksController],
  providers: [RisksService, RiskWorker],
  exports: [RisksService],
})
export class RisksModule {}
