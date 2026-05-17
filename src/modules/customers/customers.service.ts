import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/types/auth-user';
import { buildPage } from '../../common/utils/pagination';
import { generatePublicId } from '../../common/utils/public-id';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersDto } from './dto/list-customers.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(storeId: string, q: ListCustomersDto) {
    const mode = Prisma.QueryMode.insensitive;
    const where: Prisma.CustomerWhereInput = {
      storeId,
      deletedAt: null,
      ...(q.search && {
        OR: [
          { name: { contains: q.search, mode } },
          { email: { contains: q.search, mode } },
          { phone: { contains: q.search, mode } },
          { publicId: { contains: q.search, mode } },
          { city: { contains: q.search, mode } },
        ],
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.take,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return buildPage(rows, total, q);
  }

  async getById(storeId: string, id: string) {
    // accept either the cuid `id` or the 6-digit `publicId`
    const row = await this.prisma.customer.findFirst({
      where: {
        storeId,
        deletedAt: null,
        OR: [{ id }, { publicId: id }],
      },
    });
    if (!row) throw new NotFoundException('Customer not found');
    return row;
  }

  async create(dto: CreateCustomerDto, user: AuthUser) {
    if (dto.phone) {
      const existing = await this.prisma.customer.findFirst({
        where: { storeId: user.storeId, phone: dto.phone, deletedAt: null },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          message: 'A customer with this phone already exists',
          code: 'DUPLICATE_CUSTOMER_NUMBER',
        });
      }
    }

    const customer = await this.createWithRetry(dto, user);
    return {
      message: 'Customer created successfully',
      data: { customerId: customer.publicId, customer },
    };
  }

  async update(storeId: string, id: string, dto: Partial<CreateCustomerDto>) {
    const existing = await this.getById(storeId, id);
    const updated = await this.prisma.customer.update({
      where: { id: existing.id },
      data: { ...dto },
    });
    return { message: 'Customer updated', data: updated };
  }

  async softDelete(storeId: string, id: string) {
    const existing = await this.getById(storeId, id);
    await this.prisma.customer.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Customer deleted', data: { id: existing.id } };
  }

  private async createWithRetry(dto: CreateCustomerDto, user: AuthUser, attempt = 0): Promise<any> {
    try {
      return await this.prisma.customer.create({
        data: {
          publicId: generatePublicId(),
          storeId: user.storeId,
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          address: dto.address,
          city: dto.city,
          notes: dto.notes,
          createdBy: user.userId,
        },
      });
    } catch (err) {
      // P2002 on (storeId, publicId) — retry up to 3x
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
