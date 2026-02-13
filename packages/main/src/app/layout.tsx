import type { Metadata } from 'next';
import './globals.css';
import AppRouterCacheProvider from '@swiftpost/elysium/core/AppRouterCacheProvider';
import ThemeProvider from '@swiftpost/elysium/core/ThemeProvider';
import { theme, mainFont } from '@swiftpost/elysium/themes/gamut';
import LocaleProvider from '@/i18n/LocaleProvider';

export const metadata: Metadata = {
  title: 'Expense Tracker | SwiftPost',
  description: 'Complete personal finance management system',
};

interface Props {
  children: React.ReactNode;
}

const RootLayout: React.FC<Props> = ({ children }) => {
  return (
    <html lang="en" className={mainFont.variable}>
      <body>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <LocaleProvider>{children}</LocaleProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
};

export default RootLayout;
