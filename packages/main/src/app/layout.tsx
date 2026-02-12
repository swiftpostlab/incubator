import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import './globals.css';
import AppRouterCacheProvider from '@swiftpost/elysium/core/AppRouterCacheProvider';
import ThemeProvider from '@swiftpost/elysium/core/ThemeProvider';
import { theme, mainFont } from '@swiftpost/elysium/themes/gamut';
import { getLocaleConfig } from '@/i18n/config';

export const metadata: Metadata = {
  title: 'Expense Tracker | SwiftPost',
  description: 'Complete personal finance management system',
};

interface Props {
  children: React.ReactNode;
}

const RootLayout: React.FC<Props> = async ({ children }) => {
  const { messages, locale } = await getLocaleConfig();

  return (
    <html lang={locale} className={mainFont.variable}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <AppRouterCacheProvider>
            <ThemeProvider theme={theme}>{children}</ThemeProvider>
          </AppRouterCacheProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
};

export default RootLayout;
