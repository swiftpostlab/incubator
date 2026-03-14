export const supportedLanguages = {
  EN: 'en',
  IT: 'it',
} as const;

// export const locales = ['en', 'it'] as const;
export type SupportedLanguage =
  (typeof supportedLanguages)[keyof typeof supportedLanguages];
export const defaultLocale = supportedLanguages.EN;

export const LOCALE_STORAGE_KEY = 'expense-tracker-locale';

const supportedLanguageValues = new Set<SupportedLanguage>(
  Object.values(supportedLanguages),
);

export const isSupportedLanguage = (
  locale: string,
): locale is SupportedLanguage =>
  supportedLanguageValues.has(locale as SupportedLanguage);

export const getLocaleConfig = async () => {
  const locale = defaultLocale;

  return {
    locale,
    messages: (
      (await import(`./translations/${locale}.json`)) as {
        default: Record<string, string>;
      }
    ).default,
  };
};

// Exported also as default to generate the plugin
const defaultExport = getLocaleConfig;
export default defaultExport;
