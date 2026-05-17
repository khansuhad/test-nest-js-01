import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { DashboardService } from './dashboard.service';
import { StoreId } from '../../common/decorators/store-id.decorator';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  // spec path
  @Get('analytics/optimized')
  @ApiOperation({ summary: 'Cached KPI snapshot for the active store' })
  optimized(@StoreId() storeId: string) {
    return this.dashboard.overview(storeId);
  }

  // spec alias (legacy typo: "summery")
  @Get('analytics/summery')
  summery(@StoreId() storeId: string) {
    return this.dashboard.overview(storeId);
  }

  // legacy
  @Get('overview')
  overview(@StoreId() storeId: string) {
    return this.dashboard.overview(storeId);
  }
}
