import { getDb } from '../db/database';
import type {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  GlobalFilter,
} from '../types';

// ============================================================================
// Transaction Service
// ============================================================================

export const transactionService = {
  /**
   * Get all transactions, optionally filtered by global filter
   */
  async getAll(filter?: GlobalFilter): Promise<Transaction[]> {
    const db = getDb();
    let collection = db.transactions.orderBy('date').reverse();

    if (filter?.enabled) {
      if (filter.startDate && filter.endDate) {
        collection = db.transactions
          .where('date')
          .between(filter.startDate, filter.endDate, true, true)
          .reverse();
      } else if (filter.startDate) {
        collection = db.transactions
          .where('date')
          .aboveOrEqual(filter.startDate)
          .reverse();
      } else if (filter.endDate) {
        collection = db.transactions
          .where('date')
          .belowOrEqual(filter.endDate)
          .reverse();
      }
    }

    return collection.toArray();
  },

  /**
   * Get transactions for a specific month
   */
  async getByMonth(yearMonth: string): Promise<Transaction[]> {
    const db = getDb();
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-31`; // Will work for all months

    return db.transactions
      .where('date')
      .between(startDate, endDate, true, true)
      .reverse()
      .toArray();
  },

  /**
   * Get transactions by category
   */
  async getByCategory(category: string): Promise<Transaction[]> {
    const db = getDb();
    return db.transactions
      .where('category')
      .equals(category)
      .reverse()
      .toArray();
  },

  /**
   * Get a single transaction by ID
   */
  async getById(id: number): Promise<Transaction | undefined> {
    const db = getDb();
    return db.transactions.get(id);
  },

  /**
   * Create a new transaction
   */
  async create(input: CreateTransactionInput): Promise<Transaction> {
    const db = getDb();
    const id = await db.transactions.add(input as Transaction);
    const transaction = await db.transactions.get(id);

    if (!transaction) {
      throw new Error('Failed to create transaction');
    }

    return transaction;
  },

  /**
   * Update an existing transaction
   */
  async update(input: UpdateTransactionInput): Promise<Transaction> {
    const db = getDb();
    const { id, ...updates } = input;

    await db.transactions.update(id, updates);
    const transaction = await db.transactions.get(id);

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return transaction;
  },

  /**
   * Delete a transaction
   */
  async delete(id: number): Promise<void> {
    const db = getDb();
    await db.transactions.delete(id);
  },

  /**
   * Bulk delete transactions
   */
  async bulkDelete(ids: number[]): Promise<void> {
    const db = getDb();
    await db.transactions.bulkDelete(ids);
  },

  /**
   * Bulk update transactions (e.g., change category)
   */
  async bulkUpdate(
    ids: number[],
    updates: Partial<Omit<Transaction, 'id'>>,
  ): Promise<void> {
    const db = getDb();
    await db.transaction('rw', db.transactions, async () => {
      for (const id of ids) {
        await db.transactions.update(id, updates);
      }
    });
  },

  /**
   * Get transaction statistics for a date range
   */
  async getStats(
    startDate: string,
    endDate: string,
  ): Promise<{
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    transactionCount: number;
  }> {
    const db = getDb();
    const transactions = await db.transactions
      .where('date')
      .between(startDate, endDate, true, true)
      .and((t) => t.track)
      .toArray();

    const stats = transactions.reduce(
      (acc, t) => {
        if (t.amount > 0) {
          acc.totalIncome += t.amount;
        } else {
          acc.totalExpenses += Math.abs(t.amount);
        }
        acc.transactionCount += 1;
        return acc;
      },
      { totalIncome: 0, totalExpenses: 0, transactionCount: 0 },
    );

    return {
      ...stats,
      netBalance: stats.totalIncome - stats.totalExpenses,
    };
  },

  /**
   * Get category-wise breakdown for a date range
   */
  async getCategoryBreakdown(
    startDate: string,
    endDate: string,
    type: 'income' | 'expense',
  ): Promise<Record<string, number>> {
    const db = getDb();
    const transactions = await db.transactions
      .where('date')
      .between(startDate, endDate, true, true)
      .and((t) => {
        if (!t.track) {
          return false;
        }
        return type === 'income' ? t.amount > 0 : t.amount < 0;
      })
      .toArray();

    return transactions.reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + Math.abs(t.amount);
      return acc;
    }, {});
  },

  /**
   * Get monthly totals for a year
   */
  async getMonthlyTotals(year: number): Promise<
    Array<{
      month: string;
      income: number;
      expenses: number;
    }>
  > {
    const db = getDb();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const transactions = await db.transactions
      .where('date')
      .between(startDate, endDate, true, true)
      .and((t) => t.track)
      .toArray();

    const monthlyMap = new Map<string, { income: number; expenses: number }>();

    // Initialize all months
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${year}-${String(m).padStart(2, '0')}`;
      monthlyMap.set(monthKey, { income: 0, expenses: 0 });
    }

    // Aggregate transactions
    for (const t of transactions) {
      const monthKey = t.date.substring(0, 7);
      const current = monthlyMap.get(monthKey);
      if (current) {
        if (t.amount > 0) {
          current.income += t.amount;
        } else {
          current.expenses += Math.abs(t.amount);
        }
      }
    }

    return Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));
  },

  /**
   * Search transactions by note content
   */
  async search(query: string): Promise<Transaction[]> {
    const db = getDb();
    const lowerQuery = query.toLowerCase();

    return db.transactions
      .filter(
        (t) =>
          t.note?.toLowerCase().includes(lowerQuery) ||
          t.category.toLowerCase().includes(lowerQuery) ||
          t.subcategory.toLowerCase().includes(lowerQuery) ||
          t.from.toLowerCase().includes(lowerQuery) ||
          t.to.toLowerCase().includes(lowerQuery),
      )
      .toArray();
  },
};
