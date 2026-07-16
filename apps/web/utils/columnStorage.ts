export const COLUMN_PREFERENCES_VERSION = 1;

export interface ColumnPreference {
  id: string;
  visible: boolean;
  width: number;
  order: number;
}

export interface StoredColumnPreference {
  visible: boolean;
  width: number;
  order: number;
}

export interface StoredColumnPreferencesV1 {
  v: 1;
  columns: Record<string, StoredColumnPreference>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function clampWidth(width: number): number {
  return Number.isFinite(width) ? Math.max(1, Math.round(width)) : 1;
}

function normalizeDefaults(defaultColumns: ColumnPreference[]): ColumnPreference[] {
  return defaultColumns.map((column, index) => ({
    id: column.id,
    visible: column.visible,
    width: clampWidth(column.width),
    order: Number.isFinite(column.order) ? column.order : index,
  }));
}

function isStoredColumnPreference(value: unknown): value is StoredColumnPreference {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<StoredColumnPreference>;
  return (
    typeof candidate.visible === 'boolean' &&
    typeof candidate.width === 'number' &&
    typeof candidate.order === 'number'
  );
}

export function mergeWithDefaults(
  defaultColumns: ColumnPreference[],
  stored: unknown,
): ColumnPreference[] {
  const normalizedDefaults = normalizeDefaults(defaultColumns);

  if (!stored || typeof stored !== 'object') {
    return normalizedDefaults;
  }

  const parsed = stored as Partial<StoredColumnPreferencesV1>;
  if (parsed.v !== COLUMN_PREFERENCES_VERSION || !parsed.columns || typeof parsed.columns !== 'object') {
    return normalizedDefaults;
  }

  return normalizedDefaults
    .map((column, index) => {
      const storedColumn = parsed.columns?.[column.id];
      if (!isStoredColumnPreference(storedColumn)) {
        return { ...column, order: index };
      }

      return {
        id: column.id,
        visible: storedColumn.visible,
        width: clampWidth(storedColumn.width),
        order: Number.isFinite(storedColumn.order) ? storedColumn.order : index,
      };
    })
    .sort((left, right) => {
      if (left.order === right.order) {
        return left.id.localeCompare(right.id);
      }
      return left.order - right.order;
    })
    .map((column, index) => ({ ...column, order: index }));
}

export function readColumnPrefs(
  storage: StorageLike | null | undefined,
  storageKey: string,
  defaultColumns: ColumnPreference[],
): ColumnPreference[] {
  if (!storage) {
    return normalizeDefaults(defaultColumns);
  }

  try {
    const raw = storage.getItem(storageKey);
    if (!raw) {
      return normalizeDefaults(defaultColumns);
    }

    const parsed = JSON.parse(raw) as unknown;
    return mergeWithDefaults(defaultColumns, parsed);
  } catch {
    return normalizeDefaults(defaultColumns);
  }
}

export function writeColumnPrefs(
  storage: StorageLike | null | undefined,
  storageKey: string,
  columns: ColumnPreference[],
): void {
  if (!storage) {
    return;
  }

  const payload: StoredColumnPreferencesV1 = {
    v: COLUMN_PREFERENCES_VERSION,
    columns: Object.fromEntries(
      columns.map((column, index) => [
        column.id,
        {
          visible: column.visible,
          width: clampWidth(column.width),
          order: Number.isFinite(column.order) ? column.order : index,
        },
      ]),
    ),
  };

  try {
    storage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // Silently ignore storage failures and keep UI state only in memory.
  }
}
