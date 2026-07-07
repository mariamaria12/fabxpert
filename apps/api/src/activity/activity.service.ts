import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Activity, Prisma } from '@prisma/client';
import type {
  ActivityDto,
  CreateActivityInput,
  UpdateActivityInput,
} from '@fabxpert/shared/dto/activity.dto';
import { notDeleted } from '../common/prisma/soft-delete.util';
import { createOrReviveSoftDeletedByName } from '../common/prisma/lookup-revive-create.util';
import { PrismaService } from '../prisma/prisma.service';

function toActivityDto(activity: Activity): ActivityDto {
  return {
    id: activity.id,
    name: activity.name,
    color: activity.color,
    isActive: activity.isActive,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  };
}

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userRole: string, includeInactive: boolean): Promise<ActivityDto[]> {
    const showInactive = userRole === 'ADMIN' && includeInactive;

    const rows = await this.prisma.activity.findMany({
      where: {
        ...notDeleted(),
        ...(showInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });

    return rows.map(toActivityDto);
  }

  async findOne(id: string): Promise<ActivityDto> {
    const activity = await this.prisma.activity.findFirst({
      where: { id, ...notDeleted() },
    });
    if (!activity) {
      throw new NotFoundException(`Activity with id ${id} not found`);
    }
    return toActivityDto(activity);
  }

  async create(input: CreateActivityInput): Promise<ActivityDto> {
    const activity = await createOrReviveSoftDeletedByName(input.name, {
      findByName: (name) => this.prisma.activity.findFirst({ where: { name } }),
      conflictMessage: 'An activity with this name already exists',
      revive: (existing) =>
        this.prisma.activity.update({
          where: { id: existing.id },
          data: {
            deletedAt: null,
            isActive: input.isActive ?? true,
            ...(input.color !== undefined ? { color: input.color } : {}),
          },
        }),
      create: () => this.prisma.activity.create({ data: input }),
      onUniqueViolation: (error) => this.handleUniqueViolation(error),
    });

    return toActivityDto(activity);
  }

  async update(id: string, input: UpdateActivityInput): Promise<ActivityDto> {
    await this.findOne(id);

    try {
      const activity = await this.prisma.activity.update({
        where: { id },
        data: input,
      });
      return toActivityDto(activity);
    } catch (error) {
      this.handleUniqueViolation(error);
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.activity.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private handleUniqueViolation(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target : [];

      if (fields.includes('name')) {
        throw new ConflictException('An activity with this name already exists');
      }
    }

    throw error;
  }
}
