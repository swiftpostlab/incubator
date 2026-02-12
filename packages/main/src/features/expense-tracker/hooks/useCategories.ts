'use client';

import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDb, type CategoryRecord } from '../db/database';
import type { Categories } from '../types';

interface UseCategoriesReturn {
  categories: Categories;
  categoryList: CategoryRecord[];
  isLoading: boolean;
  error: Error | null;
  addCategory: (name: string, subcategories?: string[]) => Promise<void>;
  updateCategory: (
    id: number,
    name: string,
    subcategories: string[],
  ) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
  addSubcategory: (
    categoryName: string,
    subcategoryName: string,
  ) => Promise<void>;
  removeSubcategory: (
    categoryName: string,
    subcategoryName: string,
  ) => Promise<void>;
  getCategoryColor: (categoryName: string) => string;
}

// Category color mapping
const CATEGORY_COLORS: Record<string, string> = {
  Salary: '#10B981',
  Home: '#F59E0B',
  Groceries: '#EF4444',
  Transportation: '#3B82F6',
  Health: '#EC4899',
  Entertainment: '#8B5CF6',
  Clothing: '#F97316',
  Technology: '#06B6D4',
  Education: '#84CC16',
  Gifts: '#F43F5E',
  Taxes: '#6366F1',
  Investments: '#14B8A6',
  Other: '#6B7280',
};

const DEFAULT_COLOR = '#6B7280';

export const useCategories = (): UseCategoriesReturn => {
  const [error, setError] = useState<Error | null>(null);

  // Live query for category records
  const categoryRecords = useLiveQuery(
    async () => {
      try {
        const db = getDb();
        return db.categories.toArray();
      } catch {
        return [];
      }
    },
    [],
    [],
  );

  const isLoading = categoryRecords === undefined;

  // Convert records to Categories object
  const categories: Categories = {};
  if (categoryRecords) {
    categoryRecords.forEach((record: CategoryRecord) => {
      categories[record.name] = record.subcategories;
    });
  }

  const addCategory = useCallback(
    async (name: string, subcategories: string[] = ['Other']) => {
      try {
        const db = getDb();

        // Check if category already exists
        const existing = await db.categories.where('name').equals(name).first();
        if (existing) {
          throw new Error(`Category "${name}" already exists`);
        }

        await db.categories.add({ name, subcategories });
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to add category');
        setError(error);
        throw error;
      }
    },
    [],
  );

  const updateCategory = useCallback(
    async (id: number, name: string, subcategories: string[]) => {
      try {
        const db = getDb();
        await db.categories.update(id, { name, subcategories });
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to update category');
        setError(error);
        throw error;
      }
    },
    [],
  );

  const deleteCategory = useCallback(async (id: number) => {
    try {
      const db = getDb();
      await db.categories.delete(id);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to delete category');
      setError(error);
      throw error;
    }
  }, []);

  const addSubcategory = useCallback(
    async (categoryName: string, subcategoryName: string) => {
      try {
        const db = getDb();
        const record = await db.categories
          .where('name')
          .equals(categoryName)
          .first();

        if (!record) {
          throw new Error(`Category "${categoryName}" not found`);
        }

        if (record.subcategories.includes(subcategoryName)) {
          throw new Error(`Subcategory "${subcategoryName}" already exists`);
        }

        await db.categories.update(record.id, {
          subcategories: [...record.subcategories, subcategoryName],
        });
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to add subcategory');
        setError(error);
        throw error;
      }
    },
    [],
  );

  const removeSubcategory = useCallback(
    async (categoryName: string, subcategoryName: string) => {
      try {
        const db = getDb();
        const record = await db.categories
          .where('name')
          .equals(categoryName)
          .first();

        if (!record) {
          throw new Error(`Category "${categoryName}" not found`);
        }

        await db.categories.update(record.id, {
          subcategories: record.subcategories.filter(
            (s) => s !== subcategoryName,
          ),
        });
      } catch (err) {
        const error =
          err instanceof Error ? err : (
            new Error('Failed to remove subcategory')
          );
        setError(error);
        throw error;
      }
    },
    [],
  );

  const getCategoryColor = useCallback((categoryName: string): string => {
    return CATEGORY_COLORS[categoryName] ?? DEFAULT_COLOR;
  }, []);

  return {
    categories,
    categoryList: categoryRecords ?? [],
    isLoading,
    error,
    addCategory,
    updateCategory,
    deleteCategory,
    addSubcategory,
    removeSubcategory,
    getCategoryColor,
  };
};
