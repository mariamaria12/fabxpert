import { ConflictException } from '@nestjs/common';

/** Row shape needed for revive-on-create by unique name. */
export type SoftDeletableByName = {
  id: string;
  deletedAt: Date | null;
};

/**
 * Create a lookup row, or revive a soft-deleted row with the same unique name.
 * Active duplicates still throw ConflictException.
 */
export async function createOrReviveSoftDeletedByName<TEntity extends SoftDeletableByName>(
  name: string,
  options: {
    findByName: (name: string) => Promise<TEntity | null>;
    conflictMessage: string;
    revive: (existing: TEntity) => Promise<TEntity>;
    create: () => Promise<TEntity>;
    onUniqueViolation: (error: unknown) => never;
  },
): Promise<TEntity> {
  const existing = await options.findByName(name);

  if (existing) {
    if (existing.deletedAt === null) {
      throw new ConflictException(options.conflictMessage);
    }

    return options.revive(existing);
  }

  try {
    return await options.create();
  } catch (error) {
    options.onUniqueViolation(error);
  }
}
