import { useEffect } from 'react';
import type { SupportedLanguage } from '@/i18n/config';
import { LOCALE_STORAGE_KEY, isSupportedLanguage } from '@/i18n/config';

/**
 * Syncs the locale from expense tracker settings to localStorage and
 * dispatches an event to notify the LocaleProvider of the change.
 *
 * Call this whenever settings.locale changes.
 */
export const syncLocaleToProvider = (locale: SupportedLanguage): void => {
  if (!isSupportedLanguage(locale)) {
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
export const useTranslationsConfig = (
  settingsLocale: SupportedLanguage,
): void => {
  useEffect(() => {
    syncLocaleToProvider(settingsLocale);
  }, [settingsLocale]);
};
