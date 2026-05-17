import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StoreId } from '../../common/decorators/store-id.decorator';
import { AuthUser } from '../../common/types/auth-user';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the currently authenticated user (cached)' })
  getMe(@CurrentUser() user: AuthUser) {
    return this.users.getMe(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id within the active store' })
  getById(@Param('id') id: string, @StoreId() storeId: string) {
    return this.users.getById(id, storeId);
  }
}
