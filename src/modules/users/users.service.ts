import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CacheKeys } from '../../common/utils/cache-keys';
import { AuthUser } from '../../common/types/auth-user';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async getMe(user: AuthUser) {
    const ttl = this.config.get<number>('cacheTtl.user') ?? 300;
    return this.redis.wrap(CacheKeys.user(user.userId), ttl, async () => {
      const row = await this.prisma.user.findFirst({
        where: { id: user.userId, storeId: user.storeId, deletedAt: null },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          storeId: true,
          isActive: true,
          createdAt: true,
        },
      });
      if (!row) throw new NotFoundException('User not found');
      return row;
    });
  }

  async getById(id: string, storeId: string) {
    const row = await this.prisma.user.findFirst({
      where: { id, storeId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        storeId: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!row) throw new NotFoundException('User not found');
    return row;
  }
}
