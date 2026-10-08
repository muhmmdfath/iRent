import { Injectable } from '@nestjs/common';
import { wibNow } from './wib';

@Injectable()
export class BusinessClock {
  now(): Date {
    return wibNow();
  }
}
