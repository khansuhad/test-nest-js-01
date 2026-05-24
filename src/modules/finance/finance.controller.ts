import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FinanceType } from '@prisma/client';

import { UserRole } from '../../common/enums/user-role';

import { FinanceService } from './finance.service';
import { CreateFinanceDto } from './dto/create-finance.dto';
import { ListFinancesDto } from './dto/list-finances.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/types/auth-user';

@ApiTags('finance')
@ApiBearerAuth()
@Controller('finances')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  // ---------- General finances (cash flow) ----------

  @Get('general-finances/list')
  @ApiOperation({ summary: 'List general finances (cash in/out) — affectType contains "cash"' })
  listGeneral(@StoreId() storeId: string, @Query() q: ListFinancesDto) {
    return this.finance.list(storeId, q, { affectFilter: 'cash' });
  }

  @Post('general-finances/management')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  @ApiOperation({ summary: 'Create a general (cash) finance transaction' })
  createGeneral(@Body() dto: CreateFinanceDto, @CurrentUser() user: AuthUser) {
    // Force affectType=cash if caller didn't specify
    const normalised: CreateFinanceDto = {
      ...dto,
      affectType: dto.affectType ?? 'cash',
    };
    return this.finance.create(normalised, user);
  }

  // ---------- Expenses ----------

  @Get('expenses/list')
  @ApiOperation({ summary: 'List expenses — affectType contains "profit"' })
  listExpenses(@StoreId() storeId: string, @Query() q: ListFinancesDto) {
    // also constrain type to EXPENSE — mutate the DTO instance so the
    // skip/take getters on PaginationDto remain wired
    q.type = FinanceType.EXPENSE;
    return this.finance.list(storeId, q, { affectFilter: 'profit' });
  }

  @Post('expenses/management')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create an expense transaction (forces type=EXPENSE, affectType=profit)' })
  createExpense(@Body() dto: CreateFinanceDto, @CurrentUser() user: AuthUser) {
    const normalised: CreateFinanceDto = {
      ...dto,
      type: FinanceType.EXPENSE,
      affectType: dto.affectType ?? 'profit',
    };
    return this.finance.create(normalised, user);
  }

  // ---------- Balance & summary ----------

  @Get('balance/cash-balance')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Current cash-in-hand snapshot for the active store' })
  cashBalance(@StoreId() storeId: string) {
    return this.finance.cashBalance(storeId);
  }

  @Get('analytics/stats')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Aggregated finance stats (cached)' })
  stats(@StoreId() storeId: string) {
    return this.finance.summary(storeId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Alias for analytics/stats (legacy path)' })
  summary(@StoreId() storeId: string) {
    return this.finance.summary(storeId);
  }

  // ---------- Per-id ----------

  @Get(':id')
  @ApiOperation({ summary: 'Get a single finance transaction by id or publicId' })
  getOne(@StoreId() storeId: string, @Param('id') id: string) {
    return this.finance.getById(storeId, id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Soft-delete a finance transaction' })
  remove(@StoreId() storeId: string, @Param('id') id: string) {
    return this.finance.softDelete(storeId, id);
  }
}
