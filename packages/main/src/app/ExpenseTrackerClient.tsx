'use client';

import { useState, useCallback } from 'react';
import Box from '@swiftpost/elysium/ui/base/Box';
import Stack from '@swiftpost/elysium/ui/base/Stack';
import Text from '@swiftpost/elysium/ui/base/Text';
import Button from '@swiftpost/elysium/ui/base/Button';
import CircularProgress from '@mui/material/CircularProgress';
import MenuIcon from '@mui/icons-material/Menu';
import { useExpenseData } from '@/features/expense-tracker/hooks/useExpenseData';
import { useTransactions } from '@/features/expense-tracker/hooks/useTransactions';
import { useCategories } from '@/features/expense-tracker/hooks/useCategories';
import { useStats } from '@/features/expense-tracker/hooks/useStats';
import Sidebar from '@/components/expense-tracker/Sidebar';
import Dashboard from '@/components/expense-tracker/Dashboard';
import TransactionsView from '@/components/expense-tracker/TransactionsView';
import SettingsView from '@/components/expense-tracker/SettingsView';
import { OLD_THEME } from '@/features/expense-tracker/constants';

type ViewType = 'dashboard' | 'transactions' | 'investments' | 'settings';

const ExpenseTrackerClient: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    isInitialized,
    isLoading: dataLoading,
    error,
    categories,
    tags,
    globalFilter,
    settings,
    actions: dataActions,
  } = useExpenseData();

  const {
    transactions,
    filteredTransactions,
    paginatedTransactions,
    page,
    totalPages,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    bulkDelete,
    setPage,
    setFilters,
    clearFilters,
  } = useTransactions({ globalFilter });

  const {
    categoryList,
    addCategory,
    deleteCategory,
    addSubcategory,
    getCategoryColor,
  } = useCategories();

  const stats = useStats({ transactions });

  const handleViewChange = useCallback((view: ViewType) => {
    setCurrentView(view);
    setSidebarOpen(false);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  // Loading state
  if (!isInitialized || dataLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: OLD_THEME.colors.appBackground,
        }}
      >
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Text variant="body2" color="text.secondary">
            Loading Expense Tracker...
          </Text>
        </Stack>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'grey.100',
        }}
      >
        <Stack spacing={2} alignItems="center">
          <Text variant="h6" color="error">
            Error loading data
          </Text>
          <Text variant="body2" color="text.secondary">
            {error.message}
          </Text>
          <Button variant="contained" onClick={dataActions.clearError}>
            Try Again
          </Button>
        </Stack>
      </Box>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            stats={stats}
            transactions={transactions}
            categories={categories}
            settings={settings}
            getCategoryColor={getCategoryColor}
          />
        );
      case 'transactions':
        return (
          <TransactionsView
            transactions={paginatedTransactions}
            allTransactions={filteredTransactions}
            categories={categories}
            tags={tags}
            settings={settings}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onAddTransaction={addTransaction}
            onUpdateTransaction={updateTransaction}
            onDeleteTransaction={deleteTransaction}
            onBulkDelete={bulkDelete}
            onFilterChange={setFilters}
            onClearFilters={clearFilters}
            getCategoryColor={getCategoryColor}
          />
        );
      case 'settings':
        return (
          <SettingsView
            settings={settings}
            categories={categories}
            categoryList={categoryList}
            tags={tags}
            onUpdateSettings={dataActions.updateSettings}
            onAddCategory={addCategory}
            onDeleteCategory={deleteCategory}
            onAddSubcategory={addSubcategory}
          />
        );
      case 'investments':
        return (
          <Box sx={{ p: 3 }}>
            <Text variant="h5">Investments</Text>
            <Text variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Investment tracking coming soon...
            </Text>
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: 'grey.100',
      }}
    >
      {/* Mobile Header */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          bgcolor: 'primary.main',
          color: 'white',
          p: 2,
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Button
          onClick={toggleSidebar}
          sx={{ color: 'white', minWidth: 'auto', p: 1 }}
        >
          <MenuIcon />
        </Button>
        <Text variant="h6" sx={{ fontWeight: 600 }}>
          Expense Tracker
        </Text>
      </Box>

      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        isOpen={sidebarOpen}
        onClose={() => {
          setSidebarOpen(false);
        }}
        stats={stats}
        settings={settings}
      />

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: { xs: '64px', md: 0 },
          ml: { xs: 0, md: '280px' },
          p: { xs: 2, md: 3 },
          minHeight: '100vh',
          transition: 'margin 0.3s ease',
        }}
      >
        {renderView()}
      </Box>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <Box
          onClick={() => {
            setSidebarOpen(false);
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            position: 'fixed',
            inset: 0,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
          }}
        />
      )}
    </Box>
  );
};

export default ExpenseTrackerClient;
