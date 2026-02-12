'use client';

import { useMemo } from 'react';
import type { Transaction, MonthlyStats, CategoryStats } from '../types';

interface UseStatsOptions {
  transactions: Transaction[];
  yearMonth?: string; // If provided, calculate stats for specific month
}

interface UseStatsReturn {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savingsRate: number;
  monthlyStats: MonthlyStats[];
  categoryStats: CategoryStats[];
  topCategories: CategoryStats[];
  transactionCount: number;
  averageTransaction: number;
}

const getCurrentYearMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const useStats = ({
  transactions,
  yearMonth,
}: UseStatsOptions): UseStatsReturn => {
  // Filter transactions for the specified month
  const monthTransactions = useMemo(() => {
    const targetMonth = yearMonth ?? getCurrentYearMonth();
    return transactions.filter(
      (tx) => tx.date.startsWith(targetMonth) && tx.track,
    );
  }, [transactions, yearMonth]);

  // Calculate totals for the month
  const { totalIncome, totalExpenses } = useMemo(() => {
    let income = 0;
    let expenses = 0;

    monthTransactions.forEach((tx) => {
      if (tx.amount > 0) {
        income += tx.amount;
      } else {
        expenses += Math.abs(tx.amount);
      }
    });

    return { totalIncome: income, totalExpenses: expenses };
  }, [monthTransactions]);

  const balance = totalIncome - totalExpenses;
  const savingsRate =
    totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  // Calculate monthly stats (last 12 months)
  const monthlyStats = useMemo(() => {
    const statsMap = new Map<string, { income: number; expenses: number }>();

    // Initialize last 12 months
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      statsMap.set(month, { income: 0, expenses: 0 });
    }

    // Aggregate transactions
    transactions
      .filter((tx) => tx.track)
      .forEach((tx) => {
        const month = tx.date.substring(0, 7);
        const current = statsMap.get(month);
        if (current) {
          if (tx.amount > 0) {
            current.income += tx.amount;
          } else {
            current.expenses += Math.abs(tx.amount);
          }
        }
      });

    // Convert to array
    return Array.from(statsMap.entries())
      .map(([month, { income, expenses }]) => ({
        month,
        income,
        expenses,
        savings: income - expenses,
        savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [transactions]);

  // Calculate category stats for the month
  const categoryStats = useMemo(() => {
    const statsMap = new Map<
      string,
      {
        subcategories: Map<string, { amount: number; count: number }>;
        totalAmount: number;
        totalCount: number;
      }
    >();

    // Only count expenses
    monthTransactions
      .filter((tx) => tx.amount < 0)
      .forEach((tx) => {
        const amount = Math.abs(tx.amount);
        let categoryData = statsMap.get(tx.category);

        if (!categoryData) {
          categoryData = {
            subcategories: new Map(),
            totalAmount: 0,
            totalCount: 0,
          };
          statsMap.set(tx.category, categoryData);
        }

        categoryData.totalAmount += amount;
        categoryData.totalCount += 1;

        const subData = categoryData.subcategories.get(tx.subcategory) ?? {
          amount: 0,
          count: 0,
        };
        subData.amount += amount;
        subData.count += 1;
        categoryData.subcategories.set(tx.subcategory, subData);
      });

    // Convert to array and calculate percentages
    const totalCategoryExpenses = Array.from(statsMap.values()).reduce(
      (sum, cat) => sum + cat.totalAmount,
      0,
    );

    return Array.from(statsMap.entries())
      .map(([category, data]) => ({
        category,
        subcategories: Array.from(data.subcategories.entries()).map(
          ([name, subData]) => ({
            name,
            amount: subData.amount,
            count: subData.count,
          }),
        ),
        totalAmount: data.totalAmount,
        totalCount: data.totalCount,
        percentage:
          totalCategoryExpenses > 0 ?
            (data.totalAmount / totalCategoryExpenses) * 100
          : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [monthTransactions]);

  // Top 5 categories
  const topCategories = categoryStats.slice(0, 5);

  // Transaction count and average
  const transactionCount = monthTransactions.length;
  const averageTransaction =
    transactionCount > 0 ?
      totalExpenses / monthTransactions.filter((tx) => tx.amount < 0).length
    : 0;

  return {
    totalIncome,
    totalExpenses,
    balance,
    savingsRate,
    monthlyStats,
    categoryStats,
    topCategories,
    transactionCount,
    averageTransaction: isNaN(averageTransaction) ? 0 : averageTransaction,
  };
};
