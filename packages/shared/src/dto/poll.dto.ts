import { z } from 'zod';

export const POLL_STATUS_VALUES = ['DRAFT', 'OPEN', 'CLOSED'] as const;
export type PollStatus = (typeof POLL_STATUS_VALUES)[number];

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 10;
export const POLL_TITLE_MAX_LENGTH = 160;
export const POLL_DESCRIPTION_MAX_LENGTH = 500;
export const POLL_OPTION_MAX_LENGTH = 120;

const pollDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

const pollOptionsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, 'Option text is required')
      .max(POLL_OPTION_MAX_LENGTH, `Option text cannot exceed ${POLL_OPTION_MAX_LENGTH} characters`),
  )
  .min(POLL_MIN_OPTIONS, `A poll needs at least ${POLL_MIN_OPTIONS} options`)
  .max(POLL_MAX_OPTIONS, `A poll cannot have more than ${POLL_MAX_OPTIONS} options`)
  .refine(
    (options) => new Set(options.map((option) => option.toLowerCase())).size === options.length,
    { message: 'Options must be distinct' },
  );

export const createPollSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(POLL_TITLE_MAX_LENGTH, `Title cannot exceed ${POLL_TITLE_MAX_LENGTH} characters`),
  description: z
    .string()
    .trim()
    .max(POLL_DESCRIPTION_MAX_LENGTH, `Description cannot exceed ${POLL_DESCRIPTION_MAX_LENGTH} characters`)
    .optional(),
  options: pollOptionsSchema,
  allowMultiple: z.boolean().optional(),
  /** Last day answers are accepted, inclusive. Omit to keep it open until closed by hand. */
  closesOn: pollDateSchema.nullish(),
});

/** Options can only be rewritten while the poll is still a draft — see the API. */
export const updatePollSchema = createPollSchema.partial();

export const votePollSchema = z.object({
  optionIds: z.array(z.string().trim().min(1)).min(1, 'Pick at least one option'),
});

export type CreatePollInput = z.infer<typeof createPollSchema>;
export type UpdatePollInput = z.infer<typeof updatePollSchema>;
export type VotePollInput = z.infer<typeof votePollSchema>;

/** Someone who picked an option. Only sent to admins. */
export interface PollVoterDto {
  userId: string;
  name: string;
}

export interface PollOptionDto {
  id: string;
  label: string;
  position: number;
  voteCount: number;
  /** Who picked it — admin only; employees just get `voteCount`. */
  voters?: PollVoterDto[];
}

export interface PollDto {
  id: string;
  title: string;
  description: string | null;
  allowMultiple: boolean;
  status: PollStatus;
  /** Last day answers are accepted (`YYYY-MM-DD`), or null when open-ended. */
  closesOn: string | null;
  publishedAt: string | null;
  createdAt: string;
  createdByName: string | null;
  options: PollOptionDto[];
  /** People who answered. */
  answerCount: number;
  /** People the poll was published to; 0 while it is still a draft. */
  audienceCount: number;
  /** Options the current user picked — empty when they haven't answered yet. */
  myOptionIds: string[];
}

export interface PublishPollResponse {
  poll: PollDto;
  /** Employees notified by the publish. */
  notifiedCount: number;
}
