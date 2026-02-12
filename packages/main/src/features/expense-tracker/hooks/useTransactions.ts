'use client';

import { useState, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '../db/database';
import { transactionService } from '../services/transactionService';
import type {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  GlobalFilter,
  TransactionType,
} from '../types';

interface TransactionFilters {
  category?: string;
  subcategory?: string;
  tag?: string;
  search?: string;
  type?: TransactionType;
  yearMonth?: string;
}

interface UseTransactionsOptions {
  globalFilter?: GlobalFilter;
  localFilters?: TransactionFilters;
  pageSize?: number;
}

interface UseTransactionsReturn {
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  isLoading: boolean;
  error: Error | null;
  page: number;
  totalPages: number;
  paginatedTransactions: Transaction[];
  addTransaction: (input: CreateTransactionInput) => Promise<Transaction>;
  updateTransaction: (input: UpdateTransactionInput) => Promise<Transaction>;
  deleteTransaction: (id: number) => Promise<void>;
  bulkDelete: (ids: number[]) => Promise<void>;
  setPage: (page: number) => void;
  setFilters: (filters: TransactionFilters) => void;
  clearFilters: () => void;
}

const getTransactionType = (tx: Transaction): TransactionType => {
  if (
    tx.category === 'Salary' ||
    tx.category === 'Stipendio' ||
    tx.amount > 0
  ) {
    return 'income';
  }
  if (tx.from && tx.to && tx.from !== '' && tx.to !== '') {
    return 'transfer';
  }
  return 'expense';
};

export const useTransactions = (
  options: UseTransactionsOptions = {},
): UseTransactionsReturn => {
  const { globalFilter, localFilters: initialFilters, pageSize = 20 } = options;

  const [page, setPage] = useState(1);
  const [filters, setFiltersState] = useState<TransactionFilters>(
    initialFilters ?? {},
  );
  const [error, setError] = useState<Error | null>(null);

  // Live query for all transactions
  const transactions = useLiveQuery(
    async () => {
      try {
        return await transactionService.getAll(globalFilter);
      } catch {
        return [];
      }
    },
    [globalFilter?.enabled, globalFilter?.startDate, globalFilter?.endDate],
    [],
  );

  const isLoading = transactions === undefined;

  // Filter transactions based on local filters
  const filteredTransactions = useMemo(() => {
    if (!transactions) {
      return [];
    }

    let result = [...transactions];

    if (filters.category) {
      result = result.filter((tx) => tx.category === filters.category);
    }

    if (filters.subcategory) {
      result = result.filter((tx) => tx.subcategory === filters.subcategory);
    }

    if (filters.tag) {
      result = result.filter((tx) => tx.tag === filters.tag);
    }

    if (filters.type) {
      result = result.filter((tx) => getTransactionType(tx) === filters.type);
    }

    if (filters.yearMonth) {
      result = result.filter((tx) => tx.date.startsWith(filters.yearMonth!));
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (tx) =>
          tx.category.toLowerCase().includes(searchLower) ||
          tx.subcategory.toLowerCase().includes(searchLower) ||
          tx.note?.toLowerCase().includes(searchLower) ||
          tx.from.toLowerCase().includes(searchLower) ||
          tx.to.toLowerCase().includes(searchLower),
      );
    }

    return result;
  }, [transactions, filters]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / pageSize);
  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, page, pageSize]);

  // Reset page when filters change
  const setFilters = useCallback((newFilters: TransactionFilters) => {
    setFiltersState(newFilters);
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState({});
    setPage(1);
  }, []);

  const addTransaction = useCallback(async (input: CreateTransactionInput) => {
    try {
      return await transactionService.create(input);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to add transaction');
      setError(error);
      throw error;
    }
  }, []);

  const updateTransaction = useCallback(
    async (input: UpdateTransactionInput) => {
      try {
        return await transactionService.update(input);
      } catch (err) {
        const error =
          err instanceof Error ? err : (
            new Error('Failed to update transaction')
          );
        setError(error);
        throw error;
      }
    },
    [],
  );

  const deleteTransaction = useCallback(async (id: number) => {
    try {
      await transactionService.delete(id);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to delete transaction');
      setError(error);
      throw error;
    }
  }, []);

  const bulkDelete = useCallback(async (ids: number[]) => {
    try {
      const db = getDb();
      await db.transactions.bulkDelete(ids);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to bulk delete');
      setError(error);
      throw error;
    }
  }, []);

  return {
    transactions: transactions ?? [],
    filteredTransactions,
    isLoading,
    error,
    page,
    totalPages,
    paginatedTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    bulkDelete,
    setPage,
    setFilters,
    clearFilters,
  };
};
