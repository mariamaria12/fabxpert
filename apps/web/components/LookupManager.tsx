'use client';

import { ApiError } from '@fabxpert/shared';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ColorField } from '@/components/ColorField';
import { compareStableLookupOrder } from '@/components/roleColors';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

export interface LookupItemBase {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface LookupItemWithColor extends LookupItemBase {
  color: string | null;
}

export type LookupItem = LookupItemBase | LookupItemWithColor;

interface InlineFormValues {
  name: string;
  isActive: boolean;
  color: string | null;
}

const EMPTY_FORM: InlineFormValues = {
  name: '',
  isActive: true,
  color: null,
};

export interface LookupManagerCopy {
  addLabel: string;
  namePlaceholder: string;
  activeLabel: string;
  saveLabel: string;
  cancelLabel: string;
  formatDeleteConfirm: (name: string) => string;
  deleteYes: string;
  deleteNo: string;
  createdToast: string;
  updatedToast: string;
  deletedToast: string;
  duplicateNameError: string;
  nameRequiredError: string;
}

export interface LookupManagerProps<TItem extends LookupItem, TCreate, TUpdate> {
  hasColor: boolean;
  listItems: (includeInactive: true) => Promise<TItem[]>;
  createItem: (input: TCreate) => Promise<TItem>;
  updateItem: (id: string, input: TUpdate) => Promise<TItem>;
  deleteItem: (id: string) => Promise<void>;
  createSchema: {
    safeParse: (
      input: unknown,
    ) => { success: true; data: TCreate } | { success: false; error: unknown };
  };
  updateSchema: {
    safeParse: (
      input: unknown,
    ) => { success: true; data: TUpdate } | { success: false; error: unknown };
  };
  buildCreateInput: (values: InlineFormValues) => TCreate;
  buildUpdateInput: (values: InlineFormValues) => TUpdate;
  copy: LookupManagerCopy;
  /** When false, data is not fetched (lazy tab activation). */
  active: boolean;
  /** Return a dot color to render, or null to omit the dot. */
  getDotColor?: (item: TItem, stableIndex: number) => string | null;
}

const inputClassName =
  'w-full rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

type ColumnSide = 'left' | 'right';

function getItemColor(item: LookupItem): string | null {
  return 'color' in item ? item.color : null;
}

function mapDuplicateError(message: string, copy: LookupManagerCopy): string {
  const lower = message.toLowerCase();
  if (lower.includes('already exists')) {
    return copy.duplicateNameError;
  }
  return message;
}

function sortLookupItems<T extends LookupItem>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }
    return left.name.localeCompare(right.name, 'ro');
  });
}

function assignInitialColumns<T extends LookupItem>(items: T[]): Map<string, ColumnSide> {
  const stable = [...items].sort(compareStableLookupOrder);
  const midpoint = Math.ceil(stable.length / 2);
  const map = new Map<string, ColumnSide>();

  stable.forEach((item, index) => {
    map.set(item.id, index < midpoint ? 'left' : 'right');
  });

  return map;
}

function mergeColumnAssignments<T extends LookupItem>(
  items: T[],
  previous: Map<string, ColumnSide>,
): Map<string, ColumnSide> {
  const next = new Map<string, ColumnSide>();
  const stable = [...items].sort(compareStableLookupOrder);
  const midpoint = Math.ceil(stable.length / 2);

  for (const item of items) {
    const existing = previous.get(item.id);
    if (existing) {
      next.set(item.id, existing);
      continue;
    }

    const stableIndex = stable.findIndex((entry) => entry.id === item.id);
    next.set(item.id, stableIndex < midpoint ? 'left' : 'right');
  }

  return next;
}

export function LookupManager<TItem extends LookupItem, TCreate, TUpdate>({
  hasColor,
  listItems,
  createItem,
  updateItem,
  deleteItem,
  createSchema,
  updateSchema,
  buildCreateInput,
  buildUpdateInput,
  copy,
  active,
  getDotColor,
}: LookupManagerProps<TItem, TCreate, TUpdate>) {
  const { showToast } = useToast();
  const [items, setItems] = useState<TItem[]>([]);
  const [columnById, setColumnById] = useState<Map<string, ColumnSide>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<InlineFormValues>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [colorDraftInvalid, setColorDraftInvalid] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await listItems(true);
      setItems(data);
      setColumnById((previous) => {
        if (previous.size === 0) {
          return assignInitialColumns(data);
        }
        return mergeColumnAssignments(data, previous);
      });
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [listItems]);

  useEffect(() => {
    if (active) {
      void loadItems();
    }
  }, [active, loadItems]);

  const stableIndexById = useMemo(() => {
    const stable = [...items].sort(compareStableLookupOrder);
    const map = new Map<string, number>();
    stable.forEach((item, index) => {
      map.set(item.id, index);
    });
    return map;
  }, [items]);

  function closeEditor() {
    setEditorMode('closed');
    setEditingId(null);
    setFormValues(EMPTY_FORM);
    setFormError(null);
    setColorDraftInvalid(false);
  }

  function openCreateEditor() {
    setConfirmDeleteId(null);
    setEditorMode('create');
    setEditingId(null);
    setFormValues(EMPTY_FORM);
    setFormError(null);
    setColorDraftInvalid(false);
  }

  function openEditEditor(item: TItem) {
    setConfirmDeleteId(null);
    setEditorMode('edit');
    setEditingId(item.id);
    setFormValues({
      name: item.name,
      isActive: item.isActive,
      color: getItemColor(item),
    });
    setFormError(null);
    setColorDraftInvalid(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || colorDraftInvalid) {
      return;
    }

    const trimmedName = formValues.name.trim();
    if (!trimmedName) {
      setFormError(copy.nameRequiredError);
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      if (editorMode === 'create') {
        const parsed = createSchema.safeParse(buildCreateInput(formValues));
        if (!parsed.success) {
          setFormError(copy.nameRequiredError);
          return;
        }
        await createItem(parsed.data);
        showToast(copy.createdToast, 'success');
      } else if (editorMode === 'edit' && editingId) {
        const parsed = updateSchema.safeParse(buildUpdateInput(formValues));
        if (!parsed.success) {
          setFormError(copy.nameRequiredError);
          return;
        }
        await updateItem(editingId, parsed.data);
        showToast(copy.updatedToast, 'success');
      }

      closeEditor();
      await loadItems();
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 409 || caught.status === 400)) {
        setFormError(mapDuplicateError(caught.message, copy));
      } else {
        showToast(apiErrorToastMessage(caught), 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteItem(id);
      showToast(copy.deletedToast, 'success');
      setConfirmDeleteId(null);
      if (editingId === id) {
        closeEditor();
      }
      setItems((current) => current.filter((item) => item.id !== id));
      setColumnById((current) => {
        const next = new Map(current);
        next.delete(id);
        return next;
      });
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setIsDeleting(false);
    }
  }

  function renderInlineForm() {
    return (
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex w-full min-w-[16rem] max-w-xl flex-col gap-3 rounded-lg border border-accent/30 bg-surface-raised p-3"
      >
        <input
          type="text"
          value={formValues.name}
          disabled={isSubmitting}
          placeholder={copy.namePlaceholder}
          onChange={(event) => {
            setFormValues((current) => ({ ...current, name: event.target.value }));
            setFormError(null);
          }}
          className={inputClassName}
          autoFocus
        />

        {hasColor && (
          <ColorField
            id={`lookup-color-${editingId ?? 'new'}`}
            value={formValues.color}
            disabled={isSubmitting}
            onChange={(color) => setFormValues((current) => ({ ...current, color }))}
            onDraftInvalidChange={setColorDraftInvalid}
          />
        )}

        <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={formValues.isActive}
            disabled={isSubmitting}
            onChange={(event) =>
              setFormValues((current) => ({ ...current, isActive: event.target.checked }))
            }
            className="size-4 rounded border-border accent-accent"
          />
          {copy.activeLabel}
        </label>

        {formError && (
          <p role="alert" className="text-xs text-danger">
            {formError}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting || colorDraftInvalid}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast disabled:cursor-not-allowed disabled:opacity-60"
          >
            {copy.saveLabel}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={closeEditor}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.cancelLabel}
          </button>
        </div>
      </form>
    );
  }

  function renderItemRow(item: TItem) {
    const isEditingThis = editorMode === 'edit' && editingId === item.id;
    const isConfirmingDelete = confirmDeleteId === item.id;
    const stableIndex = stableIndexById.get(item.id) ?? 0;
    const dotColor = getDotColor?.(item, stableIndex) ?? null;

    if (isEditingThis) {
      return (
        <div key={item.id} className="border-b border-border-subtle py-3">
          {renderInlineForm()}
        </div>
      );
    }

    if (isConfirmingDelete) {
      return (
        <div
          key={item.id}
          className="flex items-center gap-2 border-b border-border-subtle py-2.5 text-sm"
        >
          <span className="min-w-0 flex-1 text-text-secondary">
            {copy.formatDeleteConfirm(item.name)}
          </span>
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => void handleDelete(item.id)}
            className="font-medium text-danger hover:opacity-80 disabled:opacity-50"
          >
            {copy.deleteYes}
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => setConfirmDeleteId(null)}
            className="text-text-secondary hover:text-text-primary disabled:opacity-50"
          >
            {copy.deleteNo}
          </button>
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className={`group flex items-center gap-2.5 border-b border-border-subtle py-2.5 transition-opacity${
          item.isActive ? '' : ' opacity-[0.55]'
        }`}
      >
        {dotColor && (
          <span
            className="size-[11px] shrink-0 rounded-full"
            style={{ background: dotColor }}
            aria-hidden="true"
          />
        )}

        <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">{item.name}</span>

        {!item.isActive && (
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-text-muted">
            inactiv
          </span>
        )}

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label="Editează"
            disabled={editorMode !== 'closed'}
            onClick={() => openEditEditor(item)}
            className="rounded p-1 text-text-muted opacity-70 transition-all hover:bg-surface-raised hover:text-text-primary group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <i className="ti ti-pencil text-sm" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Șterge"
            disabled={editorMode !== 'closed'}
            onClick={() => setConfirmDeleteId(item.id)}
            className="rounded p-1 text-text-muted opacity-70 transition-all hover:bg-surface-raised hover:text-danger group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <i className="ti ti-trash text-sm" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  const sortedItems = useMemo(() => sortLookupItems(items), [items]);

  const leftColumnItems = useMemo(
    () => sortedItems.filter((item) => columnById.get(item.id) === 'left'),
    [sortedItems, columnById],
  );

  const rightColumnItems = useMemo(
    () => sortedItems.filter((item) => columnById.get(item.id) === 'right'),
    [sortedItems, columnById],
  );

  if (!active) {
    return null;
  }

  return (
    <div>
      {error && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void loadItems()}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
        </div>
      )}

      {loading && items.length === 0 ? (
        <p className="text-sm text-text-muted">Se încarcă…</p>
      ) : (
        <div className="w-full max-w-[70%]">
          <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
            <div>{leftColumnItems.map((item) => renderItemRow(item))}</div>
            <div>{rightColumnItems.map((item) => renderItemRow(item))}</div>
          </div>

          <div className="mt-4">
            {editorMode === 'create' ? (
              <div className="max-w-xl">{renderInlineForm()}</div>
            ) : (
              <button
                type="button"
                disabled={editorMode !== 'closed'}
                onClick={openCreateEditor}
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm text-text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <i className="ti ti-plus text-sm" aria-hidden="true" />
                {copy.addLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
