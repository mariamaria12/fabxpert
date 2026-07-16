'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthUser } from '@/context/AuthUserContext';
import {
  readColumnPrefs,
  writeColumnPrefs,
  type ColumnPreference,
} from '@/utils/columnStorage';

const WRITE_DEBOUNCE_MS = 300;

export function useColumnPreferences(
  viewId: string,
  defaultColumns: ColumnPreference[],
): {
  columns: ColumnPreference[];
  setColumnVisible: (columnId: string, visible: boolean) => void;
  setColumnWidth: (columnId: string, width: number) => void;
  resetColumns: () => void;
  flushPreferences: () => void;
} {
  const user = useAuthUser();
  const userId = user?.id ?? null;
  const timerRef = useRef<number | null>(null);
  const latestColumnsRef = useRef<ColumnPreference[]>(defaultColumns);

  const normalizedDefaults = useMemo(
    () =>
      defaultColumns.map((column, index) => ({
        id: column.id,
        visible: column.visible,
        width: Math.max(1, Math.round(column.width)),
        order: Number.isFinite(column.order) ? column.order : index,
      })),
    [defaultColumns],
  );

  const storageKey = userId ? `columns:${userId}:${viewId}` : null;
  const [columns, setColumns] = useState<ColumnPreference[]>(normalizedDefaults);

  useEffect(() => {
    latestColumnsRef.current = columns;
  }, [columns]);

  const clearPendingWrite = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flushPreferences = useCallback(() => {
    clearPendingWrite();
    if (!storageKey || typeof window === 'undefined') {
      return;
    }
    writeColumnPrefs(window.localStorage, storageKey, latestColumnsRef.current);
  }, [clearPendingWrite, storageKey]);

  const scheduleWrite = useCallback(() => {
    if (!storageKey || typeof window === 'undefined') {
      return;
    }

    clearPendingWrite();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      writeColumnPrefs(window.localStorage, storageKey, latestColumnsRef.current);
    }, WRITE_DEBOUNCE_MS);
  }, [clearPendingWrite, storageKey]);

  useEffect(() => {
    setColumns((current) => {
      const next =
        storageKey && typeof window !== 'undefined'
          ? readColumnPrefs(window.localStorage, storageKey, normalizedDefaults)
          : normalizedDefaults;

      const unchanged =
        current.length === next.length &&
        current.every(
          (column, index) =>
            column.id === next[index]?.id &&
            column.visible === next[index]?.visible &&
            column.width === next[index]?.width &&
            column.order === next[index]?.order,
        );

      return unchanged ? current : next;
    });
  }, [normalizedDefaults, storageKey]);

  useEffect(() => () => clearPendingWrite(), [clearPendingWrite]);

  const setColumnVisible = useCallback(
    (columnId: string, visible: boolean) => {
      setColumns((current) => {
        const visibleCount = current.filter((column) => column.visible).length;

        const next = current.map((column) => {
          if (column.id !== columnId) {
            return column;
          }

          if (!visible && column.visible && visibleCount <= 1) {
            return column;
          }

          return column.visible === visible ? column : { ...column, visible };
        });

        latestColumnsRef.current = next;
        return next;
      });

      scheduleWrite();
    },
    [scheduleWrite],
  );

  const setColumnWidth = useCallback(
    (columnId: string, width: number) => {
      const nextWidth = Math.max(1, Math.round(width));

      setColumns((current) => {
        const next = current.map((column) =>
          column.id === columnId && column.width !== nextWidth
            ? { ...column, width: nextWidth }
            : column,
        );
        latestColumnsRef.current = next;
        return next;
      });

      scheduleWrite();
    },
    [scheduleWrite],
  );

  const resetColumns = useCallback(() => {
    setColumns(normalizedDefaults);
    latestColumnsRef.current = normalizedDefaults;
    scheduleWrite();
  }, [normalizedDefaults, scheduleWrite]);

  return {
    columns,
    setColumnVisible,
    setColumnWidth,
    resetColumns,
    flushPreferences,
  };
}
