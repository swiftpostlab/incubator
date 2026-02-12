'use client';

import { useState, useCallback, useEffect, memo } from 'react';
import Box from '@swiftpost/elysium/ui/base/Box';
import Stack from '@swiftpost/elysium/ui/base/Stack';
import Text from '@swiftpost/elysium/ui/base/Text';
import Button from '@swiftpost/elysium/ui/base/Button';
import TextField from '@swiftpost/elysium/ui/base/TextField ';
import Select from '@swiftpost/elysium/ui/base/Select';
import MenuItem from '@swiftpost/elysium/ui/base/MenuItem';
import FormControl from '@swiftpost/elysium/ui/base/FormControl';
import Modal from '@swiftpost/elysium/ui/base/Modal';
import Checkbox from '@swiftpost/elysium/ui/base/Checkbox';
import CloseIcon from '@mui/icons-material/Close';
import type {
  Transaction,
  Categories,
  CreateTransactionInput,
} from '@/features/expense-tracker/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTransactionInput) => Promise<void>;
  categories: Categories;
  tags: string[];
  initialData?: Transaction | null;
}

const getTodayString = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

const TransactionFormModal: React.FC<Props> = ({
  open,
  onClose,
  onSubmit,
  categories,
  tags,
  initialData,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateTransactionInput>({
    date: getTodayString(),
    category: '',
    subcategory: '',
    amount: 0,
    from: '',
    to: '',
    note: '',
    tag: '',
    track: true,
  });
  const [amountInput, setAmountInput] = useState('');
  const [isExpense, setIsExpense] = useState(true);

  // Reset form when modal opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          date: initialData.date,
          category: initialData.category,
          subcategory: initialData.subcategory,
          amount: Math.abs(initialData.amount),
          from: initialData.from,
          to: initialData.to,
          note: initialData.note ?? '',
          tag: initialData.tag ?? '',
          track: initialData.track,
        });
        setAmountInput(Math.abs(initialData.amount).toString());
        setIsExpense(initialData.amount < 0);
      } else {
        setFormData({
          date: getTodayString(),
          category: '',
          subcategory: '',
          amount: 0,
          from: '',
          to: '',
          note: '',
          tag: '',
          track: true,
        });
        setAmountInput('');
        setIsExpense(true);
      }
    }
  }, [open, initialData]);

  const subcategories =
    formData.category ? (categories[formData.category] ?? []) : [];

  const handleChange = useCallback(
    (field: keyof CreateTransactionInput, value: string | number | boolean) => {
      setFormData((prev) => {
        const updated = { ...prev, [field]: value };
        // Reset subcategory when category changes
        if (field === 'category') {
          updated.subcategory = '';
        }
        return updated;
      });
    },
    [],
  );

  const handleAmountChange = useCallback((value: string) => {
    // Allow only numbers and decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    setAmountInput(cleaned);
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      setFormData((prev) => ({ ...prev, amount: num }));
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formData.category || !formData.subcategory || formData.amount === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const finalAmount =
        isExpense ? -Math.abs(formData.amount) : Math.abs(formData.amount);
      await onSubmit({ ...formData, amount: finalAmount });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, isExpense, onSubmit]);

  const isValid =
    formData.category && formData.subcategory && formData.amount !== 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Box
        sx={{
          bgcolor: 'white',
          borderRadius: 2,
          boxShadow: 24,
          width: '100%',
          maxWidth: 500,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        {/* Header */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ p: 3, borderBottom: '1px solid', borderColor: 'grey.200' }}
        >
          <Text variant="h6" sx={{ fontWeight: 600 }}>
            {initialData ? 'Edit Transaction' : 'Add Transaction'}
          </Text>
          <Button onClick={onClose} sx={{ minWidth: 'auto', p: 0.5 }}>
            <CloseIcon />
          </Button>
        </Stack>

        {/* Form */}
        <Box sx={{ p: 3 }}>
          <Stack spacing={3}>
            {/* Transaction Type Toggle */}
            <Stack direction="row" spacing={1}>
              <Button
                variant={isExpense ? 'contained' : 'outlined'}
                color="error"
                onClick={() => {
                  setIsExpense(true);
                }}
                sx={{ flex: 1 }}
              >
                Expense
              </Button>
              <Button
                variant={!isExpense ? 'contained' : 'outlined'}
                color="success"
                onClick={() => {
                  setIsExpense(false);
                }}
                sx={{ flex: 1 }}
              >
                Income
              </Button>
            </Stack>

            {/* Date */}
            <TextField
              label="Date"
              type="date"
              value={formData.date}
              onChange={(e) => {
                handleChange('date', e.target.value);
              }}
              fullWidth
              slotProps={{
                inputLabel: { shrink: true },
              }}
            />

            {/* Category */}
            <FormControl fullWidth>
              <Text variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Category
              </Text>
              <Select
                value={formData.category}
                onChange={(e) => {
                  handleChange('category', e.target.value);
                }}
                displayEmpty
              >
                <MenuItem value="" disabled>
                  Select category
                </MenuItem>
                {Object.keys(categories).map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Subcategory */}
            <FormControl fullWidth disabled={!formData.category}>
              <Text variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Subcategory
              </Text>
              <Select
                value={formData.subcategory}
                onChange={(e) => {
                  handleChange('subcategory', e.target.value);
                }}
                displayEmpty
              >
                <MenuItem value="" disabled>
                  Select subcategory
                </MenuItem>
                {subcategories.map((sub) => (
                  <MenuItem key={sub} value={sub}>
                    {sub}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Amount */}
            <TextField
              label="Amount"
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={(e) => {
                handleAmountChange(e.target.value);
              }}
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <Text
                      variant="body2"
                      sx={{ mr: 1, color: 'text.secondary' }}
                    >
                      €
                    </Text>
                  ),
                },
              }}
            />

            {/* From / To */}
            <Stack direction="row" spacing={2}>
              <TextField
                label="From"
                value={formData.from}
                onChange={(e) => {
                  handleChange('from', e.target.value);
                }}
                fullWidth
                placeholder="Source account"
              />
              <TextField
                label="To"
                value={formData.to}
                onChange={(e) => {
                  handleChange('to', e.target.value);
                }}
                fullWidth
                placeholder="Destination"
              />
            </Stack>

            {/* Note */}
            <TextField
              label="Note (optional)"
              value={formData.note}
              onChange={(e) => {
                handleChange('note', e.target.value);
              }}
              fullWidth
              multiline
              rows={2}
            />

            {/* Tag */}
            <FormControl fullWidth>
              <Text variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                Tag (optional)
              </Text>
              <Select
                value={formData.tag ?? ''}
                onChange={(e) => {
                  handleChange('tag', e.target.value);
                }}
                displayEmpty
              >
                <MenuItem value="">No tag</MenuItem>
                {tags.map((tag) => (
                  <MenuItem key={tag} value={tag}>
                    {tag}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Track in Statistics */}
            <Stack direction="row" alignItems="center" spacing={1}>
              <Checkbox
                checked={formData.track}
                onChange={(e) => {
                  handleChange('track', e.target.checked);
                }}
              />
              <Text variant="body2">Include in statistics</Text>
            </Stack>
          </Stack>
        </Box>

        {/* Footer */}
        <Stack
          direction="row"
          spacing={2}
          sx={{ p: 3, borderTop: '1px solid', borderColor: 'grey.200' }}
        >
          <Button variant="outlined" onClick={onClose} sx={{ flex: 1 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={!isValid || isSubmitting}
            sx={{ flex: 1 }}
          >
            {isSubmitting ?
              'Saving...'
            : initialData ?
              'Update'
            : 'Add'}
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
};

export type TransactionFormModalProps = Props;
export default memo(TransactionFormModal);
