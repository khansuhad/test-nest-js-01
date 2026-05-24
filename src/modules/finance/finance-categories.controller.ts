import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FinanceType } from '@prisma/client';

import { UserRole } from '../../common/enums/user-role';

import { FinanceCategoriesService, FinanceCategoryDto } from './finance-categories.service';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('finance-categories')
@ApiBearerAuth()
@Controller('finances/categories')
export class FinanceCategoriesController {
  constructor(private readonly categories: FinanceCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List finance categories (defaults + custom for the active store)' })
  list(
    @StoreId() storeId: string,
    @Query('type') type?: FinanceType,
    @Query('affectType') affectType?: string,
  ) {
    return this.categories.list(storeId, { type, affectType });
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a custom finance category' })
  create(@StoreId() storeId: string, @Body() dto: FinanceCategoryDto) {
    return this.categories.create(storeId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a custom finance category' })
  remove(@StoreId() storeId: string, @Param('id') id: string) {
    return this.categories.remove(storeId, id);
  }
}
