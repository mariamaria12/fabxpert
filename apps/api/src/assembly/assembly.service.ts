import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma as PrismaRuntime } from '@prisma/client';
import type { Prisma, ProjectAssembly } from '@prisma/client';
import type {
  AssemblyImportIssue,
  AssemblyImportResult,
  AssemblyListStatus,
  AssemblyPreviewDto,
  CreateProjectAssemblyInput,
  ImportProjectAssembliesInput,
  ProjectAssemblyDto,
  UpdateProjectAssemblyInput,
} from '@fabxpert/shared/dto/assembly.dto';
import { parseAssemblyImport, parseAssemblyRows } from '@fabxpert/shared/assemblyImport';
import { toProfileKey } from '@fabxpert/shared/steelProfile';
import { notDeleted } from '../common/prisma/soft-delete.util';
import {
  buildEmployeeRoleVisibilityWhere,
  resolveEmployeeProjectVisibility,
} from '../project/project-visibility.util';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { doneForActivity, loadAssemblyProgress } from './assembly-progress.util';
import { readWorkbookPreview } from './assembly-workbook.util';

export type ListAssembliesFilters = {
  activityId?: string;
  status?: AssemblyListStatus;
  search?: string;
};

function toAssemblyDto(
  assembly: ProjectAssembly,
  progress: ProjectAssemblyDto['progress'],
): ProjectAssemblyDto {
  return {
    id: assembly.id,
    projectId: assembly.projectId,
    name: assembly.name,
    quantity: assembly.quantity,
    profile: assembly.profile,
    profileKey: assembly.profileKey,
    length: assembly.length,
    weightPerPiece: assembly.weightPerPiece,
    position: assembly.position,
    progress,
    createdAt: assembly.createdAt.toISOString(),
    updatedAt: assembly.updatedAt.toISOString(),
  };
}

@Injectable()
export class AssemblyService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForProject(
    actor: AuthenticatedUser,
    projectId: string,
    filters: ListAssembliesFilters,
  ): Promise<ProjectAssemblyDto[]> {
    await this.assertProjectVisible(actor, projectId);

    const rows = await this.prisma.projectAssembly.findMany({
      where: {
        projectId,
        ...notDeleted(),
        ...(filters.search
          ? { name: { contains: filters.search, mode: 'insensitive' } }
          : {}),
      },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });

    const progressByAssembly = await loadAssemblyProgress(
      this.prisma,
      rows.map((row) => row.id),
    );

    const dtos = rows.map((row) => toAssemblyDto(row, progressByAssembly.get(row.id) ?? []));

    return this.applyStatusFilter(dtos, filters);
  }

  /**
   * `pending` hides what is finished for the chosen activity, which is what the
   * mobile picker shows; `completed` is the "see finished assemblies" list
   * behind it. Without an activity there is no per-activity progress to split
   * on, so the filter is ignored rather than guessed at.
   */
  private applyStatusFilter(
    assemblies: ProjectAssemblyDto[],
    filters: ListAssembliesFilters,
  ): ProjectAssemblyDto[] {
    const { activityId, status } = filters;
    if (!activityId || !status || status === 'all') {
      return assemblies;
    }

    return assemblies.filter((assembly) => {
      const done = doneForActivity(assembly.progress, activityId);
      return status === 'completed' ? done >= assembly.quantity : done < assembly.quantity;
    });
  }

  async create(
    projectId: string,
    input: CreateProjectAssemblyInput,
  ): Promise<ProjectAssemblyDto> {
    await this.assertProjectExists(projectId);

    const profileKey = await this.ensureSteelProfile(this.prisma, input.profile ?? null);
    const position = await this.nextPosition(projectId);

    const existing = await this.prisma.projectAssembly.findUnique({
      where: { projectId_name: { projectId, name: input.name } },
    });

    // A mark that was deleted and comes back is the same line on the drawing.
    const assembly = existing
      ? await this.prisma.projectAssembly.update({
          where: { id: existing.id },
          data: {
            deletedAt: null,
            quantity: input.quantity,
            profile: input.profile ?? null,
            profileKey,
            length: input.length ?? null,
            weightPerPiece: input.weightPerPiece ?? null,
            ...(existing.deletedAt ? { position } : {}),
          },
        })
      : await this.prisma.projectAssembly.create({
          data: {
            projectId,
            name: input.name,
            quantity: input.quantity,
            profile: input.profile ?? null,
            profileKey,
            length: input.length ?? null,
            weightPerPiece: input.weightPerPiece ?? null,
            position,
          },
        });

    const progress = await loadAssemblyProgress(this.prisma, [assembly.id]);
    return toAssemblyDto(assembly, progress.get(assembly.id) ?? []);
  }

  async update(id: string, input: UpdateProjectAssemblyInput): Promise<ProjectAssemblyDto> {
    const existing = await this.getAssemblyOrThrow(id);

    const profileKey =
      input.profile !== undefined
        ? await this.ensureSteelProfile(this.prisma, input.profile)
        : undefined;

    let assembly: ProjectAssembly;
    try {
      assembly = await this.prisma.projectAssembly.update({
        where: { id: existing.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
          ...(input.profile !== undefined ? { profile: input.profile, profileKey } : {}),
          ...(input.length !== undefined ? { length: input.length } : {}),
          ...(input.weightPerPiece !== undefined
            ? { weightPerPiece: input.weightPerPiece }
            : {}),
        },
      });
    } catch (caught) {
      // One mark per project — renaming onto another line is a conflict, not a
      // crash. A previously deleted line holds its mark too.
      if (
        caught instanceof PrismaRuntime.PrismaClientKnownRequestError &&
        caught.code === 'P2002'
      ) {
        throw new ConflictException('An assembly with this name already exists on the project');
      }
      throw caught;
    }

    const progress = await loadAssemblyProgress(this.prisma, [assembly.id]);
    return toAssemblyDto(assembly, progress.get(assembly.id) ?? []);
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.getAssemblyOrThrow(id);
    await this.prisma.projectAssembly.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
  }

  /** Read a pasted list without saving anything, for the preview table. */
  previewTsv(tsv: string): AssemblyPreviewDto {
    const parsed = parseAssemblyImport(tsv);
    return {
      sheets: [],
      sheetName: null,
      rows: parsed.rows,
      issues: parsed.issues,
      hasHeaderRow: parsed.hasHeaderRow,
    };
  }

  /** Same, for an uploaded workbook — `sheet` overrules the detected one. */
  async previewWorkbook(buffer: Buffer, sheet?: string): Promise<AssemblyPreviewDto> {
    const workbook = await readWorkbookPreview(buffer, sheet);
    const parsed = parseAssemblyRows(workbook.rows);

    return {
      sheets: workbook.sheets,
      sheetName: workbook.sheetName,
      rows: parsed.rows,
      issues: parsed.issues,
      hasHeaderRow: parsed.hasHeaderRow,
    };
  }

  /**
   * Save a list against a project. Every row carrying a mark goes in —
   * unreadable cells, repeated marks and counts that fall below what is already
   * reported as done are all reported, never refused. The list on paper is what
   * the workshop follows; if it disagrees with the app, the app is what needs
   * looking at.
   *
   * Rows already in the database but absent from the input are left alone —
   * dropping them would silently delete progress on a partial list. `replace`
   * is the deliberate exception: the incoming list becomes the whole list, and
   * marks missing from it are soft-deleted. Their timesheets stay exactly as
   * they are — the hours were worked and still have to be paid, so a revised
   * drawing may drop a mark but never the record of work on it. An empty list
   * never deletes anything, so a paste that read as nothing cannot wipe a
   * project.
   */
  async importForProject(
    projectId: string,
    input: ImportProjectAssembliesInput,
  ): Promise<AssemblyImportResult> {
    await this.assertProjectExists(projectId);

    const parsed =
      input.tsv !== undefined
        ? parseAssemblyImport(input.tsv)
        : { rows: input.rows ?? [], issues: [] as AssemblyImportIssue[] };

    const issues: AssemblyImportIssue[] = [...parsed.issues];
    const skipped = issues.filter((issue) => issue.code === 'MISSING_NAME').length;

    if (parsed.rows.length === 0) {
      return { created: 0, updated: 0, skipped, deleted: 0, issues };
    }

    const names = parsed.rows.map((row) => row.name);
    const [existingRows, lastPosition] = await Promise.all([
      this.prisma.projectAssembly.findMany({
        where: { projectId, name: { in: names } },
        select: { id: true, name: true },
      }),
      this.prisma.projectAssembly.findFirst({
        where: { projectId },
        orderBy: { position: 'desc' },
        select: { position: true },
      }),
    ]);
    const existingByName = new Map(existingRows.map((row) => [row.name, row]));

    const progressByAssembly = await loadAssemblyProgress(
      this.prisma,
      existingRows.map((row) => row.id),
    );

    const profileKeyByRow = parsed.rows.map((row) => toProfileKey(row.profile));
    const catalogueRows = new Map<string, string>();
    parsed.rows.forEach((row, index) => {
      const key = profileKeyByRow[index];
      if (key && row.profile && !catalogueRows.has(key)) {
        catalogueRows.set(key, row.profile.trim());
      }
    });

    let position = (lastPosition?.position ?? -1) + 1;
    const creates: Prisma.ProjectAssemblyCreateManyInput[] = [];
    const updates: { id: string; data: Prisma.ProjectAssemblyUncheckedUpdateInput }[] = [];

    parsed.rows.forEach((row, index) => {
      const profileKey = profileKeyByRow[index];
      const existing = existingByName.get(row.name);

      if (!existing) {
        creates.push({
          projectId,
          name: row.name,
          quantity: row.quantity,
          profile: row.profile,
          profileKey,
          length: row.length,
          weightPerPiece: row.weightPerPiece,
          position: position++,
        });
        return;
      }

      const maxDone = Math.max(
        0,
        ...(progressByAssembly.get(existing.id) ?? []).map((entry) => entry.quantityDone),
      );
      if (maxDone > row.quantity) {
        issues.push({
          row: row.row,
          name: row.name,
          code: 'QUANTITY_BELOW_PROGRESS',
          value: String(maxDone),
        });
      }

      updates.push({
        id: existing.id,
        data: {
          deletedAt: null,
          quantity: row.quantity,
          profile: row.profile,
          profileKey,
          length: row.length,
          weightPerPiece: row.weightPerPiece,
        },
      });
    });

    // Two hundred rows must not be two hundred round trips: the catalogue and
    // the new rows go in one statement each, and the updates travel as one
    // batch. The whole list lands or none of it does.
    let deleted = 0;

    await this.prisma.$transaction(
      async (tx) => {
        if (input.replace) {
          const removed = await tx.projectAssembly.updateMany({
            where: { projectId, ...notDeleted(), name: { notIn: names } },
            data: { deletedAt: new Date() },
          });
          deleted = removed.count;
        }

        if (catalogueRows.size > 0) {
          await tx.steelProfile.createMany({
            data: [...catalogueRows].map(([key, label]) => ({ key, label })),
            skipDuplicates: true,
          });
        }

        if (creates.length > 0) {
          await tx.projectAssembly.createMany({ data: creates });
        }

        for (const update of updates) {
          await tx.projectAssembly.update({ where: { id: update.id }, data: update.data });
        }
      },
      { timeout: 120_000 },
    );

    return { created: creates.length, updated: updates.length, skipped, deleted, issues };
  }

  /**
   * Profiles are recorded, not validated. Rolled sections come from a finite
   * catalogue but plates are cut to any width, so an unseen designation just
   * creates its catalogue row — it can never hold an import back.
   */
  private async ensureSteelProfile(
    prisma: Prisma.TransactionClient | PrismaService,
    profile: string | null,
  ): Promise<string | null> {
    const key = toProfileKey(profile);
    if (!key || !profile) {
      return null;
    }

    await prisma.steelProfile.upsert({
      where: { key },
      update: {},
      create: { key, label: profile.trim() },
    });

    return key;
  }

  private async nextPosition(projectId: string): Promise<number> {
    const last = await this.prisma.projectAssembly.findFirst({
      where: { projectId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async getAssemblyOrThrow(id: string): Promise<ProjectAssembly> {
    const assembly = await this.prisma.projectAssembly.findFirst({
      where: { id, ...notDeleted() },
    });

    if (!assembly) {
      throw new NotFoundException(`Assembly with id ${id} not found`);
    }

    return assembly;
  }

  private async assertProjectExists(projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ...notDeleted() },
      select: { id: true },
    });

    if (!project) {
      throw new BadRequestException('projectId does not reference an existing project');
    }
  }

  /** Employees only reach assemblies of projects they can log time against. */
  private async assertProjectVisible(
    actor: AuthenticatedUser,
    projectId: string,
  ): Promise<void> {
    if (actor.role !== 'EMPLOYEE') {
      await this.assertProjectExists(projectId);
      return;
    }

    const visibility = await resolveEmployeeProjectVisibility(this.prisma, actor.id);
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...notDeleted(),
        readyForExecution: true,
        ...buildEmployeeRoleVisibilityWhere(
          visibility.employeeRoleId,
          visibility.restrictedProjects,
        ),
      },
      select: { id: true },
    });

    if (!project) {
      throw new BadRequestException('This project is not available');
    }
  }
}
