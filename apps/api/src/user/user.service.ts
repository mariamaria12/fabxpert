import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type {
  CreateUserInput,
  UpdateUserInput,
  UserDto,
} from '@fabxpert/shared/dto/user.dto';
import type { PaginatedResponse } from '@fabxpert/shared/dto/pagination.dto';
import { PaginationParams } from '../common/pagination/parse-pagination.util';
import { notDeleted } from '../common/prisma/soft-delete.util';
import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_ROUNDS = 12;

const userSelect = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  personId: true,
  createdAt: true,
  updatedAt: true,
  person: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.UserSelect;

type UserWithPerson = Prisma.UserGetPayload<{ select: typeof userSelect }>;

function toUserDto(user: UserWithPerson): UserDto {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    personId: user.personId,
    person: user.person,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(pagination: PaginationParams): Promise<PaginatedResponse<UserDto>> {
    const { page, pageSize } = pagination;
    const where = { ...notDeleted() };

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { email: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: rows.map(toUserDto),
      meta: { page, pageSize, total, totalPages },
    };
  }

  async findOne(id: string): Promise<UserDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, ...notDeleted() },
      select: userSelect,
    });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return toUserDto(user);
  }

  async create(input: CreateUserInput): Promise<UserDto> {
    await this.assertPersonExists(input.personId);

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email,
          passwordHash,
          role: input.role,
          personId: input.personId,
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        select: userSelect,
      });
      return toUserDto(user);
    } catch (error) {
      this.handleUniqueViolation(error);
    }
  }

  async update(id: string, input: UpdateUserInput, actorId: string): Promise<UserDto> {
    await this.findOne(id);
    this.assertSelfProtectionOnUpdate(id, actorId, input);

    if (input.personId !== undefined) {
      await this.assertPersonExists(input.personId);
    }

    const data: Prisma.UserUpdateInput = {};

    if (input.email !== undefined) {
      data.email = input.email;
    }
    if (input.role !== undefined) {
      data.role = input.role;
    }
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }
    if (input.personId !== undefined) {
      data.person = { connect: { id: input.personId } };
    }
    if (input.password !== undefined) {
      data.passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data,
        select: userSelect,
      });
      return toUserDto(user);
    } catch (error) {
      this.handleUniqueViolation(error);
    }
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    await this.findOne(id);

    if (id === actorId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private assertSelfProtectionOnUpdate(
    targetId: string,
    actorId: string,
    input: UpdateUserInput,
  ): void {
    if (targetId !== actorId) {
      return;
    }

    if (input.isActive === false) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    if (input.role === 'EMPLOYEE') {
      throw new BadRequestException('You cannot demote your own account');
    }
  }

  private async assertPersonExists(personId: string): Promise<void> {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, ...notDeleted() },
    });
    if (!person) {
      throw new BadRequestException('personId does not reference an existing person');
    }
  }

  private handleUniqueViolation(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target : [];

      if (fields.includes('email')) {
        throw new ConflictException('A user with this email already exists');
      }
      if (fields.includes('personId')) {
        throw new ConflictException('This person already has a user account');
      }
    }

    throw error;
  }
}
