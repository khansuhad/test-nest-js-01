import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/types/auth-user';
import { generatePublicId } from '../../common/utils/public-id';
import { CreateStoreDto } from './dto/create-store.dto';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the principal's active store (the JWT pins us to a single tenant).
   */
  async getActiveStore(user: AuthUser) {
    const store = await this.prisma.store.findFirst({
      where: { id: user.storeId, deletedAt: null },
      include: { subscription: { include: { plan: true } } },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async listForUser(user: AuthUser) {
    const store = await this.prisma.store.findFirst({
      where: { id: user.storeId, deletedAt: null },
    });
    return store ? [store] : [];
  }

  /**
   * Update the active store's profile (name/contact/address).
   * Used by PUT-style /stores/management calls — the spec sends a POST and treats it as an upsert/update.
   */
  async upsertProfile(dto: CreateStoreDto, user: AuthUser) {
    const existing = await this.prisma.store.findFirst({
      where: { id: user.storeId, deletedAt: null },
    });
    if (existing) {
      const updated = await this.prisma.store.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          address: dto.address,
          ...(dto.slug && { slug: dto.slug }),
          ...(dto.currency && { currency: dto.currency }),
          ...(dto.timezone && { timezone: dto.timezone }),
        },
      });
      return { message: 'Store updated', data: updated };
    }
    return this.create(dto, user);
  }

  async create(dto: CreateStoreDto, user: AuthUser) {
    const store = await this.createWithRetry(dto, user);
    return {
      message: 'Store created successfully',
      data: { storeId: store.id, storePublicId: store.publicId, store },
    };
  }

  async listDevices(storeId: string) {
    return this.prisma.deviceLogin.findMany({
      where: { storeId },
      orderBy: { lastLoginAt: 'desc' },
    });
  }

  private async createWithRetry(dto: CreateStoreDto, user: AuthUser, attempt = 0): Promise<any> {
    try {
      return await this.prisma.store.create({
        data: {
          publicId: generatePublicId(),
          name: dto.name,
          slug: dto.slug,
          ownerId: user.userId,
          email: dto.email,
          phone: dto.phone,
          address: dto.address,
          currency: dto.currency ?? 'USD',
          timezone: dto.timezone ?? 'UTC',
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        attempt < 3
      ) {
        return this.createWithRetry(dto, user, attempt + 1);
      }
      throw err;
    }
  }
}
