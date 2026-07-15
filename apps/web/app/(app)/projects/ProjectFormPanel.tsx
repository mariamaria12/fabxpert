'use client';

import {
  ApiError,
  createCompany,
  createCompanySchema,
  createProject,
  createProjectSchema,
  deleteProject,
  getProject,
  PROJECT_STATUS_META,
  PROJECT_STATUS_VALUES,
  pickRandomProjectColor,
  updateProject,
  updateProjectSchema,
  type CompanyDto,
  type EmployeeRoleDto,
  type ProjectDto,
  type ProjectStatus,
} from '@fabxpert/shared';
import { useEffect, useMemo, useState, type ClipboardEvent, type FormEvent } from 'react';
import { parseExcelProjectPaste } from './parseExcelProjectPaste';
import { ColorField } from '@/components/ColorField';
import { useBusinessAutofillProps } from '@/components/inputAutofill';
import { SearchableMultiSelect } from '@/components/SearchableMultiSelect';
import { SearchableSelect, type SearchableSelectOption } from '@/components/SearchableSelect';
import { TextField } from '@/components/TextField';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { equalsSearchText } from '@/utils/searchText';
import {
  companyOptionFromProjectCompany,
  getProjectFormCompanies,
  getProjectFormEmployeeRoles,
  mergeProjectFormCompany,
  withProjectCompanyOption,
} from '@/utils/projectFormLookups';
import { buildStableIndexMap, getRolePaletteColor } from '@/components/roleColors';

interface ProjectFormValues {
  name: string;
  code: string;
  companyId: string;
  status: ProjectStatus;
  startDate: string;
  dueDate: string;
  color: string | null;
  readyForExecution: boolean;
  visibleForRoleIds: string[];
}

const EMPTY_FORM: ProjectFormValues = {
  name: '',
  code: '',
  companyId: '',
  status: 'CIORNA',
  startDate: '',
  dueDate: '',
  color: null,
  readyForExecution: false,
  visibleForRoleIds: [],
};

function isoToDateInput(iso: string | null): string {
  if (!iso) {
    return '';
  }
  return iso.slice(0, 10);
}

function projectToFormValues(project: ProjectDto): ProjectFormValues {
  return {
    name: project.name,
    code: project.code,
    companyId: project.companyId,
    status: project.status,
    startDate: isoToDateInput(project.startDate),
    dueDate: isoToDateInput(project.dueDate),
    color: project.color,
    readyForExecution: project.readyForExecution,
    visibleForRoleIds: (project.visibleForRoles ?? []).map((role) => role.id),
  };
}

function mapApiFormError(message: string): string {
  if (message === 'A project with this code already exists') {
    return 'Există deja un proiect cu acest cod.';
  }
  if (message === 'companyId does not reference an existing company') {
    return 'Clientul selectat nu există.';
  }
  if (message === 'One or more visibleForRoleIds do not reference existing employee roles') {
    return 'Una sau mai multe funcții selectate nu există.';
  }
  return message;
}

function mapZodFieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}) {
  const flat = error.flatten().fieldErrors;
  const mapped: Partial<Record<keyof ProjectFormValues | 'color', string>> = {};

  if (flat.name?.[0]) {
    mapped.name = 'Numele este obligatoriu.';
  }
  if (flat.code?.[0]) {
    mapped.code = 'Codul este obligatoriu.';
  }
  if (flat.companyId?.[0]) {
    mapped.companyId = 'Clientul este obligatoriu.';
  }
  if (flat.color?.[0]) {
    mapped.color = 'Culoarea trebuie să fie un hex valid (#RRGGBB).';
  }

  return mapped;
}

function mapApiValidationErrors(
  errors: { path: string; message: string }[],
): Partial<Record<keyof ProjectFormValues | 'color', string>> {
  const mapped: Partial<Record<keyof ProjectFormValues | 'color', string>> = {};

  for (const error of errors) {
    if (error.path === 'name' && !mapped.name) {
      mapped.name = 'Numele este obligatoriu.';
    }
    if (error.path === 'code' && !mapped.code) {
      mapped.code = 'Codul este obligatoriu.';
    }
    if (error.path === 'companyId' && !mapped.companyId) {
      mapped.companyId = 'Clientul este obligatoriu.';
    }
    if (error.path === 'color' && !mapped.color) {
      mapped.color = 'Culoarea trebuie să fie un hex valid (#RRGGBB).';
    }
  }

  return mapped;
}

function buildCreatePayload(values: ProjectFormValues) {
  return {
    name: values.name,
    code: values.code,
    companyId: values.companyId,
    status: values.status,
    readyForExecution: values.readyForExecution,
    visibleForRoleIds: values.visibleForRoleIds,
    ...(values.startDate ? { startDate: values.startDate } : {}),
    ...(values.dueDate ? { dueDate: values.dueDate } : {}),
    ...(values.color ? { color: values.color } : {}),
  };
}

function buildUpdatePayload(values: ProjectFormValues) {
  return {
    name: values.name,
    code: values.code,
    companyId: values.companyId,
    status: values.status,
    readyForExecution: values.readyForExecution,
    visibleForRoleIds: values.visibleForRoleIds,
    ...(values.startDate ? { startDate: values.startDate } : {}),
    ...(values.dueDate ? { dueDate: values.dueDate } : {}),
    color: values.color,
  };
}

const inputClassName =
  'w-full rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

export interface ProjectFormPanelProps {
  open: boolean;
  mode: 'create' | 'edit';
  project: ProjectDto | null;
  onClose: () => void;
  onSaved: (updated?: ProjectDto) => void;
}

function findCompanyByName(companies: CompanyDto[], name: string): CompanyDto | undefined {
  return companies.find((company) => equalsSearchText(company.name, name));
}

export function ProjectFormPanel({ open, mode, project, onClose, onSaved }: ProjectFormPanelProps) {
  const { showToast } = useToast();
  const businessAutofill = useBusinessAutofillProps();
  const [values, setValues] = useState<ProjectFormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ProjectFormValues | 'color', string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [colorDraftInvalid, setColorDraftInvalid] = useState(false);
  const [companies, setCompanies] = useState<CompanyDto[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [employeeRoles, setEmployeeRoles] = useState<EmployeeRoleDto[]>([]);
  const [employeeRolesLoading, setEmployeeRolesLoading] = useState(false);
  const [editProject, setEditProject] = useState<ProjectDto | null>(null);
  const [editProjectLoading, setEditProjectLoading] = useState(false);
  const [excelPasteText, setExcelPasteText] = useState('');
  const [excelPasteError, setExcelPasteError] = useState<string | null>(null);
  const [excelPasteSuccess, setExcelPasteSuccess] = useState<string | null>(null);
  const [excelUsedFirstRowOnly, setExcelUsedFirstRowOnly] = useState(false);
  const [excelExtraColumnsIgnored, setExcelExtraColumnsIgnored] = useState(false);
  const [unmatchedClientName, setUnmatchedClientName] = useState<string | null>(null);
  const [creatingClient, setCreatingClient] = useState(false);

  const isBusy = isSubmitting || isDeleting;
  const title = mode === 'create' ? 'Proiect nou' : 'Editează proiectul';

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    setCompaniesLoading(true);
    setEmployeeRolesLoading(true);

    Promise.all([getProjectFormCompanies(), getProjectFormEmployeeRoles()])
      .then(([companyRows, roleRows]) => {
        if (controller.signal.aborted) {
          return;
        }
        const linkedCompany = project?.company;
        const companiesWithLinked = withProjectCompanyOption(companyRows, linkedCompany);
        if (linkedCompany && !companyRows.some((entry) => entry.id === linkedCompany.id)) {
          mergeProjectFormCompany(companyOptionFromProjectCompany(linkedCompany));
        }
        setCompanies(companiesWithLinked);
        setEmployeeRoles(roleRows);
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }
        setCompanies([]);
        setEmployeeRoles([]);
      })
      .finally(() => {
        if (controller.signal.aborted) {
          return;
        }
        setCompaniesLoading(false);
        setEmployeeRolesLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [open, project?.company?.id, project?.company?.name]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setConfirmDelete(false);
    setIsSubmitting(false);
    setIsDeleting(false);
    setEditProject(null);

    if (mode === 'create') {
      setValues({ ...EMPTY_FORM, color: pickRandomProjectColor() });
      setEditProjectLoading(false);
      setExcelPasteText('');
      setExcelPasteError(null);
      setExcelPasteSuccess(null);
      setExcelUsedFirstRowOnly(false);
      setExcelExtraColumnsIgnored(false);
      setUnmatchedClientName(null);
      setCreatingClient(false);
      return;
    }

    if (!project) {
      return;
    }

    setValues(projectToFormValues(project));
    setEditProjectLoading(true);

    let cancelled = false;
    getProject(project.id)
      .then((fullProject) => {
        if (!cancelled) {
          setEditProject(fullProject);
          setValues(projectToFormValues(fullProject));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEditProject(project);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setEditProjectLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, mode, project]);

  const companyOptions = useMemo((): SearchableSelectOption[] => {
    return companies.map((company) => ({
      id: company.id,
      label: company.name,
    }));
  }, [companies]);

  const statusOptions = useMemo((): SearchableSelectOption[] => {
    return PROJECT_STATUS_VALUES.map((status) => ({
      id: status,
      label: PROJECT_STATUS_META[status].label,
    }));
  }, []);

  const employeeRoleOptions = useMemo((): SearchableSelectOption[] => {
    const seen = new Set<string>();
    const options: SearchableSelectOption[] = [];
    const rolesForColorIndex: EmployeeRoleDto[] = [...employeeRoles];

    const assignedRoles = editProject?.visibleForRoles ?? project?.visibleForRoles ?? [];
    for (const role of assignedRoles) {
      if (!rolesForColorIndex.some((entry) => entry.id === role.id)) {
        rolesForColorIndex.push({
          id: role.id,
          name: role.name,
          isActive: false,
          createdAt: role.id,
          updatedAt: role.id,
        });
      }
    }

    const roleColorById = buildStableIndexMap(rolesForColorIndex);

    for (const role of employeeRoles) {
      seen.add(role.id);
      options.push({
        id: role.id,
        label: role.name,
        color: getRolePaletteColor(roleColorById.get(role.id) ?? 0),
      });
    }

    for (const role of assignedRoles) {
      if (seen.has(role.id)) {
        continue;
      }
      seen.add(role.id);
      options.push({
        id: role.id,
        label: `${role.name} (inactivă)`,
        color: getRolePaletteColor(roleColorById.get(role.id) ?? 0),
      });
    }

    return options.sort((left, right) => left.label.localeCompare(right.label, 'ro'));
  }, [employeeRoles, editProject, project]);

  const selectedCompanyLabel = useMemo(() => {
    if (!values.companyId) {
      return undefined;
    }

    if (mode === 'edit' && project?.companyId === values.companyId) {
      return project.company.name;
    }

    return companyOptions.find((option) => option.id === values.companyId)?.label;
  }, [values.companyId, mode, project, companyOptions]);

  function updateField<K extends keyof ProjectFormValues>(field: K, value: ProjectFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    if (field === 'companyId') {
      setUnmatchedClientName(null);
    }
    setFieldErrors((current) => {
      if (!current[field as keyof ProjectFormValues]) {
        return current;
      }
      const next = { ...current };
      delete next[field as keyof ProjectFormValues];
      return next;
    });
    setFormError(null);
  }

  function applyExcelProjectPaste(text: string) {
    const result = parseExcelProjectPaste(text);

    if (!result.ok) {
      setExcelPasteError(result.error);
      setExcelPasteSuccess(null);
      setExcelUsedFirstRowOnly(false);
      setExcelExtraColumnsIgnored(false);
      return;
    }

    const matchedCompany = result.values.clientName
      ? findCompanyByName(companies, result.values.clientName)
      : undefined;

    setValues((current) => ({
      ...current,
      name: result.values.name,
      code: result.values.code,
      status: result.values.status,
      startDate: result.values.startDate,
      dueDate: result.values.dueDate,
      companyId: matchedCompany?.id ?? '',
    }));
    setFieldErrors({});
    setFormError(null);
    setExcelPasteText('');
    setExcelPasteError(null);
    setExcelPasteSuccess('Câmpurile au fost precompletate din Excel.');
    setExcelUsedFirstRowOnly(result.usedFirstRowOnly);
    setExcelExtraColumnsIgnored(result.extraColumnsIgnored);
    setUnmatchedClientName(
      result.values.clientName && !matchedCompany ? result.values.clientName : null,
    );
  }

  function handleExcelPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (isBusy) {
      return;
    }

    event.preventDefault();
    applyExcelProjectPaste(event.clipboardData.getData('text/plain'));
  }

  async function handleCreateClient(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName || creatingClient || isBusy) {
      return;
    }

    const existing = findCompanyByName(companies, trimmedName);
    if (existing) {
      updateField('companyId', existing.id);
      setUnmatchedClientName(null);
      return;
    }

    setCreatingClient(true);
    try {
      const parsed = createCompanySchema.safeParse({ name: trimmedName });
      if (!parsed.success) {
        showToast('Numele clientului nu este valid.', 'error');
        return;
      }

      const created = await createCompany(parsed.data);
      mergeProjectFormCompany(created);
      setCompanies((current) =>
        [...current, created].sort((left, right) => left.name.localeCompare(right.name, 'ro')),
      );
      updateField('companyId', created.id);
      setUnmatchedClientName(null);
      showToast('Client adăugat', 'success');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setFieldErrors((current) => ({
          ...current,
          companyId: 'Există deja o companie cu această denumire.',
        }));
      } else {
        showToast(apiErrorToastMessage(caught), 'error');
      }
    } finally {
      setCreatingClient(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) {
      return;
    }

    setFormError(null);
    setFieldErrors({});

    if (colorDraftInvalid) {
      setFieldErrors({ color: 'Culoarea trebuie să fie un hex valid (#RRGGBB).' });
      return;
    }

    if (mode === 'create') {
      const parsed = createProjectSchema.safeParse(buildCreatePayload(values));
      if (!parsed.success) {
        setFieldErrors(mapZodFieldErrors(parsed.error));
        return;
      }

      setIsSubmitting(true);
      try {
        await createProject(parsed.data);
        showToast('Proiect adăugat', 'success');
        onSaved();
        onClose();
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 409) {
          setFieldErrors({ code: mapApiFormError(caught.message) });
        } else if (caught instanceof ApiError && caught.status === 400) {
          if (caught.validationErrors?.length) {
            setFieldErrors(mapApiValidationErrors(caught.validationErrors));
          } else {
            setFormError(mapApiFormError(caught.message));
          }
        } else {
          showToast(apiErrorToastMessage(caught), 'error');
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!project) {
      return;
    }

    const parsed = updateProjectSchema.safeParse(buildUpdatePayload(values));
    if (!parsed.success) {
      setFieldErrors(mapZodFieldErrors(parsed.error));
      return;
    }

    setIsSubmitting(true);
    try {
      const saved = await updateProject(project.id, parsed.data);
      showToast('Proiect actualizat', 'success');
      onSaved(saved);
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setFieldErrors({ code: mapApiFormError(caught.message) });
      } else if (caught instanceof ApiError && caught.status === 400) {
        if (caught.validationErrors?.length) {
          setFieldErrors(mapApiValidationErrors(caught.validationErrors));
        } else {
          setFormError(mapApiFormError(caught.message));
        }
      } else {
        showToast(apiErrorToastMessage(caught), 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!project || isBusy) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteProject(project.id);
      showToast('Proiect șters', 'success');
      onSaved();
      onClose();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }

  const footer = confirmDelete ? (
    <div role="alertdialog" aria-labelledby="project-delete-title">
      <p id="project-delete-title" className="text-sm text-text-secondary">
        Ștergi proiectul „{project?.name}”?
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={isDeleting}
          onClick={() => void handleDelete()}
          className="flex-1 rounded-md bg-[var(--color-timer-stop)] px-4 py-2.5 text-sm font-medium text-[var(--color-timer-stop-text)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDeleting ? 'Se șterge…' : 'Șterge'}
        </button>
        <button
          type="button"
          disabled={isDeleting}
          onClick={() => setConfirmDelete(false)}
          className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anulează
        </button>
      </div>
    </div>
  ) : (
    <div className="flex gap-2">
      <button
        type="submit"
        form="project-form"
        disabled={isBusy}
        className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Se salvează…' : mode === 'create' ? 'Adaugă' : 'Salvează'}
      </button>
      <button
        type="button"
        disabled={isBusy}
        onClick={onClose}
        className="rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        Anulează
      </button>
    </div>
  );

  return (
    <SlideOverPanel
      open={open}
      title={title}
      onClose={onClose}
      disableClose={isBusy}
      footer={footer}
    >
      <form id="project-form" onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        <ColorField
          id="color"
          label="Culoare"
          value={values.color}
          error={fieldErrors.color}
          disabled={isBusy}
          onChange={(color) => {
            setValues((current) => ({ ...current, color }));
            setFieldErrors((current) => {
              if (!current.color) {
                return current;
              }
              const next = { ...current };
              delete next.color;
              return next;
            });
            setFormError(null);
          }}
          onDraftInvalidChange={setColorDraftInvalid}
        />

        {mode === 'create' && (
          <div>
            <label htmlFor="project-excel-paste" className="mb-1.5 block text-xs text-text-secondary">
              Prepopulează din Excel
            </label>
            <textarea
              id="project-excel-paste"
              rows={2}
              value={excelPasteText}
              disabled={isBusy}
              placeholder="Lipește aici un rând copiat din Excel"
              onChange={(event) => setExcelPasteText(event.target.value)}
              onPaste={handleExcelPaste}
              className={`${inputClassName} resize-none`}
              {...businessAutofill}
            />
            {excelPasteError && (
              <p role="alert" className="mt-1 text-xs text-danger">
                {excelPasteError}
              </p>
            )}
            {excelPasteSuccess && (
              <p className="mt-1 text-xs text-text-muted">{excelPasteSuccess}</p>
            )}
            {excelUsedFirstRowOnly && (
              <p className="mt-1 text-xs text-text-muted">Am folosit doar primul rând.</p>
            )}
            {excelExtraColumnsIgnored && (
              <p className="mt-1 text-xs text-text-muted">
                Coloanele suplimentare au fost ignorate.
              </p>
            )}
          </div>
        )}

        <SearchableMultiSelect
          id="visibleForRoleIds"
          label="Vizibil pentru"
          values={values.visibleForRoleIds}
          options={employeeRoleOptions}
          disabled={isBusy || employeeRolesLoading || editProjectLoading}
          placeholder="Caută funcție…"
          emptyMessage="Nicio funcție găsită."
          helperText="Lasă gol pentru a fi vizibil tuturor angajaților."
          onChange={(visibleForRoleIds) => updateField('visibleForRoleIds', visibleForRoleIds)}
        />

        <div>
          <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={values.readyForExecution}
              disabled={isBusy}
              onChange={(event) => updateField('readyForExecution', event.target.checked)}
              className="size-4 rounded border-border accent-accent"
            />
            Gata de execuție
          </label>
          <p className="mt-1.5 text-xs text-text-muted">
            Proiectele gata de execuție apar angajaților în aplicația mobilă.
          </p>
        </div>

        <TextField
          id="name"
          label="Nume"
          required
          value={values.name}
          error={fieldErrors.name}
          disabled={isBusy}
          onChange={(value) => updateField('name', value)}
        />

        <TextField
          id="code"
          label="Cod"
          required
          value={values.code}
          error={fieldErrors.code}
          disabled={isBusy}
          className={`${inputClassName} font-mono`}
          onChange={(value) => updateField('code', value)}
        />

        <SearchableSelect
          id="companyId"
          label="Client"
          required
          clearable={false}
          placeholder="Caută client…"
          emptyMessage="Niciun client găsit."
          value={values.companyId || null}
          selectedLabel={selectedCompanyLabel}
          options={companyOptions}
          disabled={isBusy || companiesLoading}
          error={fieldErrors.companyId}
          onChange={(companyId) => {
            if (companyId) {
              updateField('companyId', companyId);
            }
          }}
          onCreateFromQuery={
            mode === 'create' ? (query) => void handleCreateClient(query) : undefined
          }
          createFromQueryLabel={(query) => `+ Adaugă client „${query}"`}
          creatingFromQuery={creatingClient}
        />
        {unmatchedClientName && (
          <div className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
            <span>{`Client „${unmatchedClientName}" nu a fost găsit.`}</span>
            <button
              type="button"
              disabled={isBusy || creatingClient}
              onClick={() => void handleCreateClient(unmatchedClientName)}
              className="inline-flex items-center rounded-md border border-border-subtle px-2 py-1 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingClient
                ? 'Se adaugă…'
                : `+ Adaugă client „${unmatchedClientName}"`}
            </button>
          </div>
        )}

        <SearchableSelect
          id="status"
          label="Status"
          clearable={false}
          placeholder="Caută status…"
          emptyMessage="Niciun status găsit."
          value={values.status}
          options={statusOptions}
          disabled={isBusy}
          onChange={(status) => {
            if (status) {
              updateField('status', status as ProjectStatus);
            }
          }}
        />

        <TextField
          id="startDate"
          label="Dată începere"
          type="date"
          value={values.startDate}
          disabled={isBusy}
          className={`${inputClassName} [color-scheme:dark]`}
          onChange={(value) => updateField('startDate', value)}
        />

        <TextField
          id="dueDate"
          label="Termen"
          type="date"
          value={values.dueDate}
          disabled={isBusy}
          className={`${inputClassName} [color-scheme:dark]`}
          onChange={(value) => updateField('dueDate', value)}
        />

        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}

        {mode === 'edit' && !confirmDelete && (
          <div className="mt-2 border-t border-border-subtle pt-4">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-2 text-sm text-danger transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <i className="ti ti-trash text-base" aria-hidden="true" />
              <span>Șterge proiectul</span>
            </button>
          </div>
        )}
      </form>
    </SlideOverPanel>
  );
}
