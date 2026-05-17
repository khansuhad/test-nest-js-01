import { Injectable } from '@nestjs/common';
import { Prisma, ServiceStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { buildPage } from '../../common/utils/pagination';
import { generatePublicId } from '../../common/utils/public-id';
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesDto } from './dto/list-services.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(storeId: string, q: ListServicesDto) {
    const where: Prisma.ServiceWhereInput = {
      storeId,
      deletedAt: null,
      ...(q.active !== undefined && { isActive: q.active === 'true' }),
      ...(q.search && {
        name: { contains: q.search, mode: Prisma.QueryMode.insensitive },
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.take,
      }),
      this.prisma.service.count({ where }),
    ]);

    return buildPage(rows, total, q);
  }

  async create(storeId: string, dto: CreateServiceDto) {
    const created = await this.createWithRetry(storeId, dto);
    return {
      message: 'Service created successfully',
      data: { serviceId: created.publicId, id: created.id, service: created },
    };
  }

  async update(storeId: string, id: string, dto: Partial<CreateServiceDto>) {
    const existing = await this.prisma.service.findFirst({
      where: {
        storeId,
        deletedAt: null,
        OR: [{ id }, { publicId: id }],
      },
    });
    if (!existing) {
      throw new Error('Service not found');
    }

    const data: Prisma.ServiceUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.number !== undefined) data.number = dto.number;
    if (dto.model !== undefined) data.model = dto.model;
    if (dto.problem !== undefined) data.problem = dto.problem;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    if (dto.partsCost !== undefined) data.partsCost = new Prisma.Decimal(dto.partsCost);
    if (dto.discount !== undefined) data.discount = new Prisma.Decimal(dto.discount);
    if (dto.advancedAmount !== undefined) data.advancedAmount = new Prisma.Decimal(dto.advancedAmount);
    if (dto.finalPrice !== undefined) data.finalPrice = new Prisma.Decimal(dto.finalPrice);
    if (dto.taxRate !== undefined) data.taxRate = new Prisma.Decimal(dto.taxRate);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.service.update({
      where: { id: existing.id },
      data,
    });
    return { message: 'Service updated', data: updated };
  }

  private async createWithRetry(storeId: string, dto: CreateServiceDto, attempt = 0): Promise<any> {
    try {
      return await this.prisma.service.create({
        data: {
          publicId: generatePublicId(),
          storeId,
          name: dto.name,
          description: dto.description,
          number: dto.number,
          model: dto.model,
          problem: dto.problem,
          status: dto.status ?? ServiceStatus.PENDING,
          price: new Prisma.Decimal(dto.price),
          partsCost: new Prisma.Decimal(dto.partsCost ?? 0),
          discount: new Prisma.Decimal(dto.discount ?? 0),
          advancedAmount: new Prisma.Decimal(dto.advancedAmount ?? 0),
          finalPrice: dto.finalPrice !== undefined ? new Prisma.Decimal(dto.finalPrice) : undefined,
          taxRate: new Prisma.Decimal(dto.taxRate ?? 0),
          isActive: dto.isActive ?? true,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        attempt < 3
      ) {
        return this.createWithRetry(storeId, dto, attempt + 1);
      }
      throw err;
    }
  }
}
