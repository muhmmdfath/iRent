import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentExpiryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentExpiryWorker.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  constructor(
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}
  onModuleInit() {
    if (
      this.config.get<string>('PAYMENT_WORKER_ENABLED') !== 'true' ||
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
      const result = await this.payments.expireDue();
      if (result.failed)
        this.logger.warn(
          `${result.failed} booking gagal diproses pada siklus expiry; akan dicoba ulang.`,
        );
    } catch {
      this.logger.error(
        'Expiry booking gagal; worker akan mencoba lagi pada siklus berikutnya.',
      );
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
