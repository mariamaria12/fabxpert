'use client';

import {
  ApiError,
  createPoll,
  createPollSchema,
  updatePoll,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
  POLL_TITLE_MAX_LENGTH,
  type PollDto,
  type UpdatePollInput,
} from '@fabxpert/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { pollErrorMessage } from './pollErrors';
import { DateField } from '@/components/DateField';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { TextField } from '@/components/TextField';
import { FORM_FIELD_CLASS, FORM_LABEL_CLASS } from '@/components/formFieldStyles';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

interface PollFormValues {
  title: string;
  description: string;
  options: string[];
  allowMultiple: boolean;
  closesOn: string;
}

const EMPTY_FORM: PollFormValues = {
  title: '',
  description: '',
  options: ['', ''],
  allowMultiple: false,
  closesOn: '',
};

function pollToFormValues(poll: PollDto): PollFormValues {
  return {
    title: poll.title,
    description: poll.description ?? '',
    options: poll.options.map((option) => option.label),
    allowMultiple: poll.allowMultiple,
    closesOn: poll.closesOn ?? '',
  };
}

export interface PollFormPanelProps {
  open: boolean;
  mode: 'create' | 'edit';
  poll: PollDto | null;
  onClose: () => void;
  onSaved: (poll: PollDto) => void;
}

export function PollFormPanel({ open, mode, poll, onClose, onSaved }: PollFormPanelProps) {
  const { showToast } = useToast();
  const [values, setValues] = useState<PollFormValues>(EMPTY_FORM);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [optionsError, setOptionsError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Options stay frozen once people can answer — the API refuses to move them. */
  const optionsLocked = mode === 'edit' && poll !== null && poll.status !== 'DRAFT';

  useEffect(() => {
    if (!open) {
      return;
    }

    setTitleError(undefined);
    setOptionsError(undefined);
    setFormError(null);
    setIsSubmitting(false);
    setValues(mode === 'edit' && poll ? pollToFormValues(poll) : EMPTY_FORM);
  }, [open, mode, poll]);

  function updateOption(index: number, label: string) {
    setValues((current) => ({
      ...current,
      options: current.options.map((option, position) => (position === index ? label : option)),
    }));
    setOptionsError(undefined);
    setFormError(null);
  }

  function addOption() {
    setValues((current) =>
      current.options.length >= POLL_MAX_OPTIONS
        ? current
        : { ...current, options: [...current.options, ''] },
    );
    setOptionsError(undefined);
  }

  function removeOption(index: number) {
    setValues((current) =>
      current.options.length <= POLL_MIN_OPTIONS
        ? current
        : { ...current, options: current.options.filter((_option, position) => position !== index) },
    );
    setOptionsError(undefined);
  }

  function moveOption(index: number, direction: -1 | 1) {
    const target = index + direction;
    setValues((current) => {
      if (target < 0 || target >= current.options.length) {
        return current;
      }
      const options = [...current.options];
      [options[index], options[target]] = [options[target], options[index]];
      return { ...current, options };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setTitleError(undefined);
    setOptionsError(undefined);
    setFormError(null);

    const payload = {
      title: values.title,
      ...(values.description.trim() ? { description: values.description } : {}),
      options: values.options.map((option) => option.trim()).filter((option) => option.length > 0),
      allowMultiple: values.allowMultiple,
      ...(values.closesOn ? { closesOn: values.closesOn } : { closesOn: null }),
    };

    const parsed = createPollSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      if (fieldErrors.title?.[0]) {
        setTitleError('Întrebarea este obligatorie.');
      }
      if (fieldErrors.options?.[0]) {
        setOptionsError(
          payload.options.length < POLL_MIN_OPTIONS
            ? `Sondajul are nevoie de cel puțin ${POLL_MIN_OPTIONS} opțiuni.`
            : 'Opțiunile trebuie să fie diferite între ele.',
        );
      }
      return;
    }

    setIsSubmitting(true);
    try {
      // An empty description is sent as '' — the API stores that as "no description".
      const editPayload: UpdatePollInput = {
        title: parsed.data.title,
        description: parsed.data.description ?? '',
        closesOn: parsed.data.closesOn ?? null,
        ...(optionsLocked
          ? {}
          : { options: parsed.data.options, allowMultiple: parsed.data.allowMultiple }),
      };

      const saved =
        mode === 'create'
          ? await createPoll(parsed.data)
          : await updatePoll(poll?.id ?? '', editPayload);

      showToast(mode === 'create' ? 'Sondaj salvat ca ciornă' : 'Sondaj actualizat', 'success');
      onSaved(saved);
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 400 || caught.status === 409)) {
        setFormError(pollErrorMessage(caught));
      } else {
        showToast(apiErrorToastMessage(caught), 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const footer = (
    <div className="flex gap-2">
      <button
        type="submit"
        form="poll-form"
        disabled={isSubmitting}
        className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Se salvează…' : mode === 'create' ? 'Salvează ciorna' : 'Salvează'}
      </button>
      <button
        type="button"
        disabled={isSubmitting}
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
      title={mode === 'create' ? 'Sondaj nou' : 'Editează sondajul'}
      onClose={onClose}
      disableClose={isSubmitting}
      footer={footer}
      widthClassName="max-w-lg"
    >
      <form
        id="poll-form"
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-4"
      >
        <TextField
          id="poll-title"
          label="Întrebare"
          placeholder="Ex.: Schimbare oră începere lucru"
          value={values.title}
          error={titleError}
          disabled={isSubmitting}
          required
          maxLength={POLL_TITLE_MAX_LENGTH}
          onChange={(value) => {
            setValues((current) => ({ ...current, title: value }));
            setTitleError(undefined);
            setFormError(null);
          }}
        />

        <div>
          <label htmlFor="poll-description" className={FORM_LABEL_CLASS}>
            Detalii (opțional)
          </label>
          <textarea
            id="poll-description"
            rows={3}
            value={values.description}
            disabled={isSubmitting}
            placeholder="Context scurt pentru echipă"
            onChange={(event) =>
              setValues((current) => ({ ...current, description: event.target.value }))
            }
            className={`${FORM_FIELD_CLASS} resize-y`}
          />
        </div>

        <div>
          <span className={FORM_LABEL_CLASS}>
            Opțiuni<span className="text-danger"> *</span>
          </span>

          {optionsLocked && (
            <p className="mb-2 text-xs text-text-muted">
              Sondajul e publicat — opțiunile rămân fixe ca să nu se piardă răspunsurile.
            </p>
          )}

          <div className="flex flex-col gap-2">
            {values.options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={option}
                  disabled={isSubmitting || optionsLocked}
                  maxLength={POLL_OPTION_MAX_LENGTH}
                  placeholder={`Opțiunea ${index + 1}`}
                  aria-label={`Opțiunea ${index + 1}`}
                  onChange={(event) => updateOption(index, event.target.value)}
                  className={FORM_FIELD_CLASS}
                />
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    aria-label={`Mută opțiunea ${index + 1} mai sus`}
                    disabled={isSubmitting || optionsLocked || index === 0}
                    onClick={() => moveOption(index, -1)}
                    className="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <i className="ti ti-chevron-up text-base" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Mută opțiunea ${index + 1} mai jos`}
                    disabled={
                      isSubmitting || optionsLocked || index === values.options.length - 1
                    }
                    onClick={() => moveOption(index, 1)}
                    className="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <i className="ti ti-chevron-down text-base" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Șterge opțiunea ${index + 1}`}
                    disabled={
                      isSubmitting || optionsLocked || values.options.length <= POLL_MIN_OPTIONS
                    }
                    onClick={() => removeOption(index)}
                    className="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-raised hover:text-danger disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <i className="ti ti-trash text-base" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!optionsLocked && values.options.length < POLL_MAX_OPTIONS && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={addOption}
              className="mt-2 inline-flex items-center gap-2 text-sm text-accent transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <i className="ti ti-plus text-base" aria-hidden="true" />
              Adaugă opțiune
            </button>
          )}

          {optionsError && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {optionsError}
            </p>
          )}
        </div>

        <label className="inline-flex items-start gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={values.allowMultiple}
            disabled={isSubmitting || optionsLocked}
            onChange={(event) =>
              setValues((current) => ({ ...current, allowMultiple: event.target.checked }))
            }
            className="mt-0.5 size-4 rounded border-border accent-accent"
          />
          <span>
            Permite mai multe răspunsuri
            <span className="mt-0.5 block text-xs text-text-muted">
              Fiecare poate bifa mai multe opțiuni, nu doar una.
            </span>
          </span>
        </label>

        <DateField
          id="poll-closes-on"
          label="Se închide pe (opțional)"
          value={values.closesOn}
          disabled={isSubmitting}
          onChange={(isoValue) => setValues((current) => ({ ...current, closesOn: isoValue }))}
        />

        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}
      </form>
    </SlideOverPanel>
  );
}
