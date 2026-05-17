import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiEnvelope<T> {
  success: true;
  statusCode: number;
  message?: string;
  data: T;
  meta?: Record<string, unknown>;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiEnvelope<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiEnvelope<T>> {
    const res = context.switchToHttp().getResponse();
    return next.handle().pipe(
      map((raw: any) => {
        // Pass-through if the handler already returned a finished envelope.
        if (raw && typeof raw === 'object' && 'success' in raw && 'data' in raw) {
          return raw as ApiEnvelope<T>;
        }

        // A handler may return { message?, data?, meta? } to set headline fields.
        let message: string | undefined;
        let meta: Record<string, unknown> | undefined;
        let data: any = raw;

        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          const looksWrapped =
            'data' in raw || 'message' in raw || 'meta' in raw;
          if (looksWrapped) {
            message = typeof raw.message === 'string' ? raw.message : undefined;
            meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : undefined;
            data = 'data' in raw ? raw.data : raw;
          }
        }

        return {
          success: true,
          statusCode: res.statusCode ?? 200,
          ...(message ? { message } : {}),
          data,
          ...(meta ? { meta } : {}),
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
