import BasePageTemplate from '@/templates/BasePageTemplate';
import Stack from '@swiftpost/elysium/ui/base/Stack';
import Link from '@swiftpost/elysium/ui/Link';

const Home: React.FC = () => {
  return (
    <BasePageTemplate>
      <Stack alignItems="left" justifyContent="center" padding={4}>
        <Link href="/expense-tracker">{'Expense Tracker'}</Link>
        <Link href="/analytics-tools">{'Analytics Tools'}</Link>
        <Link href="/economic-bubble-analysis">
          {'Economic Bubble Analysis'}
        </Link>
        <Link href="/meeting-scheduler">{'Meeting Scheduler'}</Link>
        {/* Add here more links when creating new features */}
      </Stack>
    </BasePageTemplate>
  );
};

export default Home;
