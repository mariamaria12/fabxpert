import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveStatus, Prisma } from '@prisma/client';
import type {
  CreateLeaveRequestInput,
  EmployeeLeaveRequestResponse,
  LeaveBalanceDto,
  LeaveRequestDto,
  ReviewLeaveRequestInput,
  ReviewLeaveRequestResponse,
  UpdateLeaveRequestInput,
} from '@fabxpert/shared/dto/leave.dto';
import type { PaginatedResponse } from '@fabxpert/shared/dto/pagination.dto';
import {
  countInclusiveLeaveDays,
} from '@fabxpert/shared/leaveDays';
import { parseWorkDateString } from '@fabxpert/shared/workDate';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { PaginationParams } from '../common/pagination/parse-pagination.util';
import { notDeleted } from '../common/prisma/soft-delete.util';
import { PrismaService } from '../prisma/prisma.service';

const leaveRequestInclude = {
  person: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  reviewedBy: {
    select: {
      id: true,
      email: true,
    },
  },
} satisfies Prisma.LeaveRequestInclude;

type LeaveRequestWithRelations = Prisma.LeaveRequestGetPayload<{
  include: typeof leaveRequestInclude;
}>;

export interface LeaveRequestListFilters {
  status?: LeaveStatus;
  personId?: string;
}

function toLeaveDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLeaveRequestDto(leaveRequest: LeaveRequestWithRelations): LeaveRequestDto {
  return {
    id: leaveRequest.id,
    person: leaveRequest.person,
    type: leaveRequest.type,
    startDate: toLeaveDateString(leaveRequest.startDate),
    endDate: toLeaveDateString(leaveRequest.endDate),
    status: leaveRequest.status,
    reason: leaveRequest.reason,
    reviewedBy: leaveRequest.reviewedBy,
    reviewedAt: leaveRequest.reviewedAt?.toISOString() ?? null,
    dayCount: countInclusiveLeaveDays(leaveRequest.startDate, leaveRequest.endDate),
    createdAt: leaveRequest.createdAt.toISOString(),
  };
}

@Injectable()
export class LeaveService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    actor: AuthenticatedUser,
    input: CreateLeaveRequestInput,
  ): Promise<EmployeeLeaveRequestResponse> {
    const personId = await this.resolveActorPersonId(actor.id);
    const startDate = parseWorkDateString(input.startDate);
    const endDate = parseWorkDateString(input.endDate);

    await this.assertNoOverlappingLeave(personId, startDate, endDate);

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        personId,
        type: input.type,
        startDate,
        endDate,
        reason: input.reason,
        status: 'IN_ASTEPTARE',
      },
      include: leaveRequestInclude,
    });

    const balance = await this.computeBalance(personId);
    return {
      leaveRequest: toLeaveRequestDto(leaveRequest),
      balance,
    };
  }

  async findMine(
    actor: AuthenticatedUser,
    pagination: PaginationParams,
  ): Promise<PaginatedResponse<LeaveRequestDto>> {
    const personId = await this.resolveActorPersonId(actor.id);
    return this.findByPerson(personId, pagination);
  }

  async getMyBalance(actor: AuthenticatedUser): Promise<LeaveBalanceDto> {
    const personId = await this.resolveActorPersonId(actor.id);
    return this.computeBalance(personId);
  }

  async getBalanceForPerson(personId: string): Promise<LeaveBalanceDto> {
    await this.assertPersonExists(personId);
    return this.computeBalance(personId);
  }

  async findAll(
    pagination: PaginationParams,
    filters: LeaveRequestListFilters,
  ): Promise<PaginatedResponse<LeaveRequestDto>> {
    const { page, pageSize } = pagination;
    const where = this.buildListWhere(filters);

    const [total, rows] = await Promise.all([
      this.prisma.leaveRequest.count({ where }),
      this.prisma.leaveRequest.findMany({
        where,
        include: leaveRequestInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: rows.map(toLeaveRequestDto),
      meta: { page, pageSize, total, totalPages },
    };
  }

  async findOneAdmin(id: string): Promise<LeaveRequestDto> {
    const leaveRequest = await this.getLeaveRequestOrThrow(id);
    return toLeaveRequestDto(leaveRequest);
  }

  async updateOwn(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateLeaveRequestInput,
  ): Promise<EmployeeLeaveRequestResponse> {
    const existing = await this.getLeaveRequestOrThrow(id);
    const personId = await this.resolveActorPersonId(actor.id);

    if (existing.personId !== personId) {
      throw new ForbiddenException('You do not have access to this leave request');
    }

    this.assertPendingForEdit(existing.status);

    const nextStartDate =
      input.startDate !== undefined
        ? parseWorkDateString(input.startDate)
        : existing.startDate;
    const nextEndDate =
      input.endDate !== undefined
        ? parseWorkDateString(input.endDate)
        : existing.endDate;

    if (nextEndDate < nextStartDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    await this.assertNoOverlappingLeave(personId, nextStartDate, nextEndDate, id);

    const leaveRequest = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.startDate !== undefined ? { startDate: nextStartDate } : {}),
        ...(input.endDate !== undefined ? { endDate: nextEndDate } : {}),
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
      },
      include: leaveRequestInclude,
    });

    const balance = await this.computeBalance(personId);
    return {
      leaveRequest: toLeaveRequestDto(leaveRequest),
      balance,
    };
  }

  async softDeleteOwn(actor: AuthenticatedUser, id: string): Promise<void> {
    const existing = await this.getLeaveRequestOrThrow(id);
    const personId = await this.resolveActorPersonId(actor.id);

    if (existing.personId !== personId) {
      throw new ForbiddenException('You do not have access to this leave request');
    }

    this.assertPendingForEdit(existing.status);

    await this.prisma.leaveRequest.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async review(
    actor: AuthenticatedUser,
    id: string,
    input: ReviewLeaveRequestInput,
  ): Promise<ReviewLeaveRequestResponse> {
    const existing = await this.getLeaveRequestOrThrow(id);
    const reviewedAt = new Date();

    const leaveRequest = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: input.status,
        reviewedByUserId: actor.id,
        reviewedAt,
      },
      include: leaveRequestInclude,
    });

    const response: ReviewLeaveRequestResponse = {
      leaveRequest: toLeaveRequestDto(leaveRequest),
    };

    if (input.status === 'APROBAT' && existing.type === 'ODIHNA') {
      const balance = await this.computeBalance(existing.personId);
      const requestDays = countInclusiveLeaveDays(
        existing.startDate,
        existing.endDate,
      );
      const usedWithoutThis =
        existing.status === 'APROBAT' ? balance.usedDays - requestDays : balance.usedDays;
      const remainingAfterApproval =
        balance.annualLeaveDays - usedWithoutThis - requestDays;

      if (remainingAfterApproval < 0) {
        response.overBalanceWarning = true;
      }
    }

    return response;
  }

  /**
   * Computes ODIHNA balance for the current calendar year (by startDate year).
   * Balance is derived from approved requests — not stored on Person.
   */
  async computeBalance(
    personId: string,
    year = new Date().getFullYear(),
  ): Promise<LeaveBalanceDto> {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, ...notDeleted() },
      select: { annualLeaveDays: true },
    });

    if (!person) {
      throw new NotFoundException(`Person with id ${personId} not found`);
    }

    const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
    const yearEnd = new Date(year + 1, 0, 1, 0, 0, 0, 0);

    const approvedOdihna = await this.prisma.leaveRequest.findMany({
      where: {
        personId,
        type: 'ODIHNA',
        status: 'APROBAT',
        ...notDeleted(),
        startDate: { gte: yearStart, lt: yearEnd },
      },
      select: {
        startDate: true,
        endDate: true,
      },
    });

    const usedDays = approvedOdihna.reduce(
      (sum, request) => sum + countInclusiveLeaveDays(request.startDate, request.endDate),
      0,
    );

    return {
      personId,
      annualLeaveDays: person.annualLeaveDays,
      usedDays,
      remainingDays: person.annualLeaveDays - usedDays,
    };
  }

  private async findByPerson(
    personId: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResponse<LeaveRequestDto>> {
    const { page, pageSize } = pagination;
    const where = { personId, ...notDeleted() };

    const [total, rows] = await Promise.all([
      this.prisma.leaveRequest.count({ where }),
      this.prisma.leaveRequest.findMany({
        where,
        include: leaveRequestInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: rows.map(toLeaveRequestDto),
      meta: { page, pageSize, total, totalPages },
    };
  }

  private buildListWhere(filters: LeaveRequestListFilters): Prisma.LeaveRequestWhereInput {
    return {
      ...notDeleted(),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.personId ? { personId: filters.personId } : {}),
    };
  }

  private async assertNoOverlappingLeave(
    personId: string,
    startDate: Date,
    endDate: Date,
    excludeId?: string,
  ): Promise<void> {
    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        personId,
        ...notDeleted(),
        status: { in: ['IN_ASTEPTARE', 'APROBAT'] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    });

    if (overlapping) {
      throw new ConflictException(
        'Există deja o cerere de concediu pentru această perioadă',
      );
    }
  }

  private assertPendingForEdit(status: LeaveStatus): void {
    if (status !== 'IN_ASTEPTARE') {
      throw new ConflictException(
        'Only pending leave requests can be edited or cancelled',
      );
    }
  }

  private async resolveActorPersonId(userId: string): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, ...notDeleted() },
      select: {
        personId: true,
        person: {
          select: { deletedAt: true },
        },
      },
    });

    if (!user || user.person.deletedAt !== null) {
      throw new BadRequestException('Your user account is not linked to a person');
    }

    return user.personId;
  }

  private async getLeaveRequestOrThrow(id: string): Promise<LeaveRequestWithRelations> {
    const leaveRequest = await this.prisma.leaveRequest.findFirst({
      where: { id, ...notDeleted() },
      include: leaveRequestInclude,
    });

    if (!leaveRequest) {
      throw new NotFoundException(`Leave request with id ${id} not found`);
    }

    return leaveRequest;
  }

  private async assertPersonExists(personId: string): Promise<void> {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, ...notDeleted() },
    });

    if (!person) {
      throw new NotFoundException(`Person with id ${personId} not found`);
    }
  }
}
