'use client';

import BasePageTemplate from '@/templates/BasePageTemplate';
import Stack from '@swiftpost/elysium/ui/base/Stack';
import Link from '@swiftpost/elysium/ui/Link';
import { useTranslations } from 'next-intl';

const HomeLinksList: React.FC = () => {
  const tDashboard = useTranslations('dashboard');
  const tAnalyticsTools = useTranslations('analyticsTools');
  const tEconomicBubbleAnalysis = useTranslations('economicBubbleAnalysis');
  return (
    <BasePageTemplate>
      <Stack alignItems="left" justifyContent="center" padding={4}>
        <Link href="/expense-tracker">{tDashboard('title')}</Link>
        <Link href="/analytics-tools">{tAnalyticsTools('title')}</Link>
        <Link href="/economic-bubble-analysis">
          {tEconomicBubbleAnalysis('title')}
        </Link>
        {/* Add here more links when creating new features */}
      </Stack>
    </BasePageTemplate>
  );
};

export default HomeLinksList;
