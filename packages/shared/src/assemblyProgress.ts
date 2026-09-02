import type { AssemblyProgressDto, ProjectAssemblyDto } from './dto/assembly.dto';

/** Pieces of this assembly already done for one activity. */
export function assemblyDoneForActivity(
  assembly: Pick<ProjectAssemblyDto, 'progress'>,
  activityId: string,
): number {
  return (
    assembly.progress.find((row: AssemblyProgressDto) => row.activityId === activityId)
      ?.quantityDone ?? 0
  );
}

/**
 * How many pieces are still open for one activity. Never negative — an
 * over-reported assembly reads as "nothing left", and the excess surfaces
 * through isAssemblyOverDone instead.
 */
export function assemblyRemainingForActivity(
  assembly: Pick<ProjectAssemblyDto, 'quantity' | 'progress'>,
  activityId: string,
): number {
  return Math.max(0, assembly.quantity - assemblyDoneForActivity(assembly, activityId));
}

/**
 * More pieces reported than the list says exist. The shop floor is usually
 * right and the list is stale, so this is a flag for the admin, never a block.
 */
export function isAssemblyOverDone(
  assembly: Pick<ProjectAssemblyDto, 'quantity' | 'progress'>,
  activityId: string,
): boolean {
  return assemblyDoneForActivity(assembly, activityId) > assembly.quantity;
}

/** Every activity that has work logged against this assembly is over quantity. */
export function assemblyHasOverDoneActivity(
  assembly: Pick<ProjectAssemblyDto, 'quantity' | 'progress'>,
): boolean {
  return assembly.progress.some((row) => row.quantityDone > assembly.quantity);
}
