import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExtensionsService } from './extensions.service';

@Injectable()
export class ExtensionExpiryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExtensionExpiryWorker.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  constructor(
    private readonly extensions: ExtensionsService,
    private readonly config: ConfigService,
  ) {}
  onModuleInit() {
    if (
      this.config.get<string>('EXTENSION_WORKER_ENABLED') !== 'true' ||
      this.config.get<string>('NODE_ENV') === 'test'
    )
      return;
    this.timer = setInterval(() => {
      if (!this.running)
        this.running = this.tick().finally(() => {
          this.running = undefined;
        });
    }, 60000);
    this.timer.unref();
  }
  private async tick() {
    try {
      const result = await this.extensions.expireDue();
      const alerts = await this.extensions.alertDue();
      if (result.failed + alerts.failed)
        this.logger.warn(
          `${result.failed + alerts.failed} pengajuan perpanjangan gagal diproses; akan dicoba ulang.`,
        );
    } catch {
      this.logger.error(
        'Expiry pengajuan perpanjangan gagal; worker akan mencoba lagi pada siklus berikutnya.',
      );
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
