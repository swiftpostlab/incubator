export const supportedLanguages = {
  EN: 'en',
  IT: 'it',
} as const;

// export const locales = ['en', 'it'] as const;
export type SupportedLanguage =
  (typeof supportedLanguages)[keyof typeof supportedLanguages];
export const defaultLocale = supportedLanguages.EN;

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
