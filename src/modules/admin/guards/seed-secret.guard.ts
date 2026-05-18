import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class SeedSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('seed.secret');
    if (!expected) {
      // Endpoint disabled when SEED_SECRET is not configured.
      throw new NotFoundException();
    }

    const req = context.switchToHttp().getRequest();
    const header = req.headers?.['x-seed-secret'];
    const provided = Array.isArray(header) ? header[0] : header;
    if (typeof provided !== 'string' || provided.length === 0) {
      throw new NotFoundException();
    }

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new NotFoundException();
    }

    return true;
  }
}
