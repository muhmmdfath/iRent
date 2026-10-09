import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
@Injectable()
export class NotificationsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsWorker.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  constructor(
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}
  onModuleInit() {
    if (
      this.config.get<string>('NOTIFICATION_WORKER_ENABLED') !== 'true' ||
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
      const outbox = await this.notifications.dispatch();
      const schedule = await this.notifications.schedule();
      const delivery = await this.notifications.sendDue();
      if (outbox.failed || schedule.failed || delivery.failed)
        this.logger.warn(
          `Notifikasi tertunda/gagal: outbox ${outbox.failed}, jadwal ${schedule.failed}, delivery ${delivery.failed}.`,
        );
    } catch {
      this.logger.error(
        'Worker notifikasi gagal; antrean akan dicoba pada siklus berikutnya.',
      );
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
