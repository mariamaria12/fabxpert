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
} from '@nestjs/common';
import { Request } from 'express';
import {
  createActivitySchema,
  updateActivitySchema,
  type CreateActivityInput,
  type UpdateActivityInput,
} from '@fabxpert/shared/dto/activity.dto';
import { z } from 'zod';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ActivityService } from './activity.service';

const idParamSchema = z.string().trim().min(1);

@Controller('activities')
@Roles('ADMIN')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @Roles('ADMIN', 'EMPLOYEE')
  findAll(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query() query: Record<string, string>,
  ) {
    const includeInactive = query.includeInactive === 'true';
    return this.activityService.findAll(req.user.role, includeInactive);
  }

  @Get(':id')
  findOne(@Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    return this.activityService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(createActivitySchema)) input: CreateActivityInput,
  ) {
    return this.activityService.create(input);
  }

  @Patch(':id')
  update(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateActivitySchema)) input: UpdateActivityInput,
  ) {
    return this.activityService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    await this.activityService.softDelete(id);
  }
}
