import { z } from 'zod';

/** Free text; empty is stored as null so "not filled in" stays a single state. */
const profileSchema = z
  .union([z.string().trim().max(100, 'Profile must be at most 100 characters'), z.null()])
  .transform((value) => (value ? value : null));

/** Millimetres, fractions included. Null when the cell was blank or unreadable. */
const lengthSchema = z.union([
  z.number().finite('Length must be a number').nonnegative().max(1_000_000),
  z.null(),
]);

/** Kilograms for one piece, as the drawing list states it. */
const weightPerPieceSchema = z.union([
  z.number().finite('Weight must be a number').nonnegative().max(1_000_000),
  z.null(),
]);

export const createProjectAssemblySchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  profile: profileSchema.optional(),
  length: lengthSchema.optional(),
  weightPerPiece: weightPerPieceSchema.optional(),
});

export const updateProjectAssemblySchema = createProjectAssemblySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

/** A cell the drawing list may simply not have filled in. */
const optionalNumberCell = z
  .union([z.number().finite().nonnegative().max(1_000_000), z.null()])
  .nullish()
  .transform((value) => value ?? null);

/**
 * One row the import understood — what the preview table shows, row by row.
 * The optional cells accept a missing key as well as an explicit null, so a row
 * that lost a field somewhere between preview and save still imports.
 */
export const assemblyImportRowSchema = z.object({
  /** 1-based row in the source, so an issue can point back at it. */
  row: z.number().int().nonnegative(),
  name: z.string().trim().min(1, 'Name is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  profile: z
    .union([z.string().trim(), z.null()])
    .nullish()
    .transform((value) => value ?? null),
  length: optionalNumberCell,
  weightPerPiece: optionalNumberCell,
});

/**
 * Either the pasted text, or the rows an admin has already seen in the preview
 * table. Sending rows is what lets a brand-new project collect its list before
 * it exists — the list is held in the form and saved once the project is.
 */
export const importProjectAssembliesSchema = z
  .object({
    tsv: z.string().trim().min(1).optional(),
    rows: z.array(assemblyImportRowSchema).optional(),
    /**
     * Replace the list instead of adding to it: marks the project has but the
     * incoming list does not are soft-deleted. The timesheets that covered them
     * are untouched — that work was done and still has to be paid. Only ever set
     * from an explicit "overwrite" action; a plain import leaves them alone.
     */
    replace: z.boolean().optional(),
  })
  .refine((input) => (input.tsv === undefined) !== (input.rows === undefined), {
    message: 'Provide either tsv or rows, not both',
  });

export type AssemblyImportRowDto = z.infer<typeof assemblyImportRowSchema>;

/** What the upload screen shows before anything is saved. */
export type AssemblyPreviewDto = {
  /** Every sheet name in the workbook, in order. Empty for a paste. */
  sheets: string[];
  /**
   * The sheet the rows came from. Null when the workbook has no sheet called
   * ANSAMBLE — the names are then put to the admin instead of guessed at.
   */
  sheetName: string | null;
  rows: AssemblyImportRowDto[];
  issues: AssemblyImportIssue[];
  hasHeaderRow: boolean;
};

export type CreateProjectAssemblyInput = z.infer<typeof createProjectAssemblySchema>;
export type UpdateProjectAssemblyInput = z.infer<typeof updateProjectAssemblySchema>;
export type ImportProjectAssembliesInput = z.infer<typeof importProjectAssembliesSchema>;

/** Pieces done for one activity. Activities with no logged work are omitted. */
export type AssemblyProgressDto = {
  activityId: string;
  activityName: string;
  activityColor: string | null;
  quantityDone: number;
};

export type ProjectAssemblyDto = {
  id: string;
  projectId: string;
  /** Assembly mark from the drawing, e.g. "GBAL/25". */
  name: string;
  quantity: number;
  /** Spelled as it was imported; null until filled in. */
  profile: string | null;
  /** `profile` normalized — the grouping and catalogue key. */
  profileKey: string | null;
  /** Millimetres, fractions included; null when not filled in. */
  length: number | null;
  /** Kilograms per piece, as the list states it; null when not filled in. */
  weightPerPiece: number | null;
  position: number;
  /** Derived from the timesheets that covered this assembly, never stored. */
  progress: AssemblyProgressDto[];
  createdAt: string;
  updatedAt: string;
};

export const ASSEMBLY_LIST_STATUS_VALUES = ['all', 'pending', 'completed'] as const;

/** `pending` and `completed` split the list by remaining pieces, and need an activity. */
export type AssemblyListStatus = (typeof ASSEMBLY_LIST_STATUS_VALUES)[number];

export const ASSEMBLY_IMPORT_ISSUE_CODES = [
  /** No recognizable header row — columns were read by position. */
  'NO_HEADER_ROW',
  /** Row had no assembly mark, so there was nothing to key it on. Skipped. */
  'MISSING_NAME',
  /** Piece count unreadable; imported as 1. */
  'INVALID_QUANTITY',
  /** Length unreadable; imported empty. */
  'INVALID_LENGTH',
  /** Weight unreadable; imported empty. */
  'INVALID_WEIGHT',
  /** The same mark appeared twice in the paste; the last one won. */
  'DUPLICATE_NAME',
  /** The revised count is below what is already reported as done. */
  'QUANTITY_BELOW_PROGRESS',
] as const;

export type AssemblyImportIssueCode = (typeof ASSEMBLY_IMPORT_ISSUE_CODES)[number];

/**
 * Something worth telling the admin about a row. Never a refusal — every row
 * that carries a mark is imported, flagged or not.
 */
export type AssemblyImportIssue = {
  /** 1-based row in the pasted text; 0 when it is about the paste as a whole. */
  row: number;
  name: string | null;
  code: AssemblyImportIssueCode;
  /** The offending cell, when there is one. */
  value: string | null;
};

export type AssemblyImportResult = {
  created: number;
  updated: number;
  /** Rows with no assembly mark — the only rows that do not make it in. */
  skipped: number;
  /** Marks dropped because `replace` was set; 0 for a plain import. */
  deleted: number;
  issues: AssemblyImportIssue[];
};
