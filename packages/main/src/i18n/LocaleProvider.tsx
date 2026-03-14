'use client';

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from 'react';
import { NextIntlClientProvider } from 'next-intl';
import type { SupportedLanguage } from '@/i18n/config';
import {
  LOCALE_STORAGE_KEY,
  defaultLocale,
  isSupportedLanguage,
  supportedLanguages,
} from '@/i18n/config';

// Pre-import all message bundles for static export
import enMessages from './translations/en.json';
import itMessages from './translations/it.json';

type TranslationDataType = Record<string, unknown> | null | undefined;

const messagesMap: Record<SupportedLanguage, TranslationDataType> = {
  [supportedLanguages.EN]: enMessages as TranslationDataType,
  [supportedLanguages.IT]: itMessages as TranslationDataType,
} as const;

interface LocaleContextValue {
  locale: SupportedLanguage;
  setLocale: (locale: SupportedLanguage) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export const useLocale = (): LocaleContextValue => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
};

/**
 * Reads the initial locale from localStorage (synced from IndexedDB settings).
 * Falls back to defaultLocale if not found or invalid.
 */
const getInitialLocale = (): SupportedLanguage => {
  if (typeof window === 'undefined') {
    return defaultLocale;
  }

  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isSupportedLanguage(stored)) {
      return stored;
    }
  } catch {
    // Silent fail for SSR or localStorage errors
  }

  return defaultLocale;
};

interface Props {
  children: React.ReactNode;
}

const LocaleProvider: React.FC<Props> = ({ children }) => {
  const [locale, setLocaleState] = useState<SupportedLanguage>(defaultLocale);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate locale from storage on mount
  useEffect(() => {
    const storedLocale = getInitialLocale();
    setLocaleState(storedLocale);
    setIsHydrated(true);
  }, []);

  // Listen for locale changes from settings (via custom event)
  useEffect(() => {
    const handleLocaleChange = (event: CustomEvent<SupportedLanguage>) => {
      if (isSupportedLanguage(event.detail)) {
        setLocaleState(event.detail);
      }
    };

    window.addEventListener(
      'locale-change',
      handleLocaleChange as EventListener,
    );
    return () => {
      window.removeEventListener(
        'locale-change',
        handleLocaleChange as EventListener,
      );
    };
  }, []);

  const setLocale = useCallback((newLocale: SupportedLanguage) => {
    if (!isSupportedLanguage(newLocale)) {
      return;
    }

    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    } catch {
      // Silent fail
    }

    setLocaleState(newLocale);

    // Dispatch event for other components that might need to know
    window.dispatchEvent(
      new CustomEvent('locale-change', { detail: newLocale }),
    );
  }, []);

  // Update HTML lang attribute when locale changes
  useEffect(() => {
    if (isHydrated) {
      document.documentElement.lang = locale;
    }
  }, [locale, isHydrated]);

  const contextValue: LocaleContextValue = {
    locale,
    setLocale,
  };

  return (
    <LocaleContext.Provider value={contextValue}>
      <NextIntlClientProvider
        locale={locale}
        messages={messagesMap[locale]}
        timeZone="Europe/Rome"
      >
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
};

export type LocaleProviderProps = Props;
export default LocaleProvider;
