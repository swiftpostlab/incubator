import type {
  Categories,
  ExpenseData,
  GlobalFilter,
  UserSettings,
} from './types';

// ============================================================================
// Default Categories (from original Spesometro)
// ============================================================================

export const DEFAULT_CATEGORIES: Categories = {
  Stipendio: ['Fisso', 'Bonus', 'Altro'],
  Casa: ['Affitto', 'Mutuo', 'Utenze', 'Manutenzione', 'Arredamento', 'Altro'],
  Spesa: ['Supermercato', 'Frutta/Verdura', 'Carne/Pesce', 'Altro'],
  Trasporti: [
    'Carburante',
    'Mezzi pubblici',
    'Manutenzione auto',
    'Assicurazione',
    'Parcheggio',
    'Altro',
  ],
  Salute: ['Medico', 'Farmacia', 'Palestra', 'Altro'],
  Svago: ['Ristoranti', 'Cinema/Teatro', 'Viaggi', 'Hobby', 'Altro'],
  Abbigliamento: ['Vestiti', 'Scarpe', 'Accessori', 'Altro'],
  Tecnologia: ['Elettronica', 'Software', 'Telefonia', 'Altro'],
  Istruzione: ['Corsi', 'Libri', 'Altro'],
  Regali: ['Famiglia', 'Amici', 'Altro'],
  Tasse: ['IRPEF', 'IMU', 'Bollo auto', 'Altro'],
  Investimenti: ['Azioni', 'Fondi', 'Crypto', 'Altro'],
  Altro: ['Varie', 'Imprevisti'],
};

// English translation of categories
export const DEFAULT_CATEGORIES_EN: Categories = {
  Salary: ['Fixed', 'Bonus', 'Other'],
  Home: ['Rent', 'Mortgage', 'Utilities', 'Maintenance', 'Furniture', 'Other'],
  Groceries: ['Supermarket', 'Fruits/Vegetables', 'Meat/Fish', 'Other'],
  Transportation: [
    'Fuel',
    'Public transit',
    'Car maintenance',
    'Insurance',
    'Parking',
    'Other',
  ],
  Health: ['Doctor', 'Pharmacy', 'Gym', 'Other'],
  Entertainment: [
    'Restaurants',
    'Cinema/Theater',
    'Travel',
    'Hobbies',
    'Other',
  ],
  Clothing: ['Clothes', 'Shoes', 'Accessories', 'Other'],
  Technology: ['Electronics', 'Software', 'Phone', 'Other'],
  Education: ['Courses', 'Books', 'Other'],
  Gifts: ['Family', 'Friends', 'Other'],
  Taxes: ['Income tax', 'Property tax', 'Car tax', 'Other'],
  Investments: ['Stocks', 'Funds', 'Crypto', 'Other'],
  Other: ['Miscellaneous', 'Unexpected'],
};

// ============================================================================
// Default Tags
// ============================================================================

export const DEFAULT_TAGS = [
  'Urgente',
  'Ricorrente',
  'Opzionale',
  'Deducibile',
];
export const DEFAULT_TAGS_EN = [
  'Urgent',
  'Recurring',
  'Optional',
  'Deductible',
];

// ============================================================================
// Category Colors (for charts)
// ============================================================================

export const CATEGORY_COLORS: Record<string, string> = {
  Stipendio: '#10B981',
  Salary: '#10B981',
  Casa: '#F59E0B',
  Home: '#F59E0B',
  Spesa: '#EF4444',
  Groceries: '#EF4444',
  Trasporti: '#3B82F6',
  Transportation: '#3B82F6',
  Salute: '#EC4899',
  Health: '#EC4899',
  Svago: '#8B5CF6',
  Entertainment: '#8B5CF6',
  Abbigliamento: '#F97316',
  Clothing: '#F97316',
  Tecnologia: '#06B6D4',
  Technology: '#06B6D4',
  Istruzione: '#84CC16',
  Education: '#84CC16',
  Regali: '#D946EF',
  Gifts: '#D946EF',
  Tasse: '#64748B',
  Taxes: '#64748B',
  Investimenti: '#14B8A6',
  Investments: '#14B8A6',
  Altro: '#9CA3AF',
  Other: '#9CA3AF',
};

// Default color for unknown categories
export const DEFAULT_CATEGORY_COLOR = '#6B7280';

// ============================================================================
// Chart Color Palette (for dynamic assignment)
// ============================================================================

export const CHART_COLORS = [
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#D946EF', // Fuchsia
];

// ============================================================================
// Asset Types
// ============================================================================

export const ASSET_TYPES = [
  'stock',
  'crypto',
  'bond',
  'fund',
  'other',
] as const;

export const ASSET_TYPE_LABELS: Record<string, { en: string; it: string }> = {
  stock: { en: 'Stock', it: 'Azione' },
  crypto: { en: 'Cryptocurrency', it: 'Criptovaluta' },
  bond: { en: 'Bond', it: 'Obbligazione' },
  fund: { en: 'Fund', it: 'Fondo' },
  other: { en: 'Other', it: 'Altro' },
};

// ============================================================================
// Recurring Frequencies
// ============================================================================

export const RECURRING_FREQUENCIES = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
] as const;

export const FREQUENCY_LABELS: Record<string, { en: string; it: string }> = {
  daily: { en: 'Daily', it: 'Giornaliero' },
  weekly: { en: 'Weekly', it: 'Settimanale' },
  monthly: { en: 'Monthly', it: 'Mensile' },
  yearly: { en: 'Yearly', it: 'Annuale' },
};

// ============================================================================
// Default State
// ============================================================================

export const DEFAULT_GLOBAL_FILTER: GlobalFilter = {
  enabled: false,
  startDate: undefined,
  endDate: undefined,
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  locale: 'en',
  currency: 'EUR',
  savingsGoal: 20,
};

export const DEFAULT_EXPENSE_DATA: ExpenseData = {
  transactions: [],
  categories: DEFAULT_CATEGORIES_EN,
  assets: [],
  assetTransactions: [],
  recurring: [],
  quickActions: [],
  tags: DEFAULT_TAGS_EN,
  globalFilter: DEFAULT_GLOBAL_FILTER,
  settings: DEFAULT_USER_SETTINGS,
  lastSync: undefined,
};

// ============================================================================
// Currency Formatting
// ============================================================================

export const SUPPORTED_CURRENCIES = [
  { code: 'EUR', symbol: '€', locale: 'it-IT' },
  { code: 'USD', symbol: '$', locale: 'en-US' },
  { code: 'GBP', symbol: '£', locale: 'en-GB' },
  { code: 'CHF', symbol: 'CHF', locale: 'de-CH' },
] as const;

// ============================================================================
// Navigation Views
// ============================================================================

export const NAV_VIEWS = [
  'dashboard',
  'transactions',
  'analytics',
  'investments',
  'investment-log',
  'settings',
] as const;

export type NavView = (typeof NAV_VIEWS)[number];
