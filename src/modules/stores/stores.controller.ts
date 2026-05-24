import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role';

import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/types/auth-user';

@ApiTags('stores')
@ApiBearerAuth()
@Controller('stores')
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  // ---- spec paths ----

  @Get('management')
  @ApiOperation({ summary: 'Get the active store profile' })
  getActive(@CurrentUser() user: AuthUser) {
    return this.stores.getActiveStore(user);
  }

  @Post('management')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update the active store profile (creates if missing)' })
  upsert(@Body() dto: CreateStoreDto, @CurrentUser() user: AuthUser) {
    return this.stores.upsertProfile(dto, user);
  }

  @Get('devices')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'List trusted devices for the active store' })
  devices(@StoreId() storeId: string) {
    return this.stores.listDevices(storeId);
  }

  // ---- legacy / convenience ----

  @Get()
  @ApiOperation({ summary: 'List visible stores (always the principal\'s active store)' })
  list(@CurrentUser() user: AuthUser) {
    return this.stores.listForUser(user);
  }
}
