import { TERMS_VERSION } from '../bookings/bookings.dto';
import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { IsObject } from 'class-validator';
import { AuthRequest, Roles, Public } from '../../auth/auth.guard';
import { SettingsService } from './settings.service';

class SettingsPatchDto {
  @IsObject() values!: Record<string, unknown>;
}
@Controller('admin/settings')
@Roles('admin')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}
  @Get() get() {
    return this.settings.read();
  }
  @Patch() update(@Req() req: AuthRequest, @Body() dto: SettingsPatchDto) {
    return this.settings.update(req.auth, dto.values);
  }
}
@Controller('payment-options')
@Public()
export class PaymentOptionsController {
  constructor(private readonly settings: SettingsService) {}
  @Get() async read() {
    const snapshot = await this.settings.read();
    return { qrisImagePath: snapshot.values.qris_image_path };
  }
}

@Controller('rental-policy')
@Public()
export class RentalPolicyController {
  constructor(private readonly settings: SettingsService) {}
  @Get() async read() {
    const { values } = await this.settings.read();
    const keys = [
      'dp_amount',
      'hold_minutes',
      'urgent_threshold_minutes',
      'urgent_hold_minutes',
      'min_lead_minutes',
      'confirm_sla_hours',
      'urgent_confirm_minutes',
      'confirm_before_pickup_minutes',
      'open_time',
      'close_time',
      'max_duration_hours',
      'booking_open_day',
      'late_tolerance_minutes',
      'late_fee_per_hour',
      'cancel_refund_cutoff_days',
      'cancel_refund_percent',
      'cancel_full_refund_percent',
      'no_show_minutes',
      'extension_min_lead_minutes',
      'extension_hold_minutes',
    ] as const;
    return {
      termsVersion: TERMS_VERSION,
      values: Object.fromEntries(keys.map((key) => [key, values[key]])),
    };
  }
}
