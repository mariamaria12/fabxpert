'use client';

import {
  ApiError,
  createProject,
  createProjectSchema,
  deleteProject,
  listCompanies,
  PROJECT_STATUS_META,
  PROJECT_STATUS_VALUES,
  updateProject,
  updateProjectSchema,
  type CompanyDto,
  type ProjectDto,
  type ProjectStatus,
} from '@fabxpert/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ColorField } from '@/components/ColorField';
import { SearchableSelect, type SearchableSelectOption } from '@/components/SearchableSelect';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { loadAllPages } from '@/utils/loadAllPages';

interface ProjectFormValues {
  name: string;
  code: string;
  companyId: string;
  status: ProjectStatus;
  startDate: string;
  dueDate: string;
  color: string | null;
  readyForExecution: boolean;
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
  };
}

function mapApiFormError(message: string): string {
  if (message === 'A project with this code already exists') {
    return 'Există deja un proiect cu acest cod.';
  }
  if (message === 'companyId does not reference an existing company') {
    return 'Clientul selectat nu există.';
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
    ...(values.startDate ? { startDate: values.startDate } : {}),
    ...(values.dueDate ? { dueDate: values.dueDate } : {}),
    color: values.color,
  };
}

const inputClassName =
  'w-full rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

const LOOKUP_PAGE_SIZE = 200;

async function loadAllCompanies(): Promise<CompanyDto[]> {
  return loadAllPages(
    (page, pageSize) => listCompanies({ page, pageSize }),
    LOOKUP_PAGE_SIZE,
  );
}

export interface ProjectFormPanelProps {
  open: boolean;
  mode: 'create' | 'edit';
  project: ProjectDto | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ProjectFormPanel({ open, mode, project, onClose, onSaved }: ProjectFormPanelProps) {
  const { showToast } = useToast();
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

  const isBusy = isSubmitting || isDeleting;
  const title = mode === 'create' ? 'Proiect nou' : 'Editează proiectul';

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setCompaniesLoading(true);

    loadAllCompanies()
      .then((rows) => {
        if (!cancelled) {
          setCompanies(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompanies([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCompaniesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setConfirmDelete(false);
    setIsSubmitting(false);
    setIsDeleting(false);
    setValues(mode === 'edit' && project ? projectToFormValues(project) : EMPTY_FORM);
  }, [open, mode, project]);

  const companyOptions = useMemo((): SearchableSelectOption[] => {
    return companies.map((company) => ({
      id: company.id,
      label: company.name,
    }));
  }, [companies]);

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
      await updateProject(project.id, parsed.data);
      showToast('Proiect actualizat', 'success');
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

        <div>
          <label htmlFor="name" className="mb-1.5 block text-xs text-text-secondary">
            Nume<span className="text-danger"> *</span>
          </label>
          <input
            id="name"
            type="text"
            value={values.name}
            disabled={isBusy}
            onChange={(event) => updateField('name', event.target.value)}
            className={inputClassName}
          />
          {fieldErrors.name && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="code" className="mb-1.5 block text-xs text-text-secondary">
            Cod<span className="text-danger"> *</span>
          </label>
          <input
            id="code"
            type="text"
            value={values.code}
            disabled={isBusy}
            onChange={(event) => updateField('code', event.target.value)}
            className={`${inputClassName} font-mono`}
          />
          {fieldErrors.code && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {fieldErrors.code}
            </p>
          )}
        </div>

        <SearchableSelect
          id="companyId"
          label="Client"
          required
          placeholder="Caută clientul…"
          emptyMessage="Niciun client găsit."
          value={values.companyId || null}
          selectedLabel={selectedCompanyLabel}
          options={companyOptions}
          disabled={isBusy || companiesLoading}
          error={fieldErrors.companyId}
          onChange={(companyId) => updateField('companyId', companyId ?? '')}
        />

        <div>
          <label htmlFor="status" className="mb-1.5 block text-xs text-text-secondary">
            Status
          </label>
          <select
            id="status"
            value={values.status}
            disabled={isBusy}
            onChange={(event) => updateField('status', event.target.value as ProjectStatus)}
            className={inputClassName}
          >
            {PROJECT_STATUS_VALUES.map((status) => (
              <option key={status} value={status}>
                {PROJECT_STATUS_META[status].label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="startDate" className="mb-1.5 block text-xs text-text-secondary">
            Dată începere
          </label>
          <input
            id="startDate"
            type="date"
            value={values.startDate}
            disabled={isBusy}
            onChange={(event) => updateField('startDate', event.target.value)}
            className={`${inputClassName} [color-scheme:dark]`}
          />
        </div>

        <div>
          <label htmlFor="dueDate" className="mb-1.5 block text-xs text-text-secondary">
            Termen
          </label>
          <input
            id="dueDate"
            type="date"
            value={values.dueDate}
            disabled={isBusy}
            onChange={(event) => updateField('dueDate', event.target.value)}
            className={`${inputClassName} [color-scheme:dark]`}
          />
        </div>

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
            Controlează vizibilitatea proiectului pentru angajați în aplicația mobilă.
          </p>
        </div>

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
