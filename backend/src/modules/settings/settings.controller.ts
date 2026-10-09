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
