import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RisksService } from './risks.service';

@Injectable()
export class RiskWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RiskWorker.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  constructor(
    private readonly risks: RisksService,
    private readonly config: ConfigService,
  ) {}
  onModuleInit() {
    if (
      this.config.get<string>('RISK_WORKER_ENABLED') !== 'true' ||
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
      const result = await this.risks.scanDue();
      if (result.failed)
        this.logger.warn(
          `${result.failed} risiko unit gagal diproses; akan dicoba ulang.`,
        );
    } catch {
      this.logger.error(
        'Pemindaian risiko unit gagal; worker akan mencoba lagi pada siklus berikutnya.',
      );
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
