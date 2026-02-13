export const locales = ['en', 'it'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const getLocaleConfig = async () => {
  const locale = defaultLocale;

  return {
    locale,
    messages: (
      (await import(`../../languages/${locale}.json`)) as {
        default: Record<string, string>;
      }
    ).default,
  };
};

// Exported also as default to generate the plugin
const defaultExport = getLocaleConfig;
export default defaultExport;
