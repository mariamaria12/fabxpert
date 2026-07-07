'use client';

import {
  ApiError,
  createCompany,
  createCompanySchema,
  deleteCompany,
  updateCompany,
  updateCompanySchema,
  type CompanyDto,
} from '@fabxpert/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { ColorField } from '@/components/ColorField';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

interface CompanyFormValues {
  name: string;
  color: string | null;
  taxCode: string;
  tradeRegistryNumber: string;
  registeredAddress: string;
  phone: string;
  deliveryAddress: string;
  legalRepresentative: string;
  email: string;
  contactPerson: string;
  contactPersonPhone: string;
}

type CompanyTextField = Exclude<keyof CompanyFormValues, 'color'>;

type CompanyFormField = CompanyTextField;

const EMPTY_FORM: CompanyFormValues = {
  name: '',
  color: null,
  taxCode: '',
  tradeRegistryNumber: '',
  registeredAddress: '',
  phone: '',
  deliveryAddress: '',
  legalRepresentative: '',
  email: '',
  contactPerson: '',
  contactPersonPhone: '',
};

const FIELD_LABELS: Record<CompanyFormField, string> = {
  name: 'Denumire',
  taxCode: 'Cod fiscal',
  tradeRegistryNumber: 'Reg. com.',
  registeredAddress: 'Sediul',
  phone: 'Telefon',
  deliveryAddress: 'Adresa livrare',
  legalRepresentative: 'Reprezentant legal',
  email: 'E-mail',
  contactPerson: 'POC',
  contactPersonPhone: 'Tel POC',
};

const FIELD_ORDER: CompanyFormField[] = [
  'name',
  'taxCode',
  'tradeRegistryNumber',
  'registeredAddress',
  'phone',
  'deliveryAddress',
  'legalRepresentative',
  'email',
  'contactPerson',
  'contactPersonPhone',
];

function companyToFormValues(company: CompanyDto): CompanyFormValues {
  return {
    name: company.name,
    color: company.color,
    taxCode: company.taxCode ?? '',
    tradeRegistryNumber: company.tradeRegistryNumber ?? '',
    registeredAddress: company.registeredAddress ?? '',
    phone: company.phone ?? '',
    deliveryAddress: company.deliveryAddress ?? '',
    legalRepresentative: company.legalRepresentative ?? '',
    email: company.email ?? '',
    contactPerson: company.contactPerson ?? '',
    contactPersonPhone: company.contactPersonPhone ?? '',
  };
}

function mapZodFieldErrors(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }) {
  const flat = error.flatten().fieldErrors;
  const mapped: Partial<Record<CompanyFormField | 'color', string>> = {};

  for (const field of FIELD_ORDER) {
    const message = flat[field]?.[0];
    if (message) {
      mapped[field] = field === 'name' ? 'Denumirea este obligatorie.' : message;
    }
  }

  const colorMessage = flat.color?.[0];
  if (colorMessage) {
    mapped.color = 'Culoarea trebuie să fie un hex valid (#RRGGBB).';
  }

  return mapped;
}

function buildCreatePayload(values: CompanyFormValues) {
  const { color, ...rest } = values;
  return {
    ...rest,
    ...(color ? { color } : {}),
  };
}

function buildUpdatePayload(values: CompanyFormValues) {
  return { ...values };
}

const inputClassName =
  'w-full rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

interface FormFieldProps {
  id: CompanyFormField;
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  type?: 'text' | 'email';
  onChange: (value: string) => void;
}

function FormField({ id, label, value, error, disabled, type = 'text', onChange }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs text-text-secondary">
        {label}
        {id === 'name' && <span className="text-danger"> *</span>}
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

export interface CompanyFormPanelProps {
  open: boolean;
  mode: 'create' | 'edit';
  company: CompanyDto | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CompanyFormPanel({ open, mode, company, onClose, onSaved }: CompanyFormPanelProps) {
  const { showToast } = useToast();
  const [values, setValues] = useState<CompanyFormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CompanyFormField | 'color', string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [colorDraftInvalid, setColorDraftInvalid] = useState(false);

  const isBusy = isSubmitting || isDeleting;
  const title = mode === 'create' ? 'Companie nouă' : 'Editează compania';

  useEffect(() => {
    if (!open) {
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setConfirmDelete(false);
    setIsSubmitting(false);
    setIsDeleting(false);
    setValues(mode === 'edit' && company ? companyToFormValues(company) : EMPTY_FORM);
  }, [open, mode, company]);

  function updateField(field: CompanyFormField, value: string) {
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

    if (colorDraftInvalid) {
      setFieldErrors({ color: 'Culoarea trebuie să fie un hex valid (#RRGGBB).' });
      return;
    }

    if (mode === 'create') {
      const parsed = createCompanySchema.safeParse(buildCreatePayload(values));
      if (!parsed.success) {
        setFieldErrors(mapZodFieldErrors(parsed.error));
        return;
      }

      setIsSubmitting(true);
      try {
        await createCompany(parsed.data);
        showToast('Companie adăugată', 'success');
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

    if (!company) {
      return;
    }

    const parsed = updateCompanySchema.safeParse(buildUpdatePayload(values));
    if (!parsed.success) {
      setFieldErrors(mapZodFieldErrors(parsed.error));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateCompany(company.id, parsed.data);
      showToast('Companie actualizată', 'success');
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
    if (!company || isBusy) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteCompany(company.id);
      showToast('Companie ștearsă', 'success');
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
    <div role="alertdialog" aria-labelledby="company-delete-title">
      <p id="company-delete-title" className="text-sm text-text-secondary">
        Sigur ștergi această companie?
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
        form="company-form"
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
      <form id="company-form" onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        <FormField
          id="name"
          label={FIELD_LABELS.name}
          value={values.name}
          error={fieldErrors.name}
          disabled={isBusy}
          onChange={(value) => updateField('name', value)}
        />

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

        {FIELD_ORDER.filter((field) => field !== 'name').map((field) => (
          <FormField
            key={field}
            id={field}
            label={FIELD_LABELS[field]}
            value={values[field]}
            error={fieldErrors[field]}
            disabled={isBusy}
            type={field === 'email' ? 'email' : 'text'}
            onChange={(value) => updateField(field, value)}
          />
        ))}

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
              <span>Șterge compania</span>
            </button>
          </div>
        )}
      </form>
    </SlideOverPanel>
  );
}
