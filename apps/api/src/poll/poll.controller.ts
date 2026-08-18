import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  createPollSchema,
  updatePollSchema,
  votePollSchema,
  type CreatePollInput,
  type UpdatePollInput,
  type VotePollInput,
} from '@fabxpert/shared/dto/poll.dto';
import { z } from 'zod';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PollService } from './poll.service';

const idParamSchema = z.string().trim().min(1);

@Controller('polls')
@Roles('ADMIN')
export class PollController {
  constructor(private readonly pollService: PollService) {}

  @Get()
  findAll(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.pollService.findAll(req.user.id);
  }

  /** What the app asks for on open — must stay above the `:id` route. */
  @Get('active')
  @Roles('ADMIN', 'EMPLOYEE')
  findActive(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.pollService.findActiveForUser(req.user.id);
  }

  @Get(':id')
  @Roles('ADMIN', 'EMPLOYEE')
  findOne(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.pollService.findOne(id, req.user.id, req.user.role === 'ADMIN');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(createPollSchema)) input: CreatePollInput,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.pollService.create(input, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(updatePollSchema)) input: UpdatePollInput,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.pollService.update(id, input, req.user.id);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.pollService.publish(id, req.user.id);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  close(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.pollService.close(id, req.user.id);
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  reopen(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.pollService.reopen(id, req.user.id);
  }

  @Post(':id/vote')
  @Roles('ADMIN', 'EMPLOYEE')
  @HttpCode(HttpStatus.OK)
  vote(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(votePollSchema)) input: VotePollInput,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.pollService.vote(id, input, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    await this.pollService.softDelete(id);
  }
}
