import { z } from 'zod';

const projectIdSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format',
  );

export const reorderPinnedProjectsSchema = z.object({
  orderedIds: z.array(projectIdSchema).min(1, 'At least one project id is required'),
});

export type ReorderPinnedProjectsInput = z.infer<typeof reorderPinnedProjectsSchema>;
