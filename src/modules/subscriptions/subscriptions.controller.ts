import { Body, Controller, ForbiddenException, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { SubscriptionsService } from './subscriptions.service';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Get('status')
  status(@StoreId() storeId: string) {
    return this.subs.status(storeId);
  }

  @Post('management')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create/upgrade subscription plan' })
  manage(@StoreId() storeId: string, @Body() dto: UpgradeSubscriptionDto) {
    return this.subs.upgrade(storeId, dto);
  }

  @Get('check-limit')
  @ApiOperation({ summary: 'Check current usage against plan limits' })
  async checkLimit(
    @StoreId() storeId: string,
    @Query('resource') resource: 'maxCustomers' | 'maxJobsPerMonth' | 'maxUsers',
  ) {
    if (!resource) {
      throw new ForbiddenException('resource query parameter is required');
    }
    return this.subs.checkLimit(storeId, resource);
  }

  // legacy
  @Post('upgrade')
  @Roles(UserRole.ADMIN)
  upgrade(@StoreId() storeId: string, @Body() dto: UpgradeSubscriptionDto) {
    return this.subs.upgrade(storeId, dto);
  }
}
