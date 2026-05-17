import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlansService } from './plans.service';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('plans')
@ApiBearerAuth()
@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get('management')
  @Public()
  @ApiOperation({ summary: 'List subscription plans catalog (public)' })
  catalog() {
    return this.plans.list();
  }

  @Get('status')
  @ApiOperation({ summary: 'Active plan + usage counters for the current store' })
  status(@StoreId() storeId: string) {
    return this.plans.statusForStore(storeId);
  }

  // legacy
  @Get()
  list() {
    return this.plans.list();
  }
}
