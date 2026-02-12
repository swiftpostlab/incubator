'use client';

import { memo } from 'react';
import Box from '@swiftpost/elysium/ui/base/Box';
import Stack from '@swiftpost/elysium/ui/base/Stack';
import Text from '@swiftpost/elysium/ui/base/Text';
import Button from '@swiftpost/elysium/ui/base/Button';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { formatCurrency } from '@/features/expense-tracker/utils/formatters';
import type { UserSettings } from '@/features/expense-tracker/types';

type ViewType = 'dashboard' | 'transactions' | 'investments' | 'settings';

interface Stats {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savingsRate: number;
}

interface Props {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  isOpen: boolean;
  onClose: () => void;
  stats: Stats;
  settings: UserSettings;
}

const navItems: { id: ViewType; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { id: 'transactions', label: 'Transactions', icon: <ReceiptLongIcon /> },
  { id: 'investments', label: 'Investments', icon: <TrendingUpIcon /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
];

const Sidebar: React.FC<Props> = ({
  currentView,
  onViewChange,
  isOpen,
  onClose,
  stats,
  settings,
}) => {
  return (
    <Box
      component="aside"
      sx={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: '280px',
        bgcolor: 'white',
        borderRight: '1px solid',
        borderColor: 'grey.200',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1200,
        transform: {
          xs: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          md: 'translateX(0)',
        },
        transition: 'transform 0.3s ease',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 3,
          borderBottom: '1px solid',
          borderColor: 'grey.200',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <AccountBalanceWalletIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Text variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
            Expense Tracker
          </Text>
        </Stack>
        <Button
          onClick={onClose}
          sx={{
            display: { xs: 'flex', md: 'none' },
            minWidth: 'auto',
            p: 0.5,
          }}
        >
          <CloseIcon />
        </Button>
      </Box>

      {/* Balance Card */}
      <Box sx={{ p: 3 }}>
        <Box
          sx={{
            p: 2.5,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
          }}
        >
          <Text variant="body2" sx={{ opacity: 0.9, mb: 0.5 }}>
            Current Balance
          </Text>
          <Text variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            {formatCurrency(stats.balance, settings.currency)}
          </Text>
          <Stack direction="row" justifyContent="space-between">
            <Box>
              <Text variant="caption" sx={{ opacity: 0.8 }}>
                Income
              </Text>
              <Text variant="body2" sx={{ fontWeight: 600 }}>
                +{formatCurrency(stats.totalIncome, settings.currency)}
              </Text>
            </Box>
            <Box>
              <Text variant="caption" sx={{ opacity: 0.8 }}>
                Expenses
              </Text>
              <Text variant="body2" sx={{ fontWeight: 600 }}>
                -{formatCurrency(stats.totalExpenses, settings.currency)}
              </Text>
            </Box>
          </Stack>
        </Box>
      </Box>

      {/* Navigation */}
      <Stack component="nav" sx={{ px: 2, flex: 1 }} spacing={0.5}>
        {navItems.map((item) => (
          <Button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            sx={{
              justifyContent: 'flex-start',
              px: 2,
              py: 1.5,
              borderRadius: 2,
              color: currentView === item.id ? 'primary.main' : 'text.secondary',
              bgcolor: currentView === item.id ? 'primary.light' : 'transparent',
              '&:hover': {
                bgcolor: currentView === item.id ? 'primary.light' : 'grey.100',
              },
            }}
            startIcon={item.icon}
          >
            <Text
              variant="body2"
              sx={{
                fontWeight: currentView === item.id ? 600 : 400,
              }}
            >
              {item.label}
            </Text>
          </Button>
        ))}
      </Stack>

      {/* Footer */}
      <Box sx={{ p: 3, borderTop: '1px solid', borderColor: 'grey.200' }}>
        <Text variant="caption" color="text.secondary">
          Savings Rate: {stats.savingsRate.toFixed(1)}%
        </Text>
        <Box
          sx={{
            mt: 1,
            height: 6,
            borderRadius: 3,
            bgcolor: 'grey.200',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: '100%',
              width: `${Math.min(Math.max(stats.savingsRate, 0), 100)}%`,
              bgcolor: stats.savingsRate >= settings.savingsGoal ? 'success.main' : 'warning.main',
              transition: 'width 0.3s ease',
            }}
          />
        </Box>
        <Text variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          Goal: {settings.savingsGoal}%
        </Text>
      </Box>
    </Box>
  );
};

export type SidebarProps = Props;
export default memo(Sidebar);
