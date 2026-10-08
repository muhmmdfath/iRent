import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { toApiValue } from './api-value';

@Injectable()
export class ApiValueInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next
      .handle()
      .pipe(
        map((value: unknown) =>
          value instanceof StreamableFile ? value : toApiValue(value),
        ),
      );
  }
}
