'use client';

import { memo, useMemo } from 'react';
import Box from '@swiftpost/elysium/ui/base/Box';
import Stack from '@swiftpost/elysium/ui/base/Stack';
import Text from '@swiftpost/elysium/ui/base/Text';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SavingsIcon from '@mui/icons-material/Savings';
import {
  formatCurrency,
  formatDate,
} from '@/features/expense-tracker/utils/formatters';
import StatCard from '@/components/expense-tracker/StatCard';
import type {
  Transaction,
  Categories,
  UserSettings,
  MonthlyStats,
  CategoryStats,
} from '@/features/expense-tracker/types';

interface Stats {
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

interface Props {
  stats: Stats;
  transactions: Transaction[];
  categories: Categories;
  settings: UserSettings;
  getCategoryColor: (category: string) => string;
}

const Dashboard: React.FC<Props> = ({
  stats,
  transactions,
  settings,
  getCategoryColor,
}) => {
  // Recent transactions (last 5)
  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 5);
  }, [transactions]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Text variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Dashboard
        </Text>
        <Text variant="body2" color="text.secondary">
          Overview of your financial status
        </Text>
      </Box>

      {/* Stats Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
          gap: 3,
          mb: 4,
        }}
      >
        <StatCard
          title="Total Income"
          value={formatCurrency(stats.totalIncome, settings.currency)}
          icon={<TrendingUpIcon />}
          color="success.main"
          trend={stats.totalIncome > 0 ? 'up' : undefined}
        />
        <StatCard
          title="Total Expenses"
          value={formatCurrency(stats.totalExpenses, settings.currency)}
          icon={<TrendingDownIcon />}
          color="error.main"
          trend={stats.totalExpenses > 0 ? 'down' : undefined}
        />
        <StatCard
          title="Balance"
          value={formatCurrency(stats.balance, settings.currency)}
          icon={<AccountBalanceIcon />}
          color={stats.balance >= 0 ? 'success.main' : 'error.main'}
        />
        <StatCard
          title="Savings Rate"
          value={`${stats.savingsRate.toFixed(1)}%`}
          icon={<SavingsIcon />}
          color={
            stats.savingsRate >= settings.savingsGoal ?
              'success.main'
            : 'warning.main'
          }
          subtitle={`Goal: ${settings.savingsGoal}%`}
        />
      </Box>

      {/* Main Content Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
          gap: 3,
        }}
      >
        {/* Category Breakdown */}
        <Box
          sx={{
            bgcolor: 'white',
            borderRadius: 2,
            p: 3,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <Text variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
            Expenses by Category
          </Text>
          {stats.topCategories.length > 0 ?
            <Stack spacing={2}>
              {stats.topCategories.map((cat) => (
                <Box key={cat.category}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 1 }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: getCategoryColor(cat.category),
                        }}
                      />
                      <Text variant="body2" sx={{ fontWeight: 500 }}>
                        {cat.category}
                      </Text>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Text variant="body2" color="text.secondary">
                        {cat.percentage.toFixed(1)}%
                      </Text>
                      <Text variant="body2" sx={{ fontWeight: 600 }}>
                        {formatCurrency(cat.totalAmount, settings.currency)}
                      </Text>
                    </Stack>
                  </Stack>
                  <Box
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'grey.100',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: `${cat.percentage}%`,
                        bgcolor: getCategoryColor(cat.category),
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </Box>
                </Box>
              ))}
            </Stack>
          : <Text variant="body2" color="text.secondary">
              No expense data for this month yet.
            </Text>
          }
        </Box>

        {/* Recent Transactions */}
        <Box
          sx={{
            bgcolor: 'white',
            borderRadius: 2,
            p: 3,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <Text variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
            Recent Transactions
          </Text>
          {recentTransactions.length > 0 ?
            <Stack spacing={2}>
              {recentTransactions.map((tx) => (
                <Stack
                  key={tx.id}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{
                    pb: 2,
                    borderBottom: '1px solid',
                    borderColor: 'grey.100',
                    '&:last-child': { borderBottom: 'none', pb: 0 },
                  }}
                >
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: getCategoryColor(tx.category),
                        }}
                      />
                      <Text variant="body2" sx={{ fontWeight: 500 }}>
                        {tx.subcategory || tx.category}
                      </Text>
                    </Stack>
                    <Text variant="caption" color="text.secondary">
                      {formatDate(tx.date, settings.locale)}
                    </Text>
                  </Box>
                  <Text
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      color: tx.amount > 0 ? 'success.main' : 'error.main',
                    }}
                  >
                    {tx.amount > 0 ? '+' : ''}
                    {formatCurrency(tx.amount, settings.currency)}
                  </Text>
                </Stack>
              ))}
            </Stack>
          : <Text variant="body2" color="text.secondary">
              No transactions yet. Add your first transaction!
            </Text>
          }
        </Box>
      </Box>

      {/* Monthly Summary */}
      <Box
        sx={{
          mt: 3,
          bgcolor: 'white',
          borderRadius: 2,
          p: 3,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <Text variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
          Monthly Overview
        </Text>
        <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
          {stats.monthlyStats.slice(-6).map((month) => (
            <Box
              key={month.month}
              sx={{
                minWidth: 120,
                p: 2,
                borderRadius: 2,
                bgcolor: 'grey.50',
                textAlign: 'center',
              }}
            >
              <Text
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1 }}
              >
                {new Date(month.month + '-01').toLocaleDateString(
                  settings.locale,
                  {
                    month: 'short',
                    year: '2-digit',
                  },
                )}
              </Text>
              <Text
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: month.savings >= 0 ? 'success.main' : 'error.main',
                }}
              >
                {month.savings >= 0 ? '+' : ''}
                {formatCurrency(month.savings, settings.currency)}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export type DashboardProps = Props;
export default memo(Dashboard);
