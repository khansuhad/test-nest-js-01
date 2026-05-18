import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { SeedSecretGuard } from './guards/seed-secret.guard';
import { SeedService } from './seed.service';

@Module({
  controllers: [AdminController],
  providers: [SeedService, SeedSecretGuard],
})
export class AdminModule {}
