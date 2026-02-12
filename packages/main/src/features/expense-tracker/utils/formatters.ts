import { SUPPORTED_CURRENCIES } from '../constants';

// ============================================================================
// Currency Formatting
// ============================================================================

export const formatCurrency = (
  amount: number,
  currencyCode = 'EUR',
  options?: Partial<Intl.NumberFormatOptions>,
): string => {
  const currency =
    SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode) ??
    SUPPORTED_CURRENCIES[0];

  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);
};

export const formatCompactCurrency = (
  amount: number,
  currencyCode = 'EUR',
): string => {
  const currency =
    SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode) ??
    SUPPORTED_CURRENCIES[0];

  if (Math.abs(amount) >= 1000000) {
    return new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currency.code,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }

  return formatCurrency(amount, currencyCode);
};

// ============================================================================
// Date Formatting
// ============================================================================

export const formatDate = (dateString: string, locale = 'en'): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

export const formatDateShort = (dateString: string, locale = 'en'): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
};

export const formatMonth = (dateString: string, locale = 'en'): string => {
  const date = new Date(dateString + '-01');
  return new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-US', {
    year: 'numeric',
    month: 'long',
  }).format(date);
};

export const formatRelativeDate = (
  dateString: string,
  locale = 'en',
): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return locale === 'it' ? 'Oggi' : 'Today';
  }
  if (diffDays === 1) {
    return locale === 'it' ? 'Ieri' : 'Yesterday';
  }
  if (diffDays < 7) {
    return new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-US', {
      weekday: 'long',
    }).format(date);
  }

  return formatDate(dateString, locale);
};

export const getISODateString = (date: Date = new Date()): string => {
  return date.toISOString().split('T')[0];
};

export const getMonthKey = (dateString: string): string => {
  return dateString.substring(0, 7); // YYYY-MM
};

export const getYearKey = (dateString: string): string => {
  return dateString.substring(0, 4); // YYYY
};

// ============================================================================
// Number Formatting
// ============================================================================

export const formatPercent = (value: number, decimals = 1): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
};

export const formatNumber = (value: number, locale = 'en'): string => {
  return new Intl.NumberFormat(locale === 'it' ? 'it-IT' : 'en-US').format(
    value,
  );
};

// ============================================================================
// Sanitization (XSS Prevention)
// ============================================================================

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (str: string): string => {
  return str.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] ?? char);
};

// ============================================================================
// Calculation Helpers
// ============================================================================

export const calculateSavingsRate = (
  income: number,
  expenses: number,
): number => {
  if (income <= 0) {
    return 0;
  }
  const savings = income - Math.abs(expenses);
  return Math.max(0, Math.min(100, (savings / income) * 100));
};

export const calculatePercentChange = (
  current: number,
  previous: number,
): number => {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
};

// ============================================================================
// Date Range Helpers
// ============================================================================

export const getMonthRange = (
  year: number,
  month: number,
): { start: string; end: string } => {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start: getISODateString(start),
    end: getISODateString(end),
  };
};

export const getCurrentMonthRange = (): { start: string; end: string } => {
  const now = new Date();
  return getMonthRange(now.getFullYear(), now.getMonth());
};

export const getYearRange = (year: number): { start: string; end: string } => {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
};
