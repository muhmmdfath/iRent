import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NoShowService } from './no-show.service';

@Injectable()
export class NoShowWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NoShowWorker.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  constructor(
    private readonly noShow: NoShowService,
    private readonly config: ConfigService,
  ) {}
  onModuleInit() {
    if (
      this.config.get<string>('NO_SHOW_WORKER_ENABLED') !== 'true' ||
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
      const result = await this.noShow.processDue();
      if (result.failed)
        this.logger.warn(
          `${result.failed} booking gagal diproses pada siklus no-show; akan dicoba ulang.`,
        );
    } catch {
      this.logger.error(
        'No-show gagal diproses; worker akan mencoba lagi pada siklus berikutnya.',
      );
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
