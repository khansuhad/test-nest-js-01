import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/types/auth-user';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email + password and receive a JWT' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the currently authenticated user (decoded from JWT)' })
  me(@CurrentUser() user: AuthUser) {
    return {
      id: user.userId,
      email: user.email,
      role: user.role,
    };
  }

  @Get('users/session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the decoded principal (spec path)' })
  session(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  @Get('users/store-access')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return whether the principal has store access' })
  storeAccess(@CurrentUser() user: AuthUser) {
    return {
      hasAccess: !!user.storeId,
      role: user.role,
      storeId: user.storeId,
    };
  }
}
