import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { SeedSecretGuard } from './guards/seed-secret.guard';
import { SeedService, SeedSummary } from './seed.service';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly seed: SeedService) {}

  @Public()
  @UseGuards(SeedSecretGuard)
  @Post('seed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Idempotently seed plans, stores, users, and sample records. Requires X-Seed-Secret header.',
  })
  @ApiHeader({ name: 'X-Seed-Secret', required: true })
  async runSeed(): Promise<{ ok: true; summary: SeedSummary }> {
    const summary = await this.seed.run();
    return { ok: true, summary };
  }
}
