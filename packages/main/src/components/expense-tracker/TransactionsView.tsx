'use client';

import { useState, useCallback, memo } from 'react';
import Box from '@swiftpost/elysium/ui/base/Box';
import Stack from '@swiftpost/elysium/ui/base/Stack';
import Text from '@swiftpost/elysium/ui/base/Text';
import Button from '@swiftpost/elysium/ui/base/Button';
import TextField from '@swiftpost/elysium/ui/base/TextField ';
import Select from '@swiftpost/elysium/ui/base/Select';
import MenuItem from '@swiftpost/elysium/ui/base/MenuItem';
import FormControl from '@swiftpost/elysium/ui/base/FormControl';
import Checkbox from '@swiftpost/elysium/ui/base/Checkbox';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  formatCurrency,
  formatDate,
} from '@/features/expense-tracker/utils/formatters';
import TransactionFormModal from '@/components/expense-tracker/TransactionFormModal';
import type {
  Transaction,
  Categories,
  UserSettings,
  CreateTransactionInput,
  UpdateTransactionInput,
} from '@/features/expense-tracker/types';

interface TransactionFilters {
  category?: string;
  subcategory?: string;
  tag?: string;
  search?: string;
  type?: 'income' | 'expense' | 'transfer';
  yearMonth?: string;
}

interface Props {
  transactions: Transaction[];
  allTransactions: Transaction[];
  categories: Categories;
  tags: string[];
  settings: UserSettings;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onAddTransaction: (input: CreateTransactionInput) => Promise<Transaction>;
  onUpdateTransaction: (input: UpdateTransactionInput) => Promise<Transaction>;
  onDeleteTransaction: (id: number) => Promise<void>;
  onBulkDelete: (ids: number[]) => Promise<void>;
  onFilterChange: (filters: TransactionFilters) => void;
  onClearFilters: () => void;
  getCategoryColor: (category: string) => string;
}

const TransactionsView: React.FC<Props> = ({
  transactions,
  allTransactions,
  categories,
  tags,
  settings,
  page,
  totalPages,
  onPageChange,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onBulkDelete,
  onFilterChange,
  onClearFilters,
  getCategoryColor,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const handleAddClick = useCallback(() => {
    setEditingTransaction(null);
    setIsFormOpen(true);
  }, []);

  const handleEditClick = useCallback((tx: Transaction) => {
    setEditingTransaction(tx);
    setIsFormOpen(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setIsFormOpen(false);
    setEditingTransaction(null);
  }, []);

  const handleFormSubmit = useCallback(
    async (data: CreateTransactionInput) => {
      if (editingTransaction) {
        await onUpdateTransaction({ id: editingTransaction.id, ...data });
      } else {
        await onAddTransaction(data);
      }
      handleFormClose();
    },
    [
      editingTransaction,
      onAddTransaction,
      onUpdateTransaction,
      handleFormClose,
    ],
  );

  const handleDeleteClick = useCallback(
    async (id: number) => {
      if (window.confirm('Are you sure you want to delete this transaction?')) {
        await onDeleteTransaction(id);
      }
    },
    [onDeleteTransaction],
  );

  const handleBulkDelete = useCallback(async () => {
    if (
      selectedIds.size > 0 &&
      window.confirm(`Delete ${selectedIds.size} transactions?`)
    ) {
      await onBulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  }, [selectedIds, onBulkDelete]);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((tx) => tx.id)));
    }
  }, [transactions, selectedIds]);

  const handleSelectOne = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      onFilterChange({
        search: value || undefined,
        category: filterCategory || undefined,
      });
    },
    [onFilterChange, filterCategory],
  );

  const handleCategoryFilter = useCallback(
    (category: string) => {
      setFilterCategory(category);
      onFilterChange({
        category: category || undefined,
        search: searchQuery || undefined,
      });
    },
    [onFilterChange, searchQuery],
  );

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterCategory('');
    onClearFilters();
  }, [onClearFilters]);

  return (
    <Box>
      {/* Header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Text variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Transactions
          </Text>
          <Text variant="body2" color="text.secondary">
            {allTransactions.length} total transactions
          </Text>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddClick}
          sx={{ alignSelf: { xs: 'stretch', sm: 'auto' } }}
        >
          Add Transaction
        </Button>
      </Stack>

      {/* Filters */}
      <Box
        sx={{
          bgcolor: 'white',
          borderRadius: 2,
          p: 2,
          mb: 3,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems="center"
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ flex: 1, width: '100%' }}
          >
            <SearchIcon sx={{ color: 'text.secondary' }} />
            <TextField
              placeholder="Search transactions..."
              size="small"
              value={searchQuery}
              onChange={(e) => {
                handleSearch(e.target.value);
              }}
              sx={{ flex: 1 }}
            />
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={filterCategory}
                onChange={(e) => {
                  handleCategoryFilter(e.target.value);
                }}
                displayEmpty
              >
                <MenuItem value="">All Categories</MenuItem>
                {Object.keys(categories).map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FilterListIcon />}
              onClick={() => {
                setShowFilters(!showFilters);
              }}
            >
              Filters
            </Button>
            {(searchQuery || filterCategory) && (
              <Button
                size="small"
                color="secondary"
                onClick={handleClearFilters}
              >
                Clear
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <Box
          sx={{
            bgcolor: 'primary.light',
            borderRadius: 2,
            p: 2,
            mb: 2,
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Text variant="body2">
              {selectedIds.size} transaction(s) selected
            </Text>
            <Button
              color="error"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={handleBulkDelete}
            >
              Delete Selected
            </Button>
          </Stack>
        </Box>
      )}

      {/* Transactions Table */}
      <Box
        sx={{
          bgcolor: 'white',
          borderRadius: 2,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          overflow: 'hidden',
        }}
      >
        {/* Table Header */}
        <Box
          sx={{
            display: { xs: 'none', md: 'grid' },
            gridTemplateColumns: '48px 1fr 120px 150px 100px 100px',
            p: 2,
            bgcolor: 'grey.50',
            borderBottom: '1px solid',
            borderColor: 'grey.200',
          }}
        >
          <Box>
            <Checkbox
              checked={
                selectedIds.size === transactions.length &&
                transactions.length > 0
              }
              indeterminate={
                selectedIds.size > 0 && selectedIds.size < transactions.length
              }
              onChange={handleSelectAll}
            />
          </Box>
          <Text variant="body2" sx={{ fontWeight: 600 }}>
            Description
          </Text>
          <Text variant="body2" sx={{ fontWeight: 600 }}>
            Category
          </Text>
          <Text variant="body2" sx={{ fontWeight: 600 }}>
            Date
          </Text>
          <Text variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
            Amount
          </Text>
          <Text variant="body2" sx={{ fontWeight: 600, textAlign: 'center' }}>
            Actions
          </Text>
        </Box>

        {/* Table Body */}
        {transactions.length > 0 ?
          transactions.map((tx) => (
            <Box
              key={tx.id}
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: '48px 1fr 120px 150px 100px 100px',
                },
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'grey.100',
                alignItems: 'center',
                '&:hover': { bgcolor: 'grey.50' },
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              {/* Checkbox */}
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <Checkbox
                  checked={selectedIds.has(tx.id)}
                  onChange={() => {
                    handleSelectOne(tx.id);
                  }}
                />
              </Box>

              {/* Description */}
              <Box>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: getCategoryColor(tx.category),
                      flexShrink: 0,
                    }}
                  />
                  <Box>
                    <Text variant="body2" sx={{ fontWeight: 500 }}>
                      {tx.subcategory || tx.category}
                    </Text>
                    {tx.note && (
                      <Text variant="caption" color="text.secondary">
                        {tx.note}
                      </Text>
                    )}
                  </Box>
                </Stack>
              </Box>

              {/* Category (hidden on mobile, shown in description) */}
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <Text variant="body2" color="text.secondary">
                  {tx.category}
                </Text>
              </Box>

              {/* Date */}
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <Text variant="body2">
                  {formatDate(tx.date, settings.locale)}
                </Text>
              </Box>

              {/* Amount */}
              <Box
                sx={{
                  display: { xs: 'flex', md: 'block' },
                  justifyContent: 'space-between',
                }}
              >
                <Text
                  variant="body2"
                  sx={{ display: { xs: 'block', md: 'none' } }}
                  color="text.secondary"
                >
                  {formatDate(tx.date, settings.locale)}
                </Text>
                <Text
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    textAlign: { xs: 'left', md: 'right' },
                    color: tx.amount > 0 ? 'success.main' : 'error.main',
                  }}
                >
                  {tx.amount > 0 ? '+' : ''}
                  {formatCurrency(tx.amount, settings.currency)}
                </Text>
              </Box>

              {/* Actions */}
              <Stack
                direction="row"
                spacing={1}
                justifyContent={{ xs: 'flex-start', md: 'center' }}
                sx={{ mt: { xs: 1, md: 0 } }}
              >
                <Button
                  size="small"
                  sx={{ minWidth: 'auto', p: 0.5 }}
                  onClick={() => {
                    handleEditClick(tx);
                  }}
                >
                  <EditIcon fontSize="small" />
                </Button>
                <Button
                  size="small"
                  color="error"
                  sx={{ minWidth: 'auto', p: 0.5 }}
                  onClick={() => {
                    void handleDeleteClick(tx.id);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </Button>
              </Stack>
            </Box>
          ))
        : <Box sx={{ p: 4, textAlign: 'center' }}>
            <Text variant="body2" color="text.secondary">
              No transactions found. Add your first transaction!
            </Text>
          </Box>
        }
      </Box>

      {/* Pagination */}
      {totalPages > 1 && (
        <Stack
          direction="row"
          justifyContent="center"
          alignItems="center"
          spacing={2}
          sx={{ mt: 3 }}
        >
          <Button
            disabled={page === 1}
            onClick={() => {
              onPageChange(page - 1);
            }}
            sx={{ minWidth: 'auto' }}
          >
            <ChevronLeftIcon />
          </Button>
          <Text variant="body2">
            Page {page} of {totalPages}
          </Text>
          <Button
            disabled={page === totalPages}
            onClick={() => {
              onPageChange(page + 1);
            }}
            sx={{ minWidth: 'auto' }}
          >
            <ChevronRightIcon />
          </Button>
        </Stack>
      )}

      {/* Transaction Form Modal */}
      <TransactionFormModal
        open={isFormOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        categories={categories}
        tags={tags}
        initialData={editingTransaction}
      />
    </Box>
  );
};

export type TransactionsViewProps = Props;
export default memo(TransactionsView);
