import { Controller, Get, Module, Query, Req } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AuthRequest, Roles } from '../../auth/auth.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { PricingModule } from '../pricing/pricing.module';
import { AdminService } from './admin.service';
import {
  CalendarDto,
  TasksDto,
  RefundListDto,
  ExtensionListDto,
} from './admin.dto';
@Controller('admin')
@Roles('admin')
class AdminReadController {
  constructor(private readonly service: AdminService) {}
  @Get('tasks') tasks(@Req() req: AuthRequest, @Query() dto: TasksDto) {
    return this.service.tasks(req.auth, dto);
  }
  @Get('calendar') calendar(
    @Req() req: AuthRequest,
    @Query() dto: CalendarDto,
  ) {
    return this.service.calendar(req.auth, dto);
  }
  @Get('refunds') refunds(
    @Req() req: AuthRequest,
    @Query() dto: RefundListDto,
  ) {
    return this.service.refunds(req.auth, dto);
  }
  @Get('extensions') extensions(
    @Req() req: AuthRequest,
    @Query() dto: ExtensionListDto,
  ) {
    return this.service.extensions(req.auth, dto);
  }
}
@Module({
  imports: [AuthModule, PrismaModule, PricingModule],
  controllers: [AdminReadController],
  providers: [AdminService],
})
export class AdminModule {}
