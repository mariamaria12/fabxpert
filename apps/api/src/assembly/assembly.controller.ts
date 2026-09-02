import {
  BadRequestException,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import {
  ASSEMBLY_LIST_STATUS_VALUES,
  createProjectAssemblySchema,
  importProjectAssembliesSchema,
  updateProjectAssemblySchema,
  type CreateProjectAssemblyInput,
  type ImportProjectAssembliesInput,
  type UpdateProjectAssemblyInput,
} from '@fabxpert/shared/dto/assembly.dto';
import { z } from 'zod';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AssemblyService } from './assembly.service';

const idParamSchema = z.string().trim().min(1);

const listQuerySchema = z.object({
  activityId: z.string().trim().min(1).optional(),
  status: z.enum(ASSEMBLY_LIST_STATUS_VALUES).optional(),
  search: z.string().trim().min(1).optional(),
});

@Controller('projects/:projectId/assemblies')
@Roles('ADMIN')
export class ProjectAssemblyController {
  constructor(private readonly assemblyService: AssemblyService) {}

  @Get()
  @Roles('ADMIN', 'EMPLOYEE')
  findAll(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('projectId', new ZodValidationPipe(idParamSchema)) projectId: string,
    @Query(new ZodValidationPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>,
  ) {
    return this.assemblyService.findAllForProject(req.user, projectId, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('projectId', new ZodValidationPipe(idParamSchema)) projectId: string,
    @Body(new ZodValidationPipe(createProjectAssemblySchema))
    input: CreateProjectAssemblyInput,
  ) {
    return this.assemblyService.create(projectId, input);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  import(
    @Param('projectId', new ZodValidationPipe(idParamSchema)) projectId: string,
    @Body(new ZodValidationPipe(importProjectAssembliesSchema))
    input: ImportProjectAssembliesInput,
  ) {
    return this.assemblyService.importForProject(projectId, input);
  }
}

/** Uploads are read in memory; a project workbook is a few megabytes. */
const MAX_WORKBOOK_BYTES = 20 * 1024 * 1024;

/** Structural shape of a multer upload — avoids pulling in @types/multer. */
type UploadedWorkbook = {
  originalname: string;
  size: number;
  buffer: Buffer;
};

const previewTextSchema = z.object({
  tsv: z.string().trim().min(1, 'Import text is required'),
});

@Controller('assemblies')
@Roles('ADMIN')
export class AssemblyController {
  constructor(private readonly assemblyService: AssemblyService) {}

  /**
   * Read a list without saving it. Kept off the project route on purpose: a
   * project being created has no id yet, and its list still has to be shown
   * before the project is saved.
   */
  @Post('preview/text')
  @HttpCode(HttpStatus.OK)
  previewText(
    @Body(new ZodValidationPipe(previewTextSchema)) input: { tsv: string },
  ) {
    return this.assemblyService.previewTsv(input.tsv);
  }

  @Post('preview/file')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_WORKBOOK_BYTES } }))
  previewFile(
    @UploadedFile() file: UploadedWorkbook | undefined,
    @Body('sheet') sheet: string | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('A workbook file is required');
    }
    if (!/\.xlsx$/i.test(file.originalname)) {
      throw new BadRequestException('Only .xlsx workbooks can be read');
    }

    return this.assemblyService.previewWorkbook(file.buffer, sheet || undefined);
  }

  @Patch(':id')
  update(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateProjectAssemblySchema))
    input: UpdateProjectAssemblyInput,
  ) {
    return this.assemblyService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    await this.assemblyService.softDelete(id);
  }
}
