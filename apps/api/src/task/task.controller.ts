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
  Query,
  Req,
  Sse,
} from '@nestjs/common';
import { Request } from 'express';
import { takeUntil } from 'rxjs';
import { z } from 'zod';
import {
  TASK_LIST_SCOPE_VALUES,
  createTaskChecklistItemSchema,
  createTaskCommentSchema,
  createTaskSchema,
  updateTaskChecklistItemSchema,
  updateTaskSchema,
  type CreateTaskChecklistItemInput,
  type CreateTaskCommentInput,
  type CreateTaskInput,
  type UpdateTaskChecklistItemInput,
  type UpdateTaskInput,
} from '@fabxpert/shared/dto/task.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { SessionRevocationService } from '../auth/session-revocation.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TaskEventsService } from './task-events.service';
import { TaskService } from './task.service';

const idParamSchema = z.string().trim().min(1);

const listQuerySchema = z.object({
  scope: z.enum(TASK_LIST_SCOPE_VALUES).optional(),
  projectId: z.string().trim().min(1).optional(),
  includeDone: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

type ListQuery = z.infer<typeof listQuerySchema>;
type AuthenticatedRequest = Request & { user: AuthenticatedUser };

/** Tasks are office work between admins — nothing here is open to employees. */
@Controller('tasks')
@Roles('ADMIN')
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly taskEvents: TaskEventsService,
    private readonly sessionRevocation: SessionRevocationService,
  ) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.taskService.findAll(req.user.id, query);
  }

  // The fixed routes below must stay above `:id`.

  @Sse('stream')
  stream(@Req() req: AuthenticatedRequest) {
    return this.taskEvents
      .subscribe(req.user.id)
      .pipe(takeUntil(this.sessionRevocation.revoked(req.user.id)));
  }

  @Get('assignees')
  findAssignees() {
    return this.taskService.findAssignees();
  }

  @Get('attention-count')
  countNeedingAttention(@Req() req: AuthenticatedRequest) {
    return this.taskService.countNeedingAttention(req.user.id);
  }

  @Get('project-counts')
  countByProject() {
    return this.taskService.countByProject();
  }

  @Get(':id')
  findOne(@Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    return this.taskService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(createTaskSchema)) input: CreateTaskInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.taskService.create(input, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateTaskSchema)) input: UpdateTaskInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.taskService.update(id, input, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    return this.taskService.remove(id);
  }

  @Post(':id/checklist')
  @HttpCode(HttpStatus.CREATED)
  addChecklistItem(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(createTaskChecklistItemSchema))
    input: CreateTaskChecklistItemInput,
  ) {
    return this.taskService.addChecklistItem(id, input);
  }

  @Patch(':id/checklist/:itemId')
  updateChecklistItem(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Param('itemId', new ZodValidationPipe(idParamSchema)) itemId: string,
    @Body(new ZodValidationPipe(updateTaskChecklistItemSchema))
    input: UpdateTaskChecklistItemInput,
  ) {
    return this.taskService.updateChecklistItem(id, itemId, input);
  }

  @Delete(':id/checklist/:itemId')
  removeChecklistItem(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Param('itemId', new ZodValidationPipe(idParamSchema)) itemId: string,
  ) {
    return this.taskService.removeChecklistItem(id, itemId);
  }

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  addComment(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(createTaskCommentSchema)) input: CreateTaskCommentInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.taskService.addComment(id, input, req.user.id);
  }
}
