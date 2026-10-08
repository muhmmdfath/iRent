import { Body, Controller, Module, Post } from '@nestjs/common';
import { Roles } from '../../auth/auth.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { PricingService } from './pricing.service';
import { QuoteDto } from './pricing.dto';
import { BusinessClock } from '../../shared/time/business-clock';
@Controller('pricing')
@Roles('customer')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}
  @Post('quote') quote(@Body() dto: QuoteDto) {
    return this.pricing.quote(dto);
  }
}
@Module({
  imports: [PrismaModule, SettingsModule],
  providers: [PricingService, BusinessClock],
  controllers: [PricingController],
  exports: [PricingService, BusinessClock],
})
export class PricingModule {}
