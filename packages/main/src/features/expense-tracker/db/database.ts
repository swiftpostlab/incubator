import Dexie, { type EntityTable } from 'dexie';
import type {
  Transaction,
  Asset,
  AssetTransaction,
  RecurringPayment,
  QuickAction,
  GlobalFilter,
  UserSettings,
} from '../types';

// ============================================================================
// Database Schema
// ============================================================================

interface CategoryRecord {
  id?: number;
  name: string;
  subcategories: string[];
}

interface TagRecord {
  id?: number;
  name: string;
}

interface SettingsRecord {
  id: 'settings';
  globalFilter: GlobalFilter;
  userSettings: UserSettings;
  lastSync?: string;
}

// ============================================================================
// Database Definition
// ============================================================================

export class ExpenseTrackerDB extends Dexie {
  transactions!: EntityTable<Transaction, 'id'>;
  assets!: EntityTable<Asset, 'id'>;
  assetTransactions!: EntityTable<AssetTransaction, 'id'>;
  recurring!: EntityTable<RecurringPayment, 'id'>;
  quickActions!: EntityTable<QuickAction, 'id'>;
  categories!: EntityTable<CategoryRecord, 'id'>;
  tags!: EntityTable<TagRecord, 'id'>;
  settings!: EntityTable<SettingsRecord, 'id'>;

  constructor() {
    super('ExpenseTrackerDB');

    this.version(1).stores({
      // Primary key is auto-incremented id, indexed by date, category, tag
      transactions: '++id, date, category, subcategory, tag, track',
      // Assets indexed by type
      assets: '++id, name, type',
      // Asset transactions indexed by assetId and date
      assetTransactions: '++id, assetId, date, type',
      // Recurring payments
      recurring: '++id, nextDate, enabled',
      // Quick actions
      quickActions: '++id, name',
      // Categories
      categories: '++id, &name',
      // Tags
      tags: '++id, &name',
      // Settings (single record)
      settings: 'id',
    });
  }
}

// ============================================================================
// Database Instance
// ============================================================================

// Singleton instance - only create on client side
let dbInstance: ExpenseTrackerDB | null = null;

export const getDb = (): ExpenseTrackerDB => {
  if (typeof window === 'undefined') {
    throw new Error('Database can only be accessed on the client side');
  }

  if (!dbInstance) {
    dbInstance = new ExpenseTrackerDB();
  }

  return dbInstance;
};

// Export db getter for convenience (will throw on server)
export const db = new Proxy({} as ExpenseTrackerDB, {
  get(_, prop) {
    const instance = getDb();
    return instance[prop as keyof ExpenseTrackerDB];
  },
});

// ============================================================================
// Database Initialization
// ============================================================================

export const initializeDatabase = async (): Promise<void> => {
  const database = getDb();

  // Check if settings exist, if not create default
  const existingSettings = await database.settings.get('settings');

  if (!existingSettings) {
    await database.settings.put({
      id: 'settings',
      globalFilter: {
        enabled: false,
        startDate: undefined,
        endDate: undefined,
      },
      userSettings: {
        locale: 'en',
        currency: 'EUR',
        savingsGoal: 20,
      },
      lastSync: undefined,
    });
  }

  // Check if categories exist, if not create defaults
  const categoryCount = await database.categories.count();

  if (categoryCount === 0) {
    const defaultCategories = [
      { name: 'Salary', subcategories: ['Fixed', 'Bonus', 'Other'] },
      {
        name: 'Home',
        subcategories: [
          'Rent',
          'Mortgage',
          'Utilities',
          'Maintenance',
          'Furniture',
          'Other',
        ],
      },
      {
        name: 'Groceries',
        subcategories: [
          'Supermarket',
          'Fruits/Vegetables',
          'Meat/Fish',
          'Other',
        ],
      },
      {
        name: 'Transportation',
        subcategories: [
          'Fuel',
          'Public transit',
          'Car maintenance',
          'Insurance',
          'Parking',
          'Other',
        ],
      },
      { name: 'Health', subcategories: ['Doctor', 'Pharmacy', 'Gym', 'Other'] },
      {
        name: 'Entertainment',
        subcategories: [
          'Restaurants',
          'Cinema/Theater',
          'Travel',
          'Hobbies',
          'Other',
        ],
      },
      {
        name: 'Clothing',
        subcategories: ['Clothes', 'Shoes', 'Accessories', 'Other'],
      },
      {
        name: 'Technology',
        subcategories: ['Electronics', 'Software', 'Phone', 'Other'],
      },
      { name: 'Education', subcategories: ['Courses', 'Books', 'Other'] },
      { name: 'Gifts', subcategories: ['Family', 'Friends', 'Other'] },
      {
        name: 'Taxes',
        subcategories: ['Income tax', 'Property tax', 'Car tax', 'Other'],
      },
      {
        name: 'Investments',
        subcategories: ['Stocks', 'Funds', 'Crypto', 'Other'],
      },
      { name: 'Other', subcategories: ['Miscellaneous', 'Unexpected'] },
    ];

    await database.categories.bulkPut(defaultCategories);
  }

  // Check if tags exist, if not create defaults
  const tagCount = await database.tags.count();

  if (tagCount === 0) {
    const defaultTags = [
      { name: 'Urgent' },
      { name: 'Recurring' },
      { name: 'Optional' },
      { name: 'Deductible' },
    ];

    await database.tags.bulkPut(defaultTags);
  }
};

// ============================================================================
// Export Types
// ============================================================================

export type { CategoryRecord, TagRecord, SettingsRecord };
