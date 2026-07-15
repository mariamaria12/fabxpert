'use client';

import {
  ApiError,
  createUser,
  createUserSchema,
  deleteUser,
  listPersons,
  listUsers,
  updateUser,
  updateUserSchema,
  type PersonDto,
  type UpdateUserInput,
  type UserDto,
  type UserRole,
} from '@fabxpert/shared';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { SearchableSelect, type SearchableSelectOption } from '@/components/SearchableSelect';
import { SelectField } from '@/components/SelectField';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { TextField } from '@/components/TextField';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { loadAllPages } from '@/utils/loadAllPages';

interface UserFormValues {
  email: string;
  password: string;
  role: UserRole;
  personId: string;
  isActive: boolean;
}

const EMPTY_FORM: UserFormValues = {
  email: '',
  password: '',
  role: 'EMPLOYEE',
  personId: '',
  isActive: true,
};

function userToFormValues(user: UserDto): UserFormValues {
  return {
    email: user.email,
    password: '',
    role: user.role,
    personId: user.personId,
    isActive: user.isActive,
  };
}

function buildUpdatePayload(user: UserDto, values: UserFormValues): UpdateUserInput {
  const payload: UpdateUserInput = {};

  if (values.email !== user.email) {
    payload.email = values.email;
  }
  if (values.role !== user.role) {
    payload.role = values.role;
  }
  if (values.personId !== user.personId) {
    payload.personId = values.personId;
  }
  if (values.isActive !== user.isActive) {
    payload.isActive = values.isActive;
  }

  const trimmedPassword = values.password.trim();
  if (trimmedPassword) {
    payload.password = trimmedPassword;
  }

  return payload;
}

function mapApiValidationErrors(
  errors: { path: string; message: string }[],
): Partial<Record<keyof UserFormValues, string>> {
  const mapped: Partial<Record<keyof UserFormValues, string>> = {};

  for (const error of errors) {
    if (error.path === 'email' && !mapped.email) {
      mapped.email = 'Adresa de e-mail nu este validă.';
    }
    if (error.path === 'password' && !mapped.password) {
      mapped.password = 'Parola trebuie să aibă cel puțin 8 caractere.';
    }
    if (error.path === 'personId' && !mapped.personId) {
      mapped.personId = 'Persoana este obligatorie.';
    }
  }

  return mapped;
}

function mapApiFormError(message: string): string {
  switch (message) {
    case 'A user with this email already exists':
      return 'Există deja un utilizator cu acest e-mail.';
    case 'This person already has a user account':
      return 'Această persoană are deja un cont de utilizator.';
    case 'You cannot deactivate your own account':
      return 'Nu poți dezactiva propriul cont.';
    case 'You cannot demote your own account':
      return 'Nu poți retrograda propriul cont.';
    case 'You cannot delete your own account':
      return 'Nu poți șterge propriul cont.';
    default:
      return message;
  }
}

function mapZodFieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}) {
  const flat = error.flatten().fieldErrors;
  const mapped: Partial<Record<keyof UserFormValues, string>> = {};

  if (flat.email?.[0]) {
    mapped.email = 'Adresa de e-mail nu este validă.';
  }
  if (flat.password?.[0]) {
    mapped.password = 'Parola trebuie să aibă cel puțin 8 caractere.';
  }
  if (flat.personId?.[0]) {
    mapped.personId = 'Persoana este obligatorie.';
  }

  return mapped;
}

export interface UserFormPanelProps {
  open: boolean;
  mode: 'create' | 'edit';
  user: UserDto | null;
  onClose: () => void;
  onSaved: (updated?: UserDto) => void;
}

const LOOKUP_PAGE_SIZE = 200;

/** TODO: move to server-side person search when the list grows into the thousands. */
async function loadAllPersons(): Promise<PersonDto[]> {
  return loadAllPages((page, pageSize) => listPersons(page, pageSize), LOOKUP_PAGE_SIZE);
}

async function loadAllAssignedPersonIds(): Promise<Set<string>> {
  const users = await loadAllPages(
    (page, pageSize) => listUsers({ page, pageSize }),
    LOOKUP_PAGE_SIZE,
  );
  return new Set(users.map((entry) => entry.personId));
}

export function UserFormPanel({ open, mode, user, onClose, onSaved }: UserFormPanelProps) {
  const { showToast } = useToast();
  const [values, setValues] = useState<UserFormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof UserFormValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [persons, setPersons] = useState<PersonDto[]>([]);
  const [assignedPersonIds, setAssignedPersonIds] = useState<Set<string>>(new Set());
  const [personsLoading, setPersonsLoading] = useState(false);

  const isBusy = isSubmitting || isDeleting;
  const title = mode === 'create' ? 'Utilizator nou' : 'Editează utilizatorul';

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setPersonsLoading(true);

    Promise.all([loadAllPersons(), loadAllAssignedPersonIds()])
      .then(([allPersons, assignedIds]) => {
        if (!cancelled) {
          setPersons(allPersons);
          setAssignedPersonIds(assignedIds);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPersons([]);
          setAssignedPersonIds(new Set());
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPersonsLoading(false);
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
    setValues(mode === 'edit' && user ? userToFormValues(user) : EMPTY_FORM);
  }, [open, mode, user]);

  const personOptions = useMemo((): SearchableSelectOption[] => {
    return persons.map((person) => {
      const hasAccount = assignedPersonIds.has(person.id);
      const isLinkedPerson = mode === 'edit' && user?.personId === person.id;
      const disabled = hasAccount && !isLinkedPerson;

      return {
        id: person.id,
        label: `${person.firstName} ${person.lastName}`,
        description: person.employeeRole?.name,
        disabled,
        disabledSuffix: disabled ? 'are deja cont' : undefined,
      };
    });
  }, [persons, assignedPersonIds, mode, user?.personId]);

  const selectedPersonLabel = useMemo(() => {
    if (!values.personId) {
      return undefined;
    }

    if (mode === 'edit' && user?.personId === values.personId) {
      return `${user.person.firstName} ${user.person.lastName}`;
    }

    return personOptions.find((option) => option.id === values.personId)?.label;
  }, [values.personId, mode, user, personOptions]);

  function updateField(field: keyof UserFormValues, value: string | boolean) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (typeof value === 'boolean' || !current[field as keyof UserFormValues]) {
        return current;
      }
      const next = { ...current };
      delete next[field as keyof UserFormValues];
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
      const parsed = createUserSchema.safeParse({
        email: values.email,
        password: values.password,
        role: values.role,
        personId: values.personId,
        isActive: values.isActive,
      });

      if (!parsed.success) {
        setFieldErrors(mapZodFieldErrors(parsed.error));
        return;
      }

      setIsSubmitting(true);
      try {
        await createUser(parsed.data);
        showToast('Utilizator adăugat', 'success');
        onSaved();
        onClose();
      } catch (caught) {
        if (caught instanceof ApiError && (caught.status === 400 || caught.status === 409)) {
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

    if (!user) {
      return;
    }

    const payload = buildUpdatePayload(user, values);

    if (Object.keys(payload).length === 0) {
      showToast('Nicio modificare de salvat', 'success');
      onClose();
      return;
    }

    const parsed = updateUserSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(mapZodFieldErrors(parsed.error));
      return;
    }

    setIsSubmitting(true);
    try {
      const saved = await updateUser(user.id, parsed.data);
      showToast('Utilizator actualizat', 'success');
      onSaved(saved);
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 400 || caught.status === 409)) {
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
    if (!user || isBusy) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteUser(user.id);
      showToast('Utilizator șters', 'success');
      onSaved();
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) {
        setFormError(mapApiFormError(caught.message));
      } else {
        showToast(apiErrorToastMessage(caught), 'error');
      }
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }

  const footer = confirmDelete ? (
    <div role="alertdialog" aria-labelledby="user-delete-title">
      <p id="user-delete-title" className="text-sm text-text-secondary">
        Sigur ștergi acest utilizator?
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
        form="user-form"
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
      <form id="user-form" onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        <TextField
          id="email"
          label="E-mail"
          type="email"
          value={values.email}
          error={fieldErrors.email}
          disabled={isBusy}
          required
          onChange={(value) => updateField('email', value)}
        />

        <TextField
          id="password"
          label={mode === 'create' ? 'Parolă' : 'Parolă nouă (lasă gol pentru a păstra)'}
          type="password"
          autoComplete="new-password"
          value={values.password}
          error={fieldErrors.password}
          disabled={isBusy}
          required={mode === 'create'}
          onChange={(value) => updateField('password', value)}
        />

        <SelectField
          id="role"
          label="Rol"
          required
          value={values.role}
          disabled={isBusy}
          options={[
            { id: 'ADMIN', label: 'ADMIN' },
            { id: 'EMPLOYEE', label: 'EMPLOYEE' },
          ]}
          onChange={(value) => updateField('role', value as UserRole)}
        />

        <SearchableSelect
          id="personId"
          label="Persoană"
          required
          placeholder="Caută persoana…"
          emptyMessage="Nicio persoană găsită."
          value={values.personId || null}
          selectedLabel={selectedPersonLabel}
          options={personOptions}
          disabled={isBusy || personsLoading}
          error={fieldErrors.personId}
          onChange={(personId) => updateField('personId', personId ?? '')}
        />

        <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={values.isActive}
            disabled={isBusy}
            onChange={(event) => updateField('isActive', event.target.checked)}
            className="size-4 rounded border-border accent-accent"
          />
          Activ
        </label>

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
              <span>Șterge utilizatorul</span>
            </button>
          </div>
        )}
      </form>
    </SlideOverPanel>
  );
}

function getUserInitials(user: UserDto): string {
  return (user.person.firstName[0] + user.person.lastName[0]).toUpperCase();
}

export { getUserInitials };
