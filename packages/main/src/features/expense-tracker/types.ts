import { z } from 'zod';

// ============================================================================
// Base Schemas (Zod)
// ============================================================================

export const TransactionSchema = z.object({
  id: z.number(),
  date: z.string(), // ISO date string YYYY-MM-DD
  category: z.string(),
  subcategory: z.string(),
  amount: z.number(), // Positive for income, negative for expense
  from: z.string(),
  to: z.string(),
  note: z.string().optional(),
  tag: z.string().optional(),
  track: z.boolean().default(true), // Whether to include in statistics
});

export const AssetSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.enum(['stock', 'crypto', 'bond', 'fund', 'other']),
  currentPrice: z.number().optional(),
});

export const AssetTransactionSchema = z.object({
  id: z.number(),
  assetId: z.number(),
  date: z.string(),
  type: z.enum(['buy', 'sell']),
  quantity: z.number(),
  price: z.number(), // Price per unit at transaction time
});

export const RecurringPaymentSchema = z.object({
  id: z.number(),
  transactionTemplate: TransactionSchema.omit({ id: true, date: true }),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  nextDate: z.string(), // ISO date string
  enabled: z.boolean().default(true),
});

export const QuickActionSchema = z.object({
  id: z.number(),
  name: z.string(),
  transactionTemplate: TransactionSchema.omit({ id: true, date: true }),
});

export const GlobalFilterSchema = z.object({
  enabled: z.boolean(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const UserSettingsSchema = z.object({
  locale: z.enum(['en', 'it']).default('en'),
  currency: z.string().default('EUR'),
  savingsGoal: z.number().min(0).max(100).default(20), // Percentage
});

export const CategoriesSchema = z.record(z.string(), z.array(z.string()));

export const ExpenseDataSchema = z.object({
  transactions: z.array(TransactionSchema),
  categories: CategoriesSchema,
  assets: z.array(AssetSchema),
  assetTransactions: z.array(AssetTransactionSchema),
  recurring: z.array(RecurringPaymentSchema),
  quickActions: z.array(QuickActionSchema),
  tags: z.array(z.string()),
  globalFilter: GlobalFilterSchema,
  settings: UserSettingsSchema,
  lastSync: z.string().optional(), // ISO timestamp of last Google Drive sync
});

// ============================================================================
// TypeScript Types (Inferred from Zod)
// ============================================================================

export type Transaction = z.infer<typeof TransactionSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type AssetTransaction = z.infer<typeof AssetTransactionSchema>;
export type RecurringPayment = z.infer<typeof RecurringPaymentSchema>;
export type QuickAction = z.infer<typeof QuickActionSchema>;
export type GlobalFilter = z.infer<typeof GlobalFilterSchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type Categories = z.infer<typeof CategoriesSchema>;
export type ExpenseData = z.infer<typeof ExpenseDataSchema>;

// ============================================================================
// Utility Types
// ============================================================================

export type TransactionType = 'income' | 'expense' | 'transfer';

export type AssetType = Asset['type'];

export type RecurringFrequency = RecurringPayment['frequency'];

export interface TransactionWithType extends Transaction {
  transactionType: TransactionType;
}

export interface AssetWithHoldings extends Asset {
  totalQuantity: number;
  averageCost: number;
  totalValue: number;
  gainLoss: number;
  gainLossPercent: number;
}

export interface MonthlyStats {
  month: string; // YYYY-MM
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
}

export interface CategoryStats {
  category: string;
  subcategories: {
    name: string;
    amount: number;
    count: number;
  }[];
  totalAmount: number;
  totalCount: number;
  percentage: number;
}

// ============================================================================
// Form Input Types (for creating/updating)
// ============================================================================

export type CreateTransactionInput = Omit<Transaction, 'id'>;
export type UpdateTransactionInput = Partial<Omit<Transaction, 'id'>> & {
  id: number;
};

export type CreateAssetInput = Omit<Asset, 'id'>;
export type UpdateAssetInput = Partial<Omit<Asset, 'id'>> & { id: number };

export type CreateAssetTransactionInput = Omit<AssetTransaction, 'id'>;

export type CreateRecurringPaymentInput = Omit<RecurringPayment, 'id'>;

export type CreateQuickActionInput = Omit<QuickAction, 'id'>;
