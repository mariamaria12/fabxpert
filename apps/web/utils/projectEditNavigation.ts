export const PROJECT_EDIT_RETURN_PANOU = 'panou';

export function buildProjectEditHref(
  projectId: string,
  returnTo: typeof PROJECT_EDIT_RETURN_PANOU = PROJECT_EDIT_RETURN_PANOU,
) {
  const params = new URLSearchParams({ edit: projectId, return: returnTo });
  return `/projects?${params.toString()}`;
}

export function panouPathFromProjectEditReturn(returnTo: string | null) {
  return returnTo === PROJECT_EDIT_RETURN_PANOU ? '/' : null;
}
