import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role';

import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesDto } from './dto/list-services.dto';
import { FinanceService } from '../finance/finance.service';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(
    private readonly services: ServicesService,
    private readonly finance: FinanceService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List repair-job/services with payment aggregation' })
  list(@StoreId() storeId: string, @Query() q: ListServicesDto) {
    return this.services.list(storeId, q);
  }

  @Get('management/list')
  @ApiOperation({ summary: 'Lightweight list of services (for selection components)' })
  listLight(@StoreId() storeId: string, @Query() q: ListServicesDto) {
    return this.services.list(storeId, q);
  }

  @Post('management')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Create a repair-job/service' })
  create(@StoreId() storeId: string, @Body() dto: CreateServiceDto) {
    return this.services.create(storeId, dto);
  }

  @Get('service-payments')
  @ApiOperation({ summary: 'Payment history for a service (by serviceId or publicId)' })
  payments(@StoreId() storeId: string, @Query('serviceId') serviceId: string) {
    return this.finance.paymentsForService(storeId, serviceId);
  }

  @Put('management/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Update a service (status, finalPrice, etc.)' })
  update(
    @StoreId() storeId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateServiceDto>,
  ) {
    return this.services.update(storeId, id, dto);
  }
}
