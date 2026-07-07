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
  createEmployeeRoleSchema,
  updateEmployeeRoleSchema,
  type CreateEmployeeRoleInput,
  type UpdateEmployeeRoleInput,
} from '@fabxpert/shared/dto/employee-role.dto';
import { z } from 'zod';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { EmployeeRoleService } from './employee-role.service';

const idParamSchema = z.string().trim().min(1);

@Controller('employee-roles')
@Roles('ADMIN')
export class EmployeeRoleController {
  constructor(private readonly employeeRoleService: EmployeeRoleService) {}

  @Get()
  @Roles('ADMIN', 'EMPLOYEE')
  findAll(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query() query: Record<string, string>,
  ) {
    const includeInactive = query.includeInactive === 'true';
    return this.employeeRoleService.findAll(req.user.role, includeInactive);
  }

  @Get(':id')
  findOne(@Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    return this.employeeRoleService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(createEmployeeRoleSchema)) input: CreateEmployeeRoleInput,
  ) {
    return this.employeeRoleService.create(input);
  }

  @Patch(':id')
  update(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateEmployeeRoleSchema)) input: UpdateEmployeeRoleInput,
  ) {
    return this.employeeRoleService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    await this.employeeRoleService.softDelete(id);
  }
}
