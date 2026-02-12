'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDb, initializeDatabase } from '../db/database';
import type {
  Transaction,
  GlobalFilter,
  UserSettings,
  Categories,
} from '../types';

interface ExpenseDataState {
  isInitialized: boolean;
  isLoading: boolean;
  error: Error | null;
  transactions: Transaction[];
  categories: Categories;
  tags: string[];
  globalFilter: GlobalFilter;
  settings: UserSettings;
}

interface ExpenseDataActions {
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  updateGlobalFilter: (filter: Partial<GlobalFilter>) => Promise<void>;
  clearError: () => void;
}

interface UseExpenseDataReturn extends ExpenseDataState {
  actions: ExpenseDataActions;
}

const defaultFilter: GlobalFilter = {
  enabled: false,
  startDate: undefined,
  endDate: undefined,
};

const defaultSettings: UserSettings = {
  locale: 'en',
  currency: 'EUR',
  savingsGoal: 20,
};

export const useExpenseData = (): UseExpenseDataReturn => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize database on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initializeDatabase();
        setIsInitialized(true);
      } catch (err) {
        setError(
          err instanceof Error ? err : (
            new Error('Failed to initialize database')
          ),
        );
      } finally {
        setIsLoading(false);
      }
    };

    void init();
  }, []);

  // Live query for transactions
  const transactions = useLiveQuery(
    async () => {
      if (!isInitialized) {
        return [];
      }
      try {
        const db = getDb();
        return await db.transactions.orderBy('date').reverse().toArray();
      } catch {
        return [];
      }
    },
    [isInitialized],
    [],
  );

  // Live query for categories
  const categoriesData = useLiveQuery(
    async () => {
      if (!isInitialized) {
        return {};
      }
      try {
        const db = getDb();
        const records = await db.categories.toArray();
        const cats: Categories = {};
        records.forEach((record) => {
          cats[record.name] = record.subcategories;
        });
        return cats;
      } catch {
        return {};
      }
    },
    [isInitialized],
    {},
  );

  // Live query for tags
  const tagsData = useLiveQuery(
    async () => {
      if (!isInitialized) {
        return [];
      }
      try {
        const db = getDb();
        const records = await db.tags.toArray();
        return records.map((t) => t.name);
      } catch {
        return [];
      }
    },
    [isInitialized],
    [],
  );

  // Live query for settings
  const settingsData = useLiveQuery(
    async () => {
      if (!isInitialized) {
        return null;
      }
      try {
        const db = getDb();
        return await db.settings.get('settings');
      } catch {
        return null;
      }
    },
    [isInitialized],
    null,
  );

  const updateSettings = useCallback(
    async (newSettings: Partial<UserSettings>) => {
      try {
        const db = getDb();
        const current = await db.settings.get('settings');
        if (current) {
          await db.settings.update('settings', {
            userSettings: { ...current.userSettings, ...newSettings },
          });
        }
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('Failed to update settings'),
        );
      }
    },
    [],
  );

  const updateGlobalFilter = useCallback(
    async (filter: Partial<GlobalFilter>) => {
      try {
        const db = getDb();
        const current = await db.settings.get('settings');
        if (current) {
          await db.settings.update('settings', {
            globalFilter: { ...current.globalFilter, ...filter },
          });
        }
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('Failed to update filter'),
        );
      }
    },
    [],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isInitialized,
    isLoading,
    error,
    transactions,
    categories: categoriesData,
    tags: tagsData,
    globalFilter: settingsData?.globalFilter ?? defaultFilter,
    settings: settingsData?.userSettings ?? defaultSettings,
    actions: {
      updateSettings,
      updateGlobalFilter,
      clearError,
    },
  };
};
