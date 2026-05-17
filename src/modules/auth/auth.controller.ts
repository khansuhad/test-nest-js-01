import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth-user';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  @Get('me')
  @ApiOperation({ summary: 'Return the decoded principal from the bearer token (legacy)' })
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  @Get('users/session')
  @ApiOperation({ summary: 'Return the decoded principal (spec path)' })
  session(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  @Get('users/store-access')
  @ApiOperation({ summary: 'Return whether the principal has store access' })
  storeAccess(@CurrentUser() user: AuthUser) {
    return {
      hasAccess: !!user.storeId,
      role: user.role,
      storeId: user.storeId,
    };
  }
}
