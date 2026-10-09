import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webPush from 'web-push';
import { PushSubscription } from '../../generated/prisma/client';
import { validatePush } from './push.rules';
export class DeliveryError extends Error {
  constructor(
    public readonly code: string,
    public readonly permanent = false,
    public readonly expired = false,
  ) {
    super(code);
  }
}
/** Provider selection is intentionally separate from the persisted delivery queue. */
@Injectable()
export class WhatsAppAdapter {
  ready(adminId: string): boolean {
    void adminId;
    return false;
  }
  send(adminId: string, message: string, key: string): Promise<string> {
    void adminId;
    void message;
    void key;
    return Promise.reject(new DeliveryError('whatsapp_not_configured'));
  }
}
@Injectable()
export class NotificationTransport {
  constructor(
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsAppAdapter,
  ) {}
  ready(channel: 'push' | 'whatsapp', adminId: string) {
    return channel === 'whatsapp'
      ? this.whatsapp.ready(adminId)
      : !!(
          this.config.get<string>('VAPID_PUBLIC_KEY') &&
          this.config.get<string>('VAPID_PRIVATE_KEY') &&
          this.config.get<string>('VAPID_SUBJECT')
        );
  }
  async push(
    subscription: PushSubscription,
    payload: { title: string; body: string; url: string; tag: string },
  ) {
    validatePush(subscription.endpoint, {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    });
    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
        {
          TTL: 60,
          timeout: 15000,
          vapidDetails: {
            subject: this.config.getOrThrow<string>('VAPID_SUBJECT'),
            publicKey: this.config.getOrThrow<string>('VAPID_PUBLIC_KEY'),
            privateKey: this.config.getOrThrow<string>('VAPID_PRIVATE_KEY'),
          },
        },
      );
      return 'push_service_accepted';
    } catch (error) {
      const status =
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        typeof error.statusCode === 'number'
          ? error.statusCode
          : 0;
      throw new DeliveryError(
        status ? 'push_http_' + status : 'push_network_error',
        status >= 400 && status < 500 && ![408, 429].includes(status),
        [404, 410].includes(status),
      );
    }
  }
  whatsappMessage(adminId: string, message: string, key: string) {
    return this.whatsapp.send(adminId, message, key);
  }
}
