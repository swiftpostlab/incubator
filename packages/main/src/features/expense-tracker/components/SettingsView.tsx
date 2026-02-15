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
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import type {
  Categories,
  UserSettings,
} from '@/features/expense-tracker/types';
import type { CategoryRecord } from '@/features/expense-tracker/db/database';

interface Props {
  settings: UserSettings;
  categories: Categories;
  categoryList: CategoryRecord[];
  tags: string[];
  onUpdateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  onAddCategory: (name: string, subcategories?: string[]) => Promise<void>;
  onDeleteCategory: (id: number) => Promise<void>;
  onAddSubcategory: (
    categoryName: string,
    subcategoryName: string,
  ) => Promise<void>;
}

const CURRENCY_OPTIONS = [
  { code: 'EUR', label: '€ Euro' },
  { code: 'USD', label: '$ US Dollar' },
  { code: 'GBP', label: '£ British Pound' },
  { code: 'JPY', label: '¥ Japanese Yen' },
];

const LOCALE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
];

const SettingsView: React.FC<Props> = ({
  settings,
  categoryList,
  onUpdateSettings,
  onAddCategory,
  onDeleteCategory,
  onAddSubcategory,
}) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newSubcategoryName, setNewSubcategoryName] = useState('');

  const handleSavingsGoalChange = useCallback(
    async (value: string) => {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 0 && num <= 100) {
        await onUpdateSettings({ savingsGoal: num });
      }
    },
    [onUpdateSettings],
  );

  const handleAddCategory = useCallback(async () => {
    if (newCategoryName.trim()) {
      await onAddCategory(newCategoryName.trim());
      setNewCategoryName('');
    }
  }, [newCategoryName, onAddCategory]);

  const handleDeleteCategory = useCallback(
    async (id: number) => {
      if (window.confirm('Delete this category? This cannot be undone.')) {
        await onDeleteCategory(id);
      }
    },
    [onDeleteCategory],
  );

  const handleAddSubcategory = useCallback(async () => {
    if (selectedCategory && newSubcategoryName.trim()) {
      await onAddSubcategory(selectedCategory, newSubcategoryName.trim());
      setNewSubcategoryName('');
    }
  }, [selectedCategory, newSubcategoryName, onAddSubcategory]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Text variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Settings
        </Text>
        <Text variant="body2" color="text.secondary">
          Customize your expense tracker preferences
        </Text>
      </Box>

      <Stack spacing={4}>
        {/* General Settings */}
        <Box
          sx={{
            bgcolor: 'white',
            borderRadius: 2,
            p: 3,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <Text variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
            General
          </Text>
          <Stack spacing={3}>
            {/* Language */}
            <FormControl fullWidth>
              <Text variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Language
              </Text>
              <Select
                value={settings.locale}
                onChange={(e) =>
                  void onUpdateSettings({ locale: e.target.value })
                }
              >
                {LOCALE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.code} value={opt.code}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Currency */}
            <FormControl fullWidth>
              <Text variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Currency
              </Text>
              <Select
                value={settings.currency}
                onChange={(e) =>
                  void onUpdateSettings({ currency: e.target.value })
                }
              >
                {CURRENCY_OPTIONS.map((opt) => (
                  <MenuItem key={opt.code} value={opt.code}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Savings Goal */}
            <Box>
              <Text variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Monthly Savings Goal: {settings.savingsGoal}%
              </Text>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.savingsGoal}
                    onChange={(e) =>
                      void handleSavingsGoalChange(e.target.value)
                    }
                    style={{ width: '100%' }}
                  />
                </Box>
                <Text variant="body2" sx={{ minWidth: 40, textAlign: 'right' }}>
                  {settings.savingsGoal}%
                </Text>
              </Stack>
              <Text variant="caption" color="text.secondary">
                This is your target percentage of income to save each month.
              </Text>
            </Box>
          </Stack>
        </Box>

        {/* Categories Management */}
        <Box
          sx={{
            bgcolor: 'white',
            borderRadius: 2,
            p: 3,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <Text variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
            Categories
          </Text>

          {/* Add Category */}
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <TextField
              placeholder="New category name"
              value={newCategoryName}
              onChange={(e) => {
                setNewCategoryName(e.target.value);
              }}
              size="small"
              sx={{ flex: 1 }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => void handleAddCategory()}
              disabled={!newCategoryName.trim()}
            >
              Add
            </Button>
          </Stack>

          {/* Category List */}
          <Stack spacing={1}>
            {categoryList.map((cat) => (
              <Stack
                key={cat.id}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: 'grey.50',
                  '&:hover': { bgcolor: 'grey.100' },
                }}
              >
                <Box>
                  <Text variant="body2" sx={{ fontWeight: 500 }}>
                    {cat.name}
                  </Text>
                  <Text variant="caption" color="text.secondary">
                    {cat.subcategories.length} subcategories
                  </Text>
                </Box>
                <Button
                  size="small"
                  color="error"
                  onClick={() => void (cat.id && handleDeleteCategory(cat.id))}
                  sx={{ minWidth: 'auto', p: 0.5 }}
                >
                  <DeleteIcon fontSize="small" />
                </Button>
              </Stack>
            ))}
          </Stack>
        </Box>

        {/* Subcategories Management */}
        <Box
          sx={{
            bgcolor: 'white',
            borderRadius: 2,
            p: 3,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <Text variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
            Subcategories
          </Text>

          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <Select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                }}
                displayEmpty
              >
                <MenuItem value="" disabled>
                  Select a category
                </MenuItem>
                {categoryList.map((cat) => (
                  <MenuItem key={cat.id} value={cat.name}>
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Stack direction="row" spacing={2}>
              <TextField
                placeholder="New subcategory name"
                value={newSubcategoryName}
                onChange={(e) => {
                  setNewSubcategoryName(e.target.value);
                }}
                size="small"
                sx={{ flex: 1 }}
                disabled={!selectedCategory}
              />
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => void handleAddSubcategory()}
                disabled={!selectedCategory || !newSubcategoryName.trim()}
              >
                Add
              </Button>
            </Stack>

            {selectedCategory && (
              <Box sx={{ mt: 2 }}>
                <Text variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  Current subcategories for &quot;{selectedCategory}&quot;:
                </Text>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {categoryList
                    .find((c) => c.name === selectedCategory)
                    ?.subcategories.map((sub) => (
                      <Box
                        key={sub}
                        sx={{
                          px: 1.5,
                          py: 0.5,
                          bgcolor: 'primary.light',
                          borderRadius: 4,
                        }}
                      >
                        <Text variant="caption">{sub}</Text>
                      </Box>
                    ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </Box>

        {/* Data Management */}
        <Box
          sx={{
            bgcolor: 'white',
            borderRadius: 2,
            p: 3,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <Text variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
            Data Management
          </Text>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button variant="outlined">Export Data (JSON)</Button>
            <Button variant="outlined">Export Data (CSV)</Button>
            <Button variant="outlined" color="warning">
              Import Data
            </Button>
          </Stack>
          <Text
            variant="caption"
            color="text.secondary"
            sx={{ mt: 2, display: 'block' }}
          >
            Your data is stored locally in your browser. Export regularly to
            back up your data.
          </Text>
        </Box>
      </Stack>
    </Box>
  );
};

export type SettingsViewProps = Props;
export default memo(SettingsView);
