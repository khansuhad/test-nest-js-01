import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const userId = req.user?.userId ?? 'anon';
    const storeId = req.user?.storeId ?? '-';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          this.logger.log(`${method} ${url} ${ms}ms user=${userId} store=${storeId}`);
        },
        error: (err) => {
          const ms = Date.now() - start;
          this.logger.warn(`${method} ${url} ${ms}ms user=${userId} store=${storeId} ERR=${err?.message}`);
        },
      }),
    );
  }
}
