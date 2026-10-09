import {
  Body,
  Controller,
  Get,
  Headers,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AuthRequest, Roles } from '../../auth/auth.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { PageDto } from '../inventory/inventory.dto';
import { PricingModule } from '../pricing/pricing.module';
import { QuoteDto } from '../pricing/pricing.dto';
import { SettingsModule } from '../settings/settings.module';
import { CreateBookingDto, BookingListDto } from './bookings.dto';
import { BookingsService } from './bookings.service';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}
  @Post() @Roles('customer') create(
    @Req() req: AuthRequest,
    @Body() dto: CreateBookingDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.bookings.create(req.auth, dto, key);
  }
  @Post('availability') @Roles('customer') availability(
    @Req() req: AuthRequest,
    @Body() dto: QuoteDto,
  ) {
    return this.bookings.availability(req.auth, dto);
  }
  @Get() @Roles('customer') list(
    @Req() req: AuthRequest,
    @Query() page: BookingListDto,
  ) {
    return this.bookings.list(req.auth, page);
  }
  @Get(':id') detail(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.bookings.detail(req.auth, id);
  }
}
@Controller('admin/bookings')
@Roles('admin')
export class AdminBookingsController {
  constructor(private readonly bookings: BookingsService) {}
  @Get() list(@Req() req: AuthRequest, @Query() page: PageDto) {
    return this.bookings.list(req.auth, page, true);
  }
}
@Module({
  imports: [AuthModule, PrismaModule, SettingsModule, PricingModule],
  providers: [BookingsService],
  controllers: [BookingsController, AdminBookingsController],
  exports: [BookingsService],
})
export class BookingsModule {}
