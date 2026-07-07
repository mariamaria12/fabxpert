'use client';

import {
  ApiError,
  createPerson,
  createPersonSchema,
  deletePerson,
  listEmployeeRoles,
  updatePerson,
  updatePersonSchema,
  type EmployeeRoleDto,
  type PersonDto,
} from '@fabxpert/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

interface PersonFormValues {
  firstName: string;
  lastName: string;
  employeeRoleId: string;
  email: string;
  phone: string;
}

const EMPTY_FORM: PersonFormValues = {
  firstName: '',
  lastName: '',
  employeeRoleId: '',
  email: '',
  phone: '',
};

function personToFormValues(person: PersonDto): PersonFormValues {
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    employeeRoleId: person.employeeRoleId ?? '',
    email: person.email ?? '',
    phone: person.phone ?? '',
  };
}

function mapZodFieldErrors(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }) {
  const flat = error.flatten().fieldErrors;
  const mapped: Partial<Record<keyof PersonFormValues, string>> = {};

  if (flat.firstName?.[0]) {
    mapped.firstName = 'Prenumele este obligatoriu.';
  }
  if (flat.lastName?.[0]) {
    mapped.lastName = 'Numele este obligatoriu.';
  }
  if (flat.email?.[0]) {
    mapped.email = flat.email[0];
  }

  return mapped;
}

function buildCreatePayload(values: PersonFormValues) {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    phone: values.phone,
    ...(values.employeeRoleId ? { employeeRoleId: values.employeeRoleId } : {}),
  };
}

function buildUpdatePayload(values: PersonFormValues) {
  return buildCreatePayload(values);
}

const inputClassName =
  'w-full rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

interface FormFieldProps {
  id: keyof PersonFormValues;
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  type?: 'text' | 'email';
  onChange: (value: string) => void;
}

function FormField({
  id,
  label,
  value,
  error,
  disabled,
  required,
  type = 'text',
  onChange,
}: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs text-text-secondary">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

interface SelectFieldProps {
  id: keyof PersonFormValues;
  label: string;
  value: string;
  disabled?: boolean;
  options: EmployeeRoleDto[];
  onChange: (value: string) => void;
}

function SelectField({ id, label, value, disabled, options, onChange }: SelectFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs text-text-secondary">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      >
        <option value="">Fără funcție</option>
        {options.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface PersonFormPanelProps {
  open: boolean;
  mode: 'create' | 'edit';
  person: PersonDto | null;
  onClose: () => void;
  onSaved: () => void;
}

export function PersonFormPanel({ open, mode, person, onClose, onSaved }: PersonFormPanelProps) {
  const { showToast } = useToast();
  const [values, setValues] = useState<PersonFormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof PersonFormValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [employeeRoles, setEmployeeRoles] = useState<EmployeeRoleDto[]>([]);

  const isBusy = isSubmitting || isDeleting;
  const title = mode === 'create' ? 'Persoană nouă' : 'Editează persoana';

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    listEmployeeRoles()
      .then((roles) => {
        if (!cancelled) {
          setEmployeeRoles(roles);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEmployeeRoles([]);
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
    setValues(mode === 'edit' && person ? personToFormValues(person) : EMPTY_FORM);
  }, [open, mode, person]);

  function updateField(field: keyof PersonFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
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

    if (mode === 'create') {
      const parsed = createPersonSchema.safeParse(buildCreatePayload(values));
      if (!parsed.success) {
        setFieldErrors(mapZodFieldErrors(parsed.error));
        return;
      }

      setIsSubmitting(true);
      try {
        await createPerson(parsed.data);
        showToast('Persoană adăugată', 'success');
        onSaved();
        onClose();
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 400) {
          setFormError(caught.message);
        } else {
          showToast(apiErrorToastMessage(caught), 'error');
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!person) {
      return;
    }

    const parsed = updatePersonSchema.safeParse(buildUpdatePayload(values));
    if (!parsed.success) {
      setFieldErrors(mapZodFieldErrors(parsed.error));
      return;
    }

    setIsSubmitting(true);
    try {
      await updatePerson(person.id, parsed.data);
      showToast('Persoană actualizată', 'success');
      onSaved();
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) {
        setFormError(caught.message);
      } else {
        showToast(apiErrorToastMessage(caught), 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!person || isBusy) {
      return;
    }

    setIsDeleting(true);
    try {
      await deletePerson(person.id);
      showToast('Persoană ștearsă', 'success');
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
    <div role="alertdialog" aria-labelledby="person-delete-title">
      <p id="person-delete-title" className="text-sm text-text-secondary">
        Sigur ștergi această persoană?
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
        form="person-form"
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
      <form id="person-form" onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        <FormField
          id="firstName"
          label="Prenume"
          value={values.firstName}
          error={fieldErrors.firstName}
          disabled={isBusy}
          required
          onChange={(value) => updateField('firstName', value)}
        />

        <FormField
          id="lastName"
          label="Nume"
          value={values.lastName}
          error={fieldErrors.lastName}
          disabled={isBusy}
          required
          onChange={(value) => updateField('lastName', value)}
        />

        <SelectField
          id="employeeRoleId"
          label="Funcție"
          value={values.employeeRoleId}
          disabled={isBusy}
          options={employeeRoles}
          onChange={(value) => updateField('employeeRoleId', value)}
        />

        <FormField
          id="email"
          label="E-mail"
          type="email"
          value={values.email}
          error={fieldErrors.email}
          disabled={isBusy}
          onChange={(value) => updateField('email', value)}
        />

        <FormField
          id="phone"
          label="Telefon"
          value={values.phone}
          disabled={isBusy}
          onChange={(value) => updateField('phone', value)}
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
              <span>Șterge persoana</span>
            </button>
          </div>
        )}
      </form>
    </SlideOverPanel>
  );
}
