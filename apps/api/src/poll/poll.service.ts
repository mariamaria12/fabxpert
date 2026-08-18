import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreatePollInput,
  PollDto,
  PollOptionDto,
  PollVoterDto,
  UpdatePollInput,
  VotePollInput,
} from '@fabxpert/shared/dto/poll.dto';
import { parseWorkDateString, workDateToDayKey } from '@fabxpert/shared/workDate';
import { notDeleted } from '../common/prisma/soft-delete.util';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';

const pollInclude = {
  createdBy: { include: { person: true } },
  options: {
    orderBy: { position: 'asc' },
    include: { votes: { include: { user: { include: { person: true } } } } },
  },
} satisfies Prisma.PollInclude;

type PollWithRelations = Prisma.PollGetPayload<{ include: typeof pollInclude }>;

/**
 * Who a poll goes to, and what the answer rate counts against: active employee
 * accounts minus external collaborators (`angajatExtern`). Externals are not
 * part of team decisions.
 */
function pollAudienceWhere() {
  return {
    ...notDeleted(),
    isActive: true,
    role: 'EMPLOYEE',
    angajatExtern: false,
  } as const;
}

/** Blank description and no description mean the same thing — store null. */
function normalizeDescription(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Answers stop at the end of the chosen day, not at its midnight. */
function endOfDay(dayKey: string): Date {
  const date = parseWorkDateString(dayKey);
  date.setHours(23, 59, 59, 999);
  return date;
}

function toVoterDto(vote: {
  userId: string;
  user: { person: { firstName: string; lastName: string } };
}): PollVoterDto {
  return {
    userId: vote.userId,
    name: `${vote.user.person.firstName} ${vote.user.person.lastName}`,
  };
}

@Injectable()
export class PollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  /** Admin list — drafts included, newest first. */
  async findAll(currentUserId: string): Promise<PollDto[]> {
    const polls = await this.prisma.poll.findMany({
      where: notDeleted(),
      include: pollInclude,
      orderBy: { createdAt: 'desc' },
    });

    const audienceCount = await this.countAudience();
    return polls.map((poll) => this.toDto(poll, currentUserId, true, audienceCount));
  }

  /**
   * Polls still running, answered or not. The app blocks on the unanswered ones
   * at open and keeps a banner up for the rest until they close.
   */
  async findActiveForUser(userId: string): Promise<PollDto[]> {
    const now = new Date();
    const polls = await this.prisma.poll.findMany({
      where: {
        ...notDeleted(),
        status: 'OPEN',
        OR: [{ closesAt: null }, { closesAt: { gte: now } }],
      },
      include: pollInclude,
      orderBy: { publishedAt: 'asc' },
    });

    return polls.map((poll) => this.toDto(poll, userId, false, 0));
  }

  async findOne(id: string, currentUserId: string, isAdmin: boolean): Promise<PollDto> {
    const poll = await this.loadPoll(id);

    // A draft only exists for its author's eyes — to everyone else it isn't there.
    if (!isAdmin && poll.status === 'DRAFT') {
      throw new NotFoundException(`Poll with id ${id} not found`);
    }

    const audienceCount = isAdmin ? await this.countAudience() : 0;
    return this.toDto(poll, currentUserId, isAdmin, audienceCount);
  }

  async create(input: CreatePollInput, createdByUserId: string): Promise<PollDto> {
    const created = await this.prisma.poll.create({
      data: {
        title: input.title,
        description: normalizeDescription(input.description),
        allowMultiple: input.allowMultiple ?? false,
        closesAt: input.closesOn ? endOfDay(input.closesOn) : null,
        createdByUserId,
        options: {
          create: input.options.map((label, position) => ({ label, position })),
        },
      },
      include: pollInclude,
    });

    return this.toDto(created, createdByUserId, true, await this.countAudience());
  }

  /**
   * Text and deadline stay editable after publishing; the options don't —
   * rewriting them would silently reassign answers people already gave.
   */
  async update(id: string, input: UpdatePollInput, currentUserId: string): Promise<PollDto> {
    const poll = await this.loadPoll(id);

    if (input.options !== undefined && poll.status !== 'DRAFT') {
      throw new ConflictException('Options can only be changed while the poll is a draft');
    }
    if (input.allowMultiple !== undefined && poll.status !== 'DRAFT') {
      throw new ConflictException('Answer mode can only be changed while the poll is a draft');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.poll.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined
            ? { description: normalizeDescription(input.description) }
            : {}),
          ...(input.allowMultiple !== undefined ? { allowMultiple: input.allowMultiple } : {}),
          ...(input.closesOn !== undefined
            ? { closesAt: input.closesOn ? endOfDay(input.closesOn) : null }
            : {}),
        },
      });

      if (input.options !== undefined) {
        await tx.pollOption.deleteMany({ where: { pollId: id } });
        await tx.pollOption.createMany({
          data: input.options.map((label, position) => ({ pollId: id, label, position })),
        });
      }
    });

    return this.findOne(id, currentUserId, true);
  }

  /** Opens the poll and tells every active employee it is waiting for them. */
  async publish(
    id: string,
    currentUserId: string,
  ): Promise<{ poll: PollDto; notifiedCount: number }> {
    const poll = await this.loadPoll(id);

    if (poll.status === 'OPEN') {
      throw new ConflictException('This poll is already published');
    }
    if (poll.status === 'CLOSED') {
      throw new ConflictException('This poll is closed');
    }
    if (poll.options.length < 2) {
      throw new BadRequestException('A poll needs at least two options before publishing');
    }

    await this.prisma.poll.update({
      where: { id },
      data: { status: 'OPEN', publishedAt: new Date() },
    });

    const recipients = await this.prisma.user.findMany({
      where: pollAudienceWhere(),
      select: { id: true },
    });

    const notifiedCount = await this.notifications.createForUsers({
      userIds: recipients.map((recipient) => recipient.id),
      kind: 'POLL',
      source: 'ADMIN',
      title: 'Sondaj nou',
      body: poll.title,
      createdByUserId: currentUserId,
      pollId: poll.id,
    });

    return {
      poll: await this.findOne(id, currentUserId, true),
      notifiedCount,
    };
  }

  async close(id: string, currentUserId: string): Promise<PollDto> {
    const poll = await this.loadPoll(id);

    // Closing something already closed is the state the caller asked for — say
    // yes instead of failing a second click or a stale screen.
    if (poll.status === 'CLOSED') {
      return this.findOne(id, currentUserId, true);
    }

    if (poll.status !== 'OPEN') {
      throw new ConflictException('A draft poll cannot be closed');
    }

    await this.prisma.poll.update({ where: { id }, data: { status: 'CLOSED' } });
    await this.dismissPollNotifications(id);

    return this.findOne(id, currentUserId, true);
  }

  /**
   * Puts a closed poll back on the board. A deadline that has already passed is
   * dropped — otherwise the poll would reopen and refuse answers on the spot.
   * Nobody is notified again; the home banner brings it back on its own.
   */
  async reopen(id: string, currentUserId: string): Promise<PollDto> {
    const poll = await this.loadPoll(id);

    if (poll.status !== 'CLOSED') {
      throw new ConflictException('Only a closed poll can be reopened');
    }

    const deadlineHasPassed = poll.closesAt !== null && poll.closesAt.getTime() < Date.now();
    await this.prisma.poll.update({
      where: { id },
      data: { status: 'OPEN', ...(deadlineHasPassed ? { closesAt: null } : {}) },
    });

    return this.findOne(id, currentUserId, true);
  }

  async softDelete(id: string): Promise<void> {
    const poll = await this.loadPoll(id);
    await this.prisma.poll.update({ where: { id: poll.id }, data: { deletedAt: new Date() } });
    await this.dismissPollNotifications(id);
  }

  /** Records the answer. Voting again while the poll is open replaces the old one. */
  async vote(id: string, input: VotePollInput, userId: string): Promise<PollDto> {
    const poll = await this.loadPoll(id);

    if (poll.status !== 'OPEN') {
      throw new ConflictException('This poll is not open for answers');
    }
    if (poll.closesAt && poll.closesAt.getTime() < Date.now()) {
      throw new ConflictException('This poll is closed');
    }

    const optionIds = [...new Set(input.optionIds)];
    if (!poll.allowMultiple && optionIds.length > 1) {
      throw new BadRequestException('This poll accepts a single answer');
    }

    const validIds = new Set(poll.options.map((option) => option.id));
    if (optionIds.some((optionId) => !validIds.has(optionId))) {
      throw new BadRequestException('Unknown option for this poll');
    }

    await this.prisma.$transaction([
      this.prisma.pollVote.deleteMany({ where: { pollId: id, userId } }),
      this.prisma.pollVote.createMany({
        data: optionIds.map((optionId) => ({ pollId: id, optionId, userId })),
      }),
    ]);

    await this.prisma.notification.updateMany({
      where: { pollId: id, userId, dismissedAt: null },
      data: { dismissedAt: new Date() },
    });

    return this.findOne(id, userId, false);
  }

  private async loadPoll(id: string): Promise<PollWithRelations> {
    const poll = await this.prisma.poll.findFirst({
      where: { id, ...notDeleted() },
      include: pollInclude,
    });
    if (!poll) {
      throw new NotFoundException(`Poll with id ${id} not found`);
    }
    return poll;
  }

  private countAudience(): Promise<number> {
    return this.prisma.user.count({ where: pollAudienceWhere() });
  }

  /** A closed or deleted poll shouldn't keep nagging from the notification list. */
  private async dismissPollNotifications(pollId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { pollId, dismissedAt: null },
      data: { dismissedAt: new Date() },
    });
  }

  private toDto(
    poll: PollWithRelations,
    currentUserId: string,
    includeVoters: boolean,
    audienceCount: number,
  ): PollDto {
    const options: PollOptionDto[] = poll.options.map((option) => ({
      id: option.id,
      label: option.label,
      position: option.position,
      voteCount: option.votes.length,
      ...(includeVoters ? { voters: option.votes.map(toVoterDto) } : {}),
    }));

    const answeredUserIds = new Set<string>();
    const myOptionIds: string[] = [];
    for (const option of poll.options) {
      for (const vote of option.votes) {
        answeredUserIds.add(vote.userId);
        if (vote.userId === currentUserId) {
          myOptionIds.push(option.id);
        }
      }
    }

    const createdByPerson = poll.createdBy?.person;

    return {
      id: poll.id,
      title: poll.title,
      description: poll.description,
      allowMultiple: poll.allowMultiple,
      status: poll.status,
      closesOn: poll.closesAt ? workDateToDayKey(poll.closesAt) : null,
      publishedAt: poll.publishedAt ? poll.publishedAt.toISOString() : null,
      createdAt: poll.createdAt.toISOString(),
      createdByName: createdByPerson
        ? `${createdByPerson.firstName} ${createdByPerson.lastName}`
        : null,
      options,
      answerCount: answeredUserIds.size,
      audienceCount,
      myOptionIds,
    };
  }
}
