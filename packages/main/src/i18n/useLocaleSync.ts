import { useEffect } from 'react';
import type { Locale } from '@/i18n/config';
import { locales } from '@/i18n/config';

const LOCALE_STORAGE_KEY = 'expense-tracker-locale';

/**
 * Syncs the locale from expense tracker settings to localStorage and
 * dispatches an event to notify the LocaleProvider of the change.
 *
 * Call this whenever settings.locale changes.
 */
export const syncLocaleToProvider = (locale: string): void => {
  if (!locales.includes(locale as Locale)) {
    return;
  }

  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Silent fail
  }

  // Dispatch event for LocaleProvider
  window.dispatchEvent(new CustomEvent('locale-change', { detail: locale }));
};

/**
 * Hook that automatically syncs the settings locale to the LocaleProvider.
 * Use this in your main expense tracker component or wherever you have access to settings.
 */
export const useLocaleSync = (settingsLocale: string): void => {
  useEffect(() => {
    syncLocaleToProvider(settingsLocale);
  }, [settingsLocale]);
};
